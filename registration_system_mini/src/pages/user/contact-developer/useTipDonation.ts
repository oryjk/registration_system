import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { createTipOrder, syncGoPaymentOrder } from "@/api/payment";
import { useNeoConfirmDialog } from "@/components/neo/useNeoConfirmDialog";
import { useTeamContext } from "@/stores/teamContext";
import { isMockWxPaymentParams, isPaymentCancelled, normalizeWxPaymentParams, requestWxPayment } from "@/utils/payment";

/** 打赏金额不设范围限制，仅要求是正数（1 分起，微信支付下限）。 */
const TIP_SUGGESTION_MAX_LENGTH = 500;

/** 元字符串 → 分；输入非数字或超过两位小数时返回 null。 */
export function parseYuanToCents(input: string): number | null {
  const text = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(parseFloat(text) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** "请开发者喝咖啡"打赏：金额校验、可选功能建议、下单拉起支付、成功后感谢反馈。 */
export function useTipDonation() {
  const { currentUser, ensureSessionReady } = useTeamContext();
  const dialog = useNeoConfirmDialog();

  const amountInput = ref("");
  const suggestionInput = ref("");
  const isSubmitting = ref(false);
  const isLoggedIn = computed(() => Boolean(currentUser.value));

  onShow(() => {
    void ensureSessionReady();
  });

  function validateAmountCents(): number | null {
    const cents = parseYuanToCents(amountInput.value);
    if (cents === null) {
      uni.showToast({ title: "请输入正确金额，最多两位小数", icon: "none" });
      return null;
    }
    if (cents < 1) {
      uni.showToast({ title: "金额需大于 0 元", icon: "none" });
      return null;
    }
    return cents;
  }

  function showThankYou(amountCents: number) {
    void dialog.confirm({
      title: "多谢请客！",
      content: `已收到你的 ${(amountCents / 100).toFixed(2)} 元咖啡钱，开发者会带着咖啡继续用心迭代。${
        suggestionInput.value.trim() ? "你的功能建议我也会认真看。" : ""
      }`,
      confirmText: "不客气",
      cancelText: "",
    });
  }

  async function submitTipDonation() {
    if (isSubmitting.value) return;
    if (!isLoggedIn.value) {
      uni.showToast({ title: "请先登录后再打赏", icon: "none" });
      return;
    }
    const amountCents = validateAmountCents();
    if (amountCents === null) return;
    const suggestion = suggestionInput.value.trim().slice(0, TIP_SUGGESTION_MAX_LENGTH);

    isSubmitting.value = true;
    try {
      const result = await createTipOrder({ amount_cents: amountCents, suggestion: suggestion || undefined });
      const params = result.payment ? normalizeWxPaymentParams(result.payment) : null;
      if (params && !isMockWxPaymentParams(params)) {
        await requestWxPayment(params);
      }
      const synced = await syncGoPaymentOrder(result.order.order_no);
      if (synced.order.status === "paid") {
        amountInput.value = "";
        suggestionInput.value = "";
        showThankYou(amountCents);
        return;
      }
      uni.showToast({ title: "支付已提交，稍后自动确认", icon: "none", duration: 2600 });
    } catch (error) {
      if (isPaymentCancelled(error)) {
        uni.showToast({ title: "已取消支付", icon: "none", duration: 2600 });
        return;
      }
      uni.showToast({
        title: error instanceof Error ? error.message : "支付失败，请稍后再试",
        icon: "none",
        duration: 2600,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    amountInput,
    suggestionInput,
    isSubmitting,
    isLoggedIn,
    suggestionMaxLength: TIP_SUGGESTION_MAX_LENGTH,
    submitTipDonation,
    dialog,
  };
}
