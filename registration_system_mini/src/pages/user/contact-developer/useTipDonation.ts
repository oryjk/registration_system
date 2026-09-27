import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { createTipOrder, submitDeveloperFeedback, syncGoPaymentOrder } from "@/api/payment";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
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
  const dialog = useConfirmDialog();

  const amountInput = ref("");
  const suggestionInput = ref("");
  const isSubmitting = ref(false);
  const isSubmittingSuggestion = ref(false);
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
      title: "谢谢你的支持",
      content: `已收到你的 ${(amountCents / 100).toFixed(2)} 元支持。每一份认可都会变成继续维护、修复问题和开发新功能的动力。`,
      confirmText: "继续加油",
      cancelText: "",
    });
  }

  async function submitSuggestion() {
    if (isSubmittingSuggestion.value) return;
    if (!isLoggedIn.value) {
      uni.showToast({ title: "请先登录后提交建议", icon: "none" });
      return;
    }
    const content = suggestionInput.value.trim().slice(0, TIP_SUGGESTION_MAX_LENGTH);
    if (!content) {
      uni.showToast({ title: "写下你的建议再提交吧", icon: "none" });
      return;
    }
    isSubmittingSuggestion.value = true;
    try {
      await submitDeveloperFeedback({ content });
      suggestionInput.value = "";
      uni.showToast({ title: "建议已收到，谢谢你", icon: "success" });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "提交失败，请稍后再试",
        icon: "none",
      });
    } finally {
      isSubmittingSuggestion.value = false;
    }
  }

  async function submitTipDonation() {
    if (isSubmitting.value) return;
    if (!isLoggedIn.value) {
      uni.showToast({ title: "请先登录后再打赏", icon: "none" });
      return;
    }
    const amountCents = validateAmountCents();
    if (amountCents === null) return;
    isSubmitting.value = true;
    try {
      const result = await createTipOrder({ amount_cents: amountCents });
      const params = result.payment ? normalizeWxPaymentParams(result.payment) : null;
      if (params && !isMockWxPaymentParams(params)) {
        await requestWxPayment(params);
      }
      const synced = await syncGoPaymentOrder(result.order.order_no);
      if (synced.order.status === "paid") {
        amountInput.value = "";
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
    isSubmittingSuggestion,
    isLoggedIn,
    suggestionMaxLength: TIP_SUGGESTION_MAX_LENGTH,
    submitSuggestion,
    submitTipDonation,
    dialog,
  };
}
