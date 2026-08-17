import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { getAppTeamDetail, type AppTeamDetailData } from "@/api/team";
import { createTeamMembershipOrder, syncGoPaymentOrder } from "@/api/payment";
import { isMockWxPaymentParams, isPaymentCancelled, normalizeWxPaymentParams, requestWxPayment } from "@/utils/payment";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";

/** 单笔队费金额上限（分）：1 万元，与后端 MembershipMaxAmountCents 一致，防止误操作天价订单。 */
export const MEMBERSHIP_MAX_AMOUNT_CENTS = 1_000_000;

const ROLE_LABELS: Record<string, string> = {
  captain: "队长",
  leader: "领队",
  vice_captain: "副队长",
  member: "队员",
};

export function useTeamDetailPage() {
  const { switchTeam } = useTeamContext();
  const navMetrics = getCustomNavMetrics();
  const teamId = ref(0);
  const team = ref<AppTeamDetailData | null>(null);
  const isLoading = ref(false);
  const errorMessage = ref("");
  const paying = ref(false);
  const amountInput = ref("");

  const pageStyle = computed(() => ({
    paddingTop: `${navMetrics.pageTopPadding + 8}px`,
  }));
  const roleLabel = computed(() => ROLE_LABELS[team.value?.my_role ?? ""] ?? "成员");
  const canManage = computed(() => team.value?.my_role === "captain" || team.value?.my_role === "leader");
  const amountCents = computed(() => {
    const yuan = Number(amountInput.value);
    if (!amountInput.value.trim() || !Number.isFinite(yuan)) return 0;
    return Math.round(yuan * 100);
  });
  const amountError = computed(() => {
    if (!amountInput.value.trim()) return "";
    if (amountCents.value < 1) return "金额需大于 0";
    if (amountCents.value > MEMBERSHIP_MAX_AMOUNT_CENTS) return "单笔队费不能超过 1 万元";
    return "";
  });
  const totalPriceLabel = computed(() => {
    const yuan = amountCents.value / 100;
    return `¥${Number.isInteger(yuan) ? yuan : yuan.toFixed(2)}`;
  });
  const balanceLabel = computed(() => {
    const yuan = (team.value?.balance_cents ?? 0) / 100;
    return `¥${Number.isInteger(yuan) ? yuan : yuan.toFixed(2)}`;
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

  async function handleMembershipPayment() {
    if (!team.value || paying.value) return;
    if (!canManage.value) {
      uni.showToast({ title: "只有队长或领队可以缴纳队费", icon: "none" });
      return;
    }
    if (amountError.value) {
      uni.showToast({ title: amountError.value, icon: "none" });
      return;
    }
    if (amountCents.value < 1) {
      uni.showToast({ title: "请输入缴纳金额", icon: "none" });
      return;
    }
    paying.value = true;
    try {
      const order = await createTeamMembershipOrder({
        team_id: team.value.id,
        amount_cents: amountCents.value,
      });
      const paymentParams = normalizeWxPaymentParams(order.payment);
      if (paymentParams && !isMockWxPaymentParams(paymentParams)) {
        await requestWxPayment(paymentParams);
      }
      const synced = await syncGoPaymentOrder(order.order.order_no);
      await loadTeam();
      uni.showToast({
        title: synced.order.status === "paid" ? "队费缴纳成功" : "支付处理中，到账后自动生效",
        icon: "none",
      });
    } catch (error) {
      if (isPaymentCancelled(error)) {
        uni.showToast({ title: "已取消支付", icon: "none" });
      } else {
        uni.showToast({ title: error instanceof Error ? error.message : "队费缴纳失败", icon: "none" });
      }
    } finally {
      paying.value = false;
    }
  }

  onLoad((options) => {
    teamId.value = Number(options?.teamId ?? 0);
  });

  onShow(() => {
    if (teamId.value) void loadTeam();
  });

  return {
    pageStyle,
    team,
    isLoading,
    errorMessage,
    paying,
    amountInput,
    amountError,
    balanceLabel,
    roleLabel,
    canManage,
    totalPriceLabel,
    membershipLabel,
    loadTeam,
    openTeamManage,
    handleMembershipPayment,
  };
}
