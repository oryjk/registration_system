import { computed, ref, watch, type Ref } from "vue";
import { listTeamApplications, selectTeamApplication } from "@/api/teamApplication";
import { useTeamContext } from "@/stores/teamContext";
import type { NeoConfirmDialogOptions } from "@/components/neo";
import type { AppMatchSummary, AppTeamApplication } from "@/types/match";

/**
 * 比赛详情页的接约申请管理：主队 manager 在招募中的球队约队下
 * 查看全部申请并选择对手。选择成功后由页面刷新比赛详情。
 *
 * 入参是新比赛接口的原始比赛对象（useMatchDetailPage 的 sourceMatch）；
 * 转换后的 legacy activity 不带 publication_mode / opponent_state，不能用于判定。
 */
export function useMatchTeamApplications(
  sourceMatch: Ref<unknown>,
  reloadMatch: () => Promise<void> | void,
  confirm: (options: NeoConfirmDialogOptions) => Promise<boolean>,
) {
  const { currentTeam } = useTeamContext();

  const applications = ref<AppTeamApplication[]>([]);
  const isLoading = ref(false);
  const isSelecting = ref(false);
  const loadErrorMessage = ref("");

  // legacy 活动的 sourceMatch 为 null；只有招募中的新接口球队约队才有申请管理。
  function isRecruitingTeamMatchSource(value: unknown): value is AppMatchSummary {
    if (!value || typeof value !== "object" || !("publication_mode" in value)) {
      return false;
    }
    const source = value as AppMatchSummary;
    return source.publication_mode === "online_team"
      && source.opponent_state === "recruiting"
      && source.status === "registering";
  }

  const recruitingMatchId = computed(() => (
    isRecruitingTeamMatchSource(sourceMatch.value) ? sourceMatch.value.id : null
  ));
  const isHostManager = computed(
    () => isRecruitingTeamMatchSource(sourceMatch.value)
      && currentTeam.value?.id === (sourceMatch.value as AppMatchSummary).host_team_id
      && !!currentTeam.value?.canManageTeam,
  );
  const canManageApplications = computed(() => recruitingMatchId.value !== null && isHostManager.value);

  async function loadApplications() {
    if (!canManageApplications.value || !recruitingMatchId.value) {
      applications.value = [];
      return;
    }
    isLoading.value = true;
    loadErrorMessage.value = "";
    try {
      applications.value = await listTeamApplications(recruitingMatchId.value);
    } catch (error) {
      loadErrorMessage.value = error instanceof Error ? error.message : "接约申请加载失败";
    } finally {
      isLoading.value = false;
    }
  }

  async function selectOpponent(application: AppTeamApplication) {
    if (isSelecting.value || application.status !== "pending") return;

    const confirmed = await confirm({
      title: "确认选择对手",
      content: `确定选择「${application.applicant_team_name || "该球队"}」作为对手？其余申请将自动婉拒。`,
      highlight: application.applicant_team_name || undefined,
      confirmText: "选为对手",
      cancelText: "再想想",
    });
    if (!confirmed || !recruitingMatchId.value) return;

    isSelecting.value = true;
    try {
      await selectTeamApplication(recruitingMatchId.value, application.id);
      uni.showToast({ title: "已确认对手", icon: "none" });
      await reloadMatch();
      await loadApplications();
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "选择对手失败",
        icon: "none",
      });
    } finally {
      isSelecting.value = false;
    }
  }

  watch(canManageApplications, (visible) => {
    if (visible) {
      void loadApplications();
    } else {
      applications.value = [];
    }
  }, { immediate: true });

  return {
    applications,
    isLoading,
    isSelecting,
    loadErrorMessage,
    canManageApplications,
    loadApplications,
    selectOpponent,
  };
}
