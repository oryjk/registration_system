import { hasManualLogout } from "@/utils/authStorage";
import { usePageRefresh } from "@/composables/usePageRefresh";
import { computed, ref, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useTeamContext } from "@/stores/teamContext";
import { joinTeam, resolveTeamInviteCode, type AppTeamInviteView } from "@/api/team";
import { useProfileCompletionGate } from "../useProfileCompletionGate";

// 球队邀请落地页：凭分享携带的邀请码换取球队公开信息并申请加入。
export function useTeamInvitePage() {
  const { currentUser, ensureSessionReady, refreshSessionContext } = useTeamContext();
  const profileGate = useProfileCompletionGate();
  const navMetrics = getCustomNavMetrics();

  const code = ref("");
  const team = ref<AppTeamInviteView | null>(null);
  const resolving = ref(true);
  const errorMessage = ref("");
  const joinPassword = ref("");
  const joining = ref(false);
  let successUserId: number | undefined;
  const joined = ref(false);
  let resolveVersion = 0;
  watch(() => currentUser.value?.id, (id, previousId) => {
    if (id === previousId) return;
    if (successUserId && !hasManualLogout() && (!id || id === successUserId)) return;
    successUserId = undefined;
    joined.value = false;
    team.value = null;
    joinPassword.value = "";
    profileGate.handleProfileGateCancel();
    if (id) void resolveInvite();
  });

  const pageStyle = computed(() => ({ paddingTop: `${navMetrics.pageTopPadding + 8}px` }));
  const requiresPassword = computed(() => team.value?.requires_password ?? false);
  const canSubmit = computed(
    () => !!team.value && !resolving.value && !joined.value && !team.value.is_member && !joining.value && (!requiresPassword.value || !!joinPassword.value.trim()),
  );

  async function resolveInvite() {
    if (!code.value) {
      errorMessage.value = "邀请链接无效";
      resolving.value = false;
      return;
    }
    const version = ++resolveVersion;
    resolving.value = true;
    errorMessage.value = "";
    try {
      await ensureSessionReady();
      const result = await resolveTeamInviteCode(code.value);
      if (version === resolveVersion) team.value = result;
    } catch (error) {
      if (version !== resolveVersion) return;
      errorMessage.value = error instanceof Error ? error.message : "邀请码解析失败";
    } finally {
      if (version === resolveVersion) resolving.value = false;
    }
  }

  async function handleJoin() {
    if (!team.value || joining.value || !canSubmit.value) return;
    const teamId = team.value.team_id;
    const userId = currentUser.value?.id;
    const password = joinPassword.value.trim() || undefined;
    joining.value = true;
    try {
      if (!(await profileGate.ensureProfileComplete())) return;
      if (userId !== currentUser.value?.id || team.value?.team_id !== teamId) return;
      await joinTeam({
        team_id: teamId,
        password,
      });
      if (userId !== currentUser.value?.id) return;
      successUserId = userId;
      joined.value = true;
      joinPassword.value = "";
      try {
        await refreshSessionContext();
      } catch {
        uni.showToast({ title: "已加入球队，球队列表稍后刷新", icon: "none" });
      }
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "加入球队失败", icon: "none" });
    } finally {
      joining.value = false;
    }
  }

  // 刷新失败可暂时清空会话；成功结果仍属于原账号，不能因此再次提交。
  async function restoreSuccessAccount(): Promise<boolean> {
    const ownerId = successUserId || currentUser.value?.id;
    if (hasManualLogout()) {
      successUserId = undefined;
      joined.value = false;
      team.value = null;
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

  async function goTeamDetail() {
    if (!team.value || !(await restoreSuccessAccount())) return;
    uni.redirectTo({ url: `/pages/teams/detail/index?teamId=${team.value.team_id}` });
  }

  async function goFindMatches() {
    if (!(await restoreSuccessAccount())) return;
    uni.switchTab({ url: "/pages/activities/index" });
  }

  function goHome() {
    uni.switchTab({ url: "/pages/home/index" });
  }

  usePageRefresh(resolveInvite);

  onShow(() => {
    if (hasManualLogout()) void restoreSuccessAccount();
  });

  onLoad((options) => {
    code.value = decodeURIComponent(options?.code ?? "");
    void resolveInvite();
  });

  return {
    pageStyle,
    team,
    resolving,
    errorMessage,
    joinPassword,
    requiresPassword,
    joining,
    joined,
    canSubmit,
    profileGateVisible: profileGate.profileGateVisible,
    handleProfileGateCompleted: profileGate.handleProfileGateCompleted,
    handleProfileGateCancel: profileGate.handleProfileGateCancel,
    handleJoin,
    goTeamDetail,
    goHome,
    goFindMatches,
    resolveInvite,
  };
}
