import { hasManualLogout } from "@/utils/authStorage";
import { usePageRefresh } from "@/composables/usePageRefresh";
import { computed, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useTeamContext } from "@/stores/teamContext";
import { useMiniReviewStatus } from "@/stores/miniReview";
import type { BackendTeamSummary } from "@/types/backend";
import { checkTeamRequiresPassword, joinTeamFromForm, searchTeamsByKeyword } from "../teamSelfActions";
import { useProfileCompletionGate } from "../useProfileCompletionGate";

// 加入球队独立页：对已在球队中的用户同样开放（一人可属于多支球队）。
export function useTeamJoinPage() {
  const { currentUser, myTeams, ensureSessionReady, refreshSessionContext } = useTeamContext();
  const { shouldHideCreationEntrances } = useMiniReviewStatus();
  const profileGate = useProfileCompletionGate();
  const navMetrics = getCustomNavMetrics();

  let successUserId: number | undefined;
  const joinedTeam = ref<BackendTeamSummary | null>(null);
  const checkingPassword = ref(false);
  let selectionVersion = 0;
  watch(() => currentUser.value?.id, (id) => {
    if (successUserId && !hasManualLogout() && (!id || id === successUserId)) return;
    successUserId = undefined;
    selectionVersion++;
    checkingPassword.value = false;
    joinedTeam.value = null;
    selectedTeam.value = null;
    joinPassword.value = "";
    profileGate.handleProfileGateCancel();
  });
  const submitting = ref(false);
  const searching = ref(false);
  const hasSearched = ref(false);
  const searchKeyword = ref("");
  const searchResults = ref<BackendTeamSummary[]>([]);
  const selectedTeam = ref<BackendTeamSummary | null>(null);
  const selectedTeamRequiresPassword = ref(false);
  const joinPassword = ref("");
  const joinedTeamIds = computed(() => myTeams.value.map(team => team.id));
  const selectedTeamIsMember = computed(() => !!selectedTeam.value && joinedTeamIds.value.includes(selectedTeam.value.id));
  const canJoin = computed(() => !!selectedTeam.value && !submitting.value && !checkingPassword.value && !joinedTeam.value);
  const canShowCreateEntry = computed(() => !shouldHideCreationEntrances.value);
  const pageStyle = computed(() => ({ paddingTop: `${navMetrics.pageTopPadding + 8}px` }));

  function goCreateTeam() {
    uni.navigateTo({ url: "/pages/teams/create/index" });
  }

  async function handleSearchTeams() {
    const keyword = searchKeyword.value.trim();
    if (!keyword) {
      uni.showToast({ title: "请输入球队名称", icon: "none" });
      return;
    }
    if (searching.value || submitting.value) return;
    selectionVersion++;
    checkingPassword.value = false;
    searching.value = true;
    searchResults.value = [];
    selectedTeam.value = null;
    selectedTeamRequiresPassword.value = false;
    joinPassword.value = "";
    try {
      searchResults.value = await searchTeamsByKeyword(keyword);
      hasSearched.value = true;
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "搜索球队失败", icon: "none" });
    } finally {
      searching.value = false;
    }
  }

  async function handleSelectTeam(team: BackendTeamSummary) {
    if (submitting.value) return;
    const version = ++selectionVersion;
    selectedTeam.value = team;
    joinPassword.value = "";
    selectedTeamRequiresPassword.value = false;
    checkingPassword.value = false;
    if (selectedTeamIsMember.value) return;
    checkingPassword.value = true;
    try {
      const requiresPassword = await checkTeamRequiresPassword(team.id);
      if (selectionVersion === version) selectedTeamRequiresPassword.value = requiresPassword;
    } catch (error) {
      if (selectionVersion !== version) return;
      selectedTeamRequiresPassword.value = false;
      uni.showToast({ title: error instanceof Error ? error.message : "密码信息加载失败", icon: "none" });
    } finally {
      if (selectionVersion === version) checkingPassword.value = false;
    }
  }

  // 刷新失败可暂时清空会话；成功结果仍属于原账号，不能因此再次提交。
  async function restoreSuccessAccount(): Promise<boolean> {
    const ownerId = successUserId;
    if (hasManualLogout()) {
      successUserId = undefined;
      joinedTeam.value = null;
      return false;
    }
    if (!ownerId) return false;
    try {
      await ensureSessionReady();
      if (hasManualLogout() || currentUser.value?.id !== ownerId) {
        uni.showToast({ title: "请恢复原账号后继续", icon: "none" });
        return false;
      }
      return true;
    } catch {
      uni.showToast({ title: "操作已成功，请稍后重试下一步", icon: "none" });
      return false;
    }
  }

  async function goJoinedTeam() {
    if (!(await restoreSuccessAccount())) return;
    if (joinedTeam.value) uni.navigateTo({ url: `/pages/teams/detail/index?teamId=${joinedTeam.value.id}` });
  }

  async function goFindMatches() {
    if (!(await restoreSuccessAccount())) return;
    uni.switchTab({ url: "/pages/activities/index" });
  }

  async function handleJoinTeam() {
    if (!canJoin.value || !selectedTeam.value) return;
    const team = selectedTeam.value;
    const userId = currentUser.value?.id;
    if (selectedTeamIsMember.value) {
      uni.navigateTo({ url: `/pages/teams/detail/index?teamId=${team.id}` });
      return;
    }
    if (selectedTeamRequiresPassword.value && !joinPassword.value.trim()) {
      uni.showToast({ title: "请输入入队密码", icon: "none" });
      return;
    }
    const password = joinPassword.value.trim() || undefined;
    // 在资料 gate 前锁定本次目标，防止连点覆盖 gate 或切队后误提交。
    submitting.value = true;
    try {
      if (!(await profileGate.ensureProfileComplete())) return;
      if (userId !== currentUser.value?.id || selectedTeam.value?.id !== team.id) return;
      await joinTeamFromForm({ teamId: team.id, password });
      if (userId !== currentUser.value?.id) return;
      successUserId = userId;
      joinedTeam.value = team;
      joinPassword.value = "";
      try {
        await refreshSessionContext();
      } catch {
        uni.showToast({ title: "已加入球队，球队列表稍后刷新", icon: "none" });
      }
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "加入球队失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  usePageRefresh(async () => {
    await ensureSessionReady();
    if (searchKeyword.value.trim()) searchResults.value = await searchTeamsByKeyword(searchKeyword.value.trim());
    if (selectedTeam.value && !selectedTeamIsMember.value) selectedTeamRequiresPassword.value = await checkTeamRequiresPassword(selectedTeam.value.id);
  });

  onShow(async () => {
    if (hasManualLogout()) {
      await restoreSuccessAccount();
      return;
    }
    await ensureSessionReady();
  });

  return {
    joinedTeam,
    goJoinedTeam,
    goFindMatches,
    pageStyle,
    searching,
    hasSearched,
    searchKeyword,
    searchResults,
    selectedTeam,
    selectedTeamIsMember,
    joinedTeamIds,
    selectedTeamRequiresPassword,
    joinPassword,
    canJoin,
    submitting,
    canShowCreateEntry,
    profileGateVisible: profileGate.profileGateVisible,
    handleProfileGateCompleted: profileGate.handleProfileGateCompleted,
    handleProfileGateCancel: profileGate.handleProfileGateCancel,
    handleSearchTeams,
    handleSelectTeam,
    handleJoinTeam,
    goCreateTeam,
  };
}
