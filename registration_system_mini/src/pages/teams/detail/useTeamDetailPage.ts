import { computed, getCurrentInstance, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { getAppTeamDetail, issueTeamInviteCode, leaveTeam, type AppTeamDetailData } from "@/api/team";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { composeTeamInviteShareImage } from "@/utils/shareCompose";

const ROLE_LABELS: Record<string, string> = {
  captain: "队长",
  leader: "领队",
  vice_captain: "副队长",
  member: "队员",
};

/** 分享封面合成画布的节点 id，与页面模板中的隐藏 canvas 保持一致。 */
export const TEAM_SHARE_CANVAS_ID = "team-share-canvas";

export function useTeamDetailPage() {
  const { switchTeam, refreshSessionContext } = useTeamContext();
  const navMetrics = getCustomNavMetrics();
  // getCurrentInstance 只能在 setup 同步上下文调用；异步合成分享图时复用该实例。
  const pageInstance = getCurrentInstance();
  const teamId = ref(0);
  const team = ref<AppTeamDetailData | null>(null);
  const isLoading = ref(false);
  const errorMessage = ref("");

  const pageStyle = computed(() => ({
    paddingTop: `${navMetrics.pageTopPadding + 8}px`,
  }));
  const roleLabel = computed(() => ROLE_LABELS[team.value?.my_role ?? ""] ?? "成员");
  const canManage = computed(() => team.value?.my_role === "captain" || team.value?.my_role === "leader");
  /** 球队基本信息：logo 缺省时由模板回落到首字徽标。 */
  const logoUrl = computed(() => team.value?.logo_url?.trim() || "");
  const description = computed(() => team.value?.description?.trim() || "");
  const createdLabel = computed(() => team.value?.created_at?.slice(0, 10) || "");
  /** 我在本队的个人账户余额；队费充值计入这里，不是球队公共余额。 */
  const balanceLabel = computed(() => {
    const yuan = (team.value?.my_balance_cents ?? 0) / 100;
    return `${Number.isInteger(yuan) ? yuan : yuan.toFixed(2)}`;
  });
  const membershipLabel = computed(() => {
    if (!team.value?.is_vip || !team.value.vip_until) return "未开通会员";
    return `会员有效 · 至 ${team.value.vip_until.slice(0, 10)}`;
  });

  async function loadTeam() {
    if (!teamId.value) return;
    isLoading.value = true;
    errorMessage.value = "";
    try {
      const detail = await getAppTeamDetail(teamId.value);
      team.value = detail;
      if (detail.my_role) void loadInviteCode();
      void loadShareImage(logoUrl.value);
      syncShareMenu(detail.my_role === "captain" || detail.my_role === "leader");
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "球队信息加载失败";
    } finally {
      isLoading.value = false;
    }
  }

  function openTeamManage() {
    if (!team.value || !canManage.value) {
      uni.showToast({ title: "只有队长或领队可以管理球队", icon: "none" });
      return;
    }
    switchTeam(team.value.id);
    uni.navigateTo({ url: "/pages/teams/manage/index" });
  }

  function openTeamFund() {
    if (!team.value) return;
    uni.navigateTo({ url: `/pages/teams/fund/index?teamId=${team.value.id}` });
  }

  onLoad((options) => {
    teamId.value = Number(options?.teamId ?? 0);
  });

  onShow(() => {
    if (teamId.value) void loadTeam();
  });

  const leaveDialogVisible = ref(false);
  // 非成员（my_role 为空）与队长不展示退出入口；队长需先移交或解散。
  const canLeaveTeam = computed(() => !!team.value?.my_role && team.value?.my_role !== "captain");

  // 分享邀请码：成员加载详情后预取（onShareAppMessage 是同步回调，不能现场请求）。
  // 失败不影响页面，只是分享出去的落地页会提示邀请失效。
  const inviteCode = ref("");

  // 有队徽时预合成「封面 + 圆形队徽」的分享图（临时文件路径）；onShareAppMessage 同样是
  // 同步回调，合成未完成或失败时回落静态封面。每次会话只合成一次。
  const shareImagePath = ref("");

  async function loadShareImage(logoUrl: string) {
    if (shareImagePath.value || !logoUrl) return;
    // #ifdef MP-WEIXIN
    try {
      shareImagePath.value = await composeTeamInviteShareImage(TEAM_SHARE_CANVAS_ID, pageInstance, logoUrl);
    } catch {
      // 合成失败静默回落静态封面，不打扰页面。
    }
    // #endif
  }

  async function loadInviteCode() {
    if (!team.value?.id) return;
    try {
      inviteCode.value = (await issueTeamInviteCode(team.value.id)).code;
    } catch {
      inviteCode.value = "";
    }
  }

  // 邀请分享仅队长/领队可用：其他人隐藏转发菜单，避免发出无邀请码的无效卡片。
  function syncShareMenu(canShare: boolean) {
    if (canShare) {
      uni.showShareMenu({ withShareTicket: false, menus: ["shareAppMessage", "shareTimeline"] });
    } else {
      uni.hideShareMenu({ hideShareItems: ["shareAppMessage", "shareTimeline"] });
    }
  }

  function handleLeaveTeamClick() {
    if (!canLeaveTeam.value) return;
    if ((team.value?.my_balance_cents ?? 0) !== 0) {
      uni.showToast({ title: `队费余额 ${balanceLabel.value} 不为零，需结清后才能退出`, icon: "none" });
      return;
    }
    leaveDialogVisible.value = true;
  }

  async function handleLeaveTeamConfirm() {
    if (!team.value) return;
    try {
      await leaveTeam(team.value.id);
      leaveDialogVisible.value = false;
      uni.showToast({ title: "已退出球队", icon: "none" });
      await refreshSessionContext();
      setTimeout(() => uni.navigateBack(), 400);
    } catch (error) {
      leaveDialogVisible.value = false;
      uni.showToast({ title: error instanceof Error ? error.message : "退出球队失败", icon: "none" });
    }
  }

  return {
    pageStyle,
    team,
    isLoading,
    errorMessage,
    balanceLabel,
    roleLabel,
    canManage,
    canLeaveTeam,
    logoUrl,
    description,
    createdLabel,
    inviteCode,
    shareImagePath,
    leaveDialogVisible,
    handleLeaveTeamClick,
    handleLeaveTeamConfirm,
    membershipLabel,
    loadTeam,
    openTeamManage,
    openTeamFund,
  };
}
