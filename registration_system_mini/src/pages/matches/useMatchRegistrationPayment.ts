import { computed, ref } from "vue";
import type { ComputedRef, Ref } from "vue";
import { createMatchRegistrationOrder, syncGoPaymentOrder } from "@/api/payment";
import { isMockWxPaymentParams, isPaymentCancelled, normalizeWxPaymentParams, requestWxPayment } from "@/utils/payment";
import type { BackendActivity } from "@/types/backend";
import type { AppMatchSummary } from "@/types/match";

interface MatchRegistrationPaymentDependencies {
  match: Ref<BackendActivity | null>;
  sourceMatch: Ref<AppMatchSummary | null>;
  currentStatus: Ref<string>;
}

// 赛前支付的报名费：报名（attending）成功后立即拉起支付；支付前详情页展示「去支付」入口。
// 取消/失败时报名保留（占位防超卖），用户可稍后继续支付或取消报名。
export function useMatchRegistrationPayment(dependencies: MatchRegistrationPaymentDependencies) {
  const { match, sourceMatch, currentStatus } = dependencies;

  const myRegistrationPaid = ref(false);
  const submittingPayment = ref(false);
  const requiresPrepaidPayment = computed(() =>
    sourceMatch.value?.payment_mode === "prepaid" && (sourceMatch.value?.fee_per_person_cents ?? 0) > 0,
  );
  const pendingPaymentFeeLabel = computed(() => {
    if (!requiresPrepaidPayment.value || currentStatus.value !== "参加" || myRegistrationPaid.value) return "";
    return `¥${((sourceMatch.value?.fee_per_person_cents ?? 0) / 100).toFixed(2)}`;
  });

  function applyMyRegistrationPaid(paid: boolean) {
    myRegistrationPaid.value = paid;
  }

  async function payRegistrationFee() {
    const matchId = match.value?.id;
    if (!matchId || submittingPayment.value) return false;
    submittingPayment.value = true;
    try {
      const result = await createMatchRegistrationOrder({ match_id: matchId });
      const params = result.payment ? normalizeWxPaymentParams(result.payment) : null;
      if (params && !isMockWxPaymentParams(params)) {
        await requestWxPayment(params);
      }
      const synced = await syncGoPaymentOrder(result.order.order_no);
      if (synced.order.status === "paid") {
        myRegistrationPaid.value = true;
        uni.$emit("home:data-may-changed");
        uni.showToast({ title: "支付完成", icon: "none" });
        return true;
      }
      uni.showToast({ title: "支付已提交，稍后自动确认", icon: "none", duration: 2600 });
      return true;
    } catch (error) {
      if (isPaymentCancelled(error)) {
        uni.showToast({ title: "已取消支付，报名已保留", icon: "none", duration: 2600 });
        return false;
      }
      uni.showToast({
        title: error instanceof Error ? error.message : "支付失败，可稍后继续支付",
        icon: "none",
        duration: 2600,
      });
      return false;
    } finally {
      submittingPayment.value = false;
    }
  }

  return {
    myRegistrationPaid,
    submittingPayment,
    requiresPrepaidPayment,
    pendingPaymentFeeLabel,
    applyMyRegistrationPaid,
    payRegistrationFee,
  };
}
