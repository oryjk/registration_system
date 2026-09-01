import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useTeamContext } from "@/stores/teamContext";
import { useMiniReviewStatus } from "@/stores/miniReview";
import type { BackendTeamSummary } from "@/types/backend";
import { checkTeamRequiresPassword, joinTeamFromForm, searchTeamsByKeyword } from "../teamSelfActions";
import { useProfileCompletionGate } from "../useProfileCompletionGate";

// 加入球队独立页：对已在球队中的用户同样开放（一人可属于多支球队）。
export function useTeamJoinPage() {
  const { ensureSessionReady, refreshSessionContext } = useTeamContext();
  const { shouldHideCreationEntrances } = useMiniReviewStatus();
  const profileGate = useProfileCompletionGate();
  const navMetrics = getCustomNavMetrics();

  const submitting = ref(false);
  const searching = ref(false);
  const searchKeyword = ref("");
  const searchResults = ref<BackendTeamSummary[]>([]);
  const selectedTeam = ref<BackendTeamSummary | null>(null);
  const selectedTeamRequiresPassword = ref(false);
  const joinPassword = ref("");
  const canJoin = computed(() => !!selectedTeam.value && !submitting.value);
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
    searching.value = true;
    selectedTeam.value = null;
    selectedTeamRequiresPassword.value = false;
    joinPassword.value = "";
    try {
      searchResults.value = await searchTeamsByKeyword(keyword);
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "搜索球队失败", icon: "none" });
    } finally {
      searching.value = false;
    }
  }

  async function handleSelectTeam(team: BackendTeamSummary) {
    selectedTeam.value = team;
    joinPassword.value = "";
    try {
      selectedTeamRequiresPassword.value = await checkTeamRequiresPassword(team.id);
    } catch (error) {
      selectedTeamRequiresPassword.value = false;
      uni.showToast({ title: error instanceof Error ? error.message : "密码信息加载失败", icon: "none" });
    }
  }

  async function handleJoinTeam() {
    if (!selectedTeam.value) {
      uni.showToast({ title: "请选择要加入的球队", icon: "none" });
      return;
    }
    if (selectedTeamRequiresPassword.value && !joinPassword.value.trim()) {
      uni.showToast({ title: "请输入入队密码", icon: "none" });
      return;
    }
    // 昵称/头像缺失时先弹框完善资料，保存成功后才继续加入。
    if (!(await profileGate.ensureProfileComplete())) return;
    submitting.value = true;
    try {
      await joinTeamFromForm({ teamId: selectedTeam.value.id, password: joinPassword.value.trim() || undefined });
      await refreshSessionContext();
      uni.showToast({ title: "已加入球队", icon: "none" });
      uni.switchTab({ url: "/pages/user/index" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "加入球队失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  onShow(async () => {
    await ensureSessionReady();
  });

  return {
    pageStyle,
    searching,
    searchKeyword,
    searchResults,
    selectedTeam,
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
