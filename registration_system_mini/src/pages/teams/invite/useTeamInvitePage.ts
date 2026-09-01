import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useTeamContext } from "@/stores/teamContext";
import { joinTeam, resolveTeamInviteCode, type AppTeamInviteView } from "@/api/team";
import { useProfileCompletionGate } from "../useProfileCompletionGate";

// 球队邀请落地页：凭分享携带的邀请码换取球队公开信息并申请加入。
export function useTeamInvitePage() {
  const { ensureSessionReady, refreshSessionContext } = useTeamContext();
  const profileGate = useProfileCompletionGate();
  const navMetrics = getCustomNavMetrics();

  const code = ref("");
  const team = ref<AppTeamInviteView | null>(null);
  const resolving = ref(true);
  const errorMessage = ref("");
  const joinPassword = ref("");
  const joining = ref(false);
  const joined = ref(false);

  const pageStyle = computed(() => ({ paddingTop: `${navMetrics.pageTopPadding + 8}px` }));
  const requiresPassword = computed(() => team.value?.requires_password ?? false);
  const canSubmit = computed(
    () => !!team.value && !joining.value && (!requiresPassword.value || !!joinPassword.value.trim()),
  );

  async function resolveInvite() {
    if (!code.value) {
      errorMessage.value = "邀请链接无效";
      resolving.value = false;
      return;
    }
    resolving.value = true;
    errorMessage.value = "";
    try {
      await ensureSessionReady();
      team.value = await resolveTeamInviteCode(code.value);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "邀请码解析失败";
    } finally {
      resolving.value = false;
    }
  }

  async function handleJoin() {
    if (!team.value || joining.value || !canSubmit.value) return;
    // 昵称/头像缺失时先弹框完善资料，保存成功后才继续加入。
    if (!(await profileGate.ensureProfileComplete())) return;
    joining.value = true;
    try {
      await joinTeam({
        team_id: team.value.team_id,
        password: joinPassword.value.trim() || undefined,
      });
      joined.value = true;
      await refreshSessionContext();
      uni.showToast({ title: "已加入球队", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "加入球队失败", icon: "none" });
    } finally {
      joining.value = false;
    }
  }

  function goTeamDetail() {
    if (!team.value) return;
    uni.redirectTo({ url: `/pages/teams/detail/index?teamId=${team.value.team_id}` });
  }

  function goHome() {
    uni.switchTab({ url: "/pages/home/index" });
  }

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
    resolveInvite,
  };
}
