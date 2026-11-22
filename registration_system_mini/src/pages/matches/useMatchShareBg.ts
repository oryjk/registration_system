import { computed, ref, type ComputedRef, type Ref } from "vue";
import { clearMatchShareBg, selectMatchShareBg, uploadMatchShareBg } from "@/api/match";
import { getTeamVipStatus, listTeamShareBackgrounds } from "@/api/team";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { useTeamContext } from "@/stores/teamContext";
import type {
  BackendActivity,
  BackendMatchShareBgResult,
  BackendTeamShareBackgroundItem,
  BackendTeamVipStatus,
} from "@/types/backend";
import type { AppMatchSummary } from "@/types/match";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { beijingDateKey } from "@/utils/datetime";
import { ApiRequestError } from "@/utils/request";

export interface UseMatchShareBgOptions {
  match: Ref<BackendActivity | null>;
  sourceMatch: Ref<AppMatchSummary | null>;
  isGuestMode: Ref<boolean>;
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  refreshSessionContext?: () => Promise<void>;
  onShareBgChanged?: () => void | Promise<void>;
}

type PendingShareBgIntent =
  | { type: "upload" }
  | { type: "select"; imageUrl: string }
  | null;

export function useMatchShareBg(options: UseMatchShareBgOptions) {
  const {
    match,
    sourceMatch,
    isGuestMode,
    currentTeam,
    onShareBgChanged,
  } = options;
  const teamContext = useTeamContext();
  const refreshSessionContext = options.refreshSessionContext ?? (() => teamContext.refreshSessionContext());

  const { shouldHideCreationEntrances } = useMiniReviewStatus();

  const shareBgSheetVisible = ref(false);
  const vipSheetVisible = ref(false);
  const isLoadingMeta = ref(false);
  const isBusy = ref(false);
  const teamVipStatus = ref<BackendTeamVipStatus | null>(null);
  const teamBackgrounds = ref<BackendTeamShareBackgroundItem[]>([]);
  const pendingIntent = ref<PendingShareBgIntent>(null);

  const hostTeamId = computed<number>(() => sourceMatch.value?.host_team_id ?? 0);
  const hostTeamName = computed<string>(
    () => currentTeam.value?.name || sourceMatch.value?.host_team_name || "",
  );
  const currentBgUrl = computed<string>(
    () => (sourceMatch.value?.share_bg_image_url ?? match.value?.share_bg_image_url ?? "").trim(),
  );

  // 与 canEditMatch 同口径且必须存在 host_team_id；微信审核态下自动隐藏。
  const canManageShareBg = computed(() => {
    if (shouldHideCreationEntrances.value) return false;
    const source = sourceMatch.value;
    if (!source || isGuestMode.value || source.status === "ended" || source.status === "cancelled") {
      return false;
    }
    if (!source.host_team_id) return false;
    return currentTeam.value?.id === source.host_team_id && !!currentTeam.value?.canManageTeam;
  });

  const hasCustomShareBgAccess = computed(() => {
    if (sourceMatch.value?.share_bg_unlocked || match.value?.share_bg_unlocked) {
      return true;
    }
    if (teamVipStatus.value && teamVipStatus.value.team_id === hostTeamId.value) {
      return teamVipStatus.value.is_vip || teamVipStatus.value.vip_credits > 0;
    }
    if (currentTeam.value && currentTeam.value.id === hostTeamId.value) {
      return currentTeam.value.isVip || currentTeam.value.vipCredits > 0;
    }
    return false;
  });

  const vipSummaryText = computed(() => {
    const status = teamVipStatus.value && teamVipStatus.value.team_id === hostTeamId.value
      ? teamVipStatus.value
      : null;
    const isVip = status ? status.is_vip : !!currentTeam.value?.isVip;
    const vipUntilRaw = status ? (status.vip_until ?? "") : "";
    const credits = status ? status.vip_credits : (currentTeam.value?.vipCredits ?? 0);
    if (isVip) {
      const dateStr = vipUntilRaw ? beijingDateKey(vipUntilRaw) : "";
      return dateStr ? `会员至 ${dateStr}` : "球队会员";
    }
    if (credits > 0) {
      return `剩余 ${credits} 次权益`;
    }
    return "免费版";
  });

  const anySheetVisible = computed(() => shareBgSheetVisible.value || vipSheetVisible.value);

  async function refreshTeamShareBgMeta(teamId: number) {
    if (!teamId) return;
    isLoadingMeta.value = true;
    try {
      const [vipResult, bgListResult] = await Promise.allSettled([
        getTeamVipStatus(teamId),
        listTeamShareBackgrounds(teamId),
      ]);
      if (vipResult.status === "fulfilled") {
        teamVipStatus.value = vipResult.value;
      }
      if (bgListResult.status === "fulfilled") {
        teamBackgrounds.value = bgListResult.value.items ?? [];
      }
    } finally {
      isLoadingMeta.value = false;
    }
  }

  function applyShareBgResult(result: BackendMatchShareBgResult) {
    if (sourceMatch.value) {
      sourceMatch.value = {
        ...sourceMatch.value,
        share_bg_image_url: result.share_bg_image_url,
        share_bg_unlocked: result.share_bg_unlocked,
      };
    }
    if (match.value) {
      match.value = {
        ...match.value,
        share_bg_image_url: result.share_bg_image_url,
        share_bg_unlocked: result.share_bg_unlocked,
      };
    }
  }

  async function notifyShareCardRefresh() {
    if (onShareBgChanged) {
      await onShareBgChanged();
    }
  }

  function openShareBgManager() {
    if (!canManageShareBg.value || !hostTeamId.value) return;
    shareBgSheetVisible.value = true;
    void refreshTeamShareBgMeta(hostTeamId.value);
  }

  function closeShareBgSheet() {
    if (isBusy.value) return;
    shareBgSheetVisible.value = false;
  }

  function openVipSheet(intent: PendingShareBgIntent = null) {
    pendingIntent.value = intent;
    vipSheetVisible.value = true;
    if (hostTeamId.value) {
      void refreshTeamShareBgMeta(hostTeamId.value);
    }
  }

  function closeVipSheet() {
    vipSheetVisible.value = false;
    pendingIntent.value = null;
  }

  async function handleSelectDefault() {
    const matchId = sourceMatch.value?.id;
    if (!matchId || isBusy.value) return;
    if (!currentBgUrl.value) {
      shareBgSheetVisible.value = false;
      return;
    }
    isBusy.value = true;
    try {
      const result = await clearMatchShareBg(matchId);
      applyShareBgResult(result);
      await notifyShareCardRefresh();
      uni.showToast({ title: "已恢复默认热血海报底", icon: "none" });
      shareBgSheetVisible.value = false;
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "恢复默认背景失败",
        icon: "none",
      });
    } finally {
      isBusy.value = false;
    }
  }

  async function executeSelectBackground(imageUrl: string) {
    const matchId = sourceMatch.value?.id;
    if (!matchId || isBusy.value) return;
    isBusy.value = true;
    try {
      const result = await selectMatchShareBg(matchId, imageUrl);
      applyShareBgResult(result);
      await notifyShareCardRefresh();
      if (hostTeamId.value) {
        void refreshTeamShareBgMeta(hostTeamId.value);
      }
      uni.showToast({ title: "分享背景已更新", icon: "none" });
      shareBgSheetVisible.value = false;
    } catch (error) {
      if (error instanceof ApiRequestError && error.statusCode === 403) {
        openVipSheet({ type: "select", imageUrl });
        return;
      }
      uni.showToast({
        title: error instanceof Error ? error.message : "切换分享背景失败",
        icon: "none",
      });
    } finally {
      isBusy.value = false;
    }
  }

  async function handleSelectBackground(imageUrl: string) {
    if (!imageUrl || isBusy.value) return;
    if (imageUrl.trim() === currentBgUrl.value) {
      shareBgSheetVisible.value = false;
      return;
    }
    if (!hasCustomShareBgAccess.value) {
      openVipSheet({ type: "select", imageUrl });
      return;
    }
    await executeSelectBackground(imageUrl);
  }

  function chooseAndUploadImage() {
    const matchId = sourceMatch.value?.id;
    if (!matchId || isBusy.value) return;
    uni.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      success: (res) => {
        const filePath = res.tempFilePaths?.[0];
        if (!filePath) return;
        void (async () => {
          isBusy.value = true;
          try {
            const result = await uploadMatchShareBg(matchId, filePath);
            applyShareBgResult(result);
            await notifyShareCardRefresh();
            if (hostTeamId.value) {
              await Promise.allSettled([
                refreshTeamShareBgMeta(hostTeamId.value),
                refreshSessionContext(),
              ]);
            }
            uni.showToast({ title: "背景图已上传并存入球队资源库", icon: "none" });
            shareBgSheetVisible.value = false;
          } catch (error) {
            if (error instanceof ApiRequestError && error.statusCode === 403) {
              openVipSheet({ type: "upload" });
              return;
            }
            uni.showToast({
              title: error instanceof Error ? error.message : "上传背景图失败",
              icon: "none",
              duration: 2600,
            });
          } finally {
            isBusy.value = false;
          }
        })();
      },
    });
  }

  function handleUploadNew() {
    if (isBusy.value) return;
    if (!hasCustomShareBgAccess.value) {
      openVipSheet({ type: "upload" });
      return;
    }
    chooseAndUploadImage();
  }

  async function handleVipPurchased() {
    const intent = pendingIntent.value;
    pendingIntent.value = null;
    vipSheetVisible.value = false;

    const teamId = hostTeamId.value;
    await Promise.allSettled([
      refreshSessionContext(),
      teamId ? refreshTeamShareBgMeta(teamId) : Promise.resolve(),
    ]);

    if (intent?.type === "select") {
      await executeSelectBackground(intent.imageUrl);
      return;
    }
    uni.showToast({ title: "权益已生效，现在可以上传背景图", icon: "none", duration: 2400 });
    shareBgSheetVisible.value = true;
  }

  return {
    canManageShareBg,
    hostTeamId,
    hostTeamName,
    currentBgUrl,
    shareBgSheetVisible,
    vipSheetVisible,
    anySheetVisible,
    isLoadingMeta,
    isBusy,
    teamVipStatus,
    teamBackgrounds,
    hasCustomShareBgAccess,
    vipSummaryText,
    openShareBgManager,
    closeShareBgSheet,
    openVipSheet,
    closeVipSheet,
    handleSelectDefault,
    handleSelectBackground,
    handleUploadNew,
    handleVipPurchased,
  };
}
