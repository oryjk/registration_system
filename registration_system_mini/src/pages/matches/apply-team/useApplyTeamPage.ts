import { computed, ref, type Ref } from "vue";
import { getMatchDetail } from "@/api/match";
import { applyTeamMatch, listTeamApplications, withdrawTeamApplication } from "@/api/teamApplication";
import { useTeamContext } from "@/stores/teamContext";
import type { AppMatchDetailResponse, AppTeamApplication } from "@/types/match";

export type ApplyTeamPhase = "loading" | "error" | "ready" | "submitted";

export function useApplyTeamPage(matchId: Ref<string>) {
  const { currentTeam } = useTeamContext();

  const isLoading = ref(false);
  const errorMessage = ref("");
  const detail = ref<AppMatchDetailResponse | null>(null);
  const myApplication = ref<AppTeamApplication | null>(null);
  const introduction = ref("");
  const isSubmitting = ref(false);
  const isWithdrawing = ref(false);

  const canManageTeam = computed(() => !!currentTeam.value?.canManageTeam);
  const hostTeamId = computed(() => detail.value?.match.host_team_id ?? null);
  const isRecruitingTeamMatch = computed(() => {
    const match = detail.value?.match;
    return !!match && match.publication_mode === "online_team" && match.opponent_state === "recruiting" && match.status === "registering";
  });
  const isHostTeamMember = computed(() => hostTeamId.value !== null && currentTeam.value?.id === hostTeamId.value);
  const canApply = computed(() => canManageTeam.value && isRecruitingTeamMatch.value && !isHostTeamMember.value);
  const hasActiveApplication = computed(() =>
    myApplication.value?.status === "pending" || myApplication.value?.status === "selected",
  );
  const teamName = computed(() => currentTeam.value?.name ?? "");

  async function loadPageData() {
    if (!matchId.value) return;
    isLoading.value = true;
    errorMessage.value = "";
    try {
      const [detailResponse, applications] = await Promise.all([
        getMatchDetail(matchId.value),
        listTeamApplications(matchId.value),
      ]);
      detail.value = detailResponse;
      myApplication.value = applications.find(
        (item) =>
          item.applicant_team_id === currentTeam.value?.id &&
          (item.status === "pending" || item.status === "selected"),
      ) ?? null;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "接约信息加载失败";
    } finally {
      isLoading.value = false;
    }
  }

  async function submitApplication() {
    if (isSubmitting.value || !canApply.value || hasActiveApplication.value) return;
    const teamId = currentTeam.value?.id;
    const trimmed = introduction.value.trim();
    if (!teamId) {
      uni.showToast({ title: "请先在我的页面选择球队", icon: "none" });
      return;
    }
    if (!trimmed) {
      uni.showToast({ title: "请填写球队介绍", icon: "none" });
      return;
    }

    isSubmitting.value = true;
    try {
      myApplication.value = await applyTeamMatch(matchId.value, teamId, trimmed);
      uni.showToast({ title: "已提交申请，等待对方确认", icon: "none" });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "提交申请失败",
        icon: "none",
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  async function withdrawApplication() {
    const application = myApplication.value;
    if (isWithdrawing.value || !application || application.status !== "pending") return;

    const confirmed = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: "确认撤回申请",
        content: "撤回后可以重新提交接约申请。",
        confirmText: "撤回申请",
        cancelText: "再想想",
        success: (result) => resolve(!!result.confirm),
        fail: () => resolve(false),
      });
    });
    if (!confirmed) return;

    isWithdrawing.value = true;
    try {
      const withdrawn = await withdrawTeamApplication(matchId.value, application.id);
      myApplication.value = withdrawn.status === "withdrawn" ? null : withdrawn;
      uni.showToast({ title: "已撤回申请", icon: "none" });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "撤回申请失败",
        icon: "none",
      });
    } finally {
      isWithdrawing.value = false;
    }
  }

  function openMatchDetail() {
    uni.navigateTo({ url: `/pages/matches/detail?id=${matchId.value}` });
  }

  return {
    isLoading,
    errorMessage,
    detail,
    myApplication,
    introduction,
    isSubmitting,
    isWithdrawing,
    teamName,
    canManageTeam,
    isRecruitingTeamMatch,
    isHostTeamMember,
    canApply,
    hasActiveApplication,
    loadPageData,
    submitApplication,
    withdrawApplication,
    openMatchDetail,
  };
}
