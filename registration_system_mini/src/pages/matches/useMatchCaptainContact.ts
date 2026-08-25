import { ref } from "vue";
import { sendCaptainMessage } from "@/api/captainMessage";

/** 比赛详情页「联系队长」弹窗的输入与提交状态。 */
export function useMatchCaptainContact() {
  const popupVisible = ref(false);
  const content = ref("");
  const isSubmitting = ref(false);

  function open() {
    content.value = "";
    popupVisible.value = true;
  }

  function close() {
    if (isSubmitting.value) return;
    popupVisible.value = false;
  }

  async function submit(matchId: string) {
    const trimmed = content.value.trim();
    if (!trimmed) {
      uni.showToast({ title: "留言内容不能为空", icon: "none" });
      return;
    }
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    try {
      await sendCaptainMessage(matchId, trimmed);
      popupVisible.value = false;
      content.value = "";
      uni.showToast({ title: "已发送，回复见消息中心", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "留言发送失败", icon: "none" });
    } finally {
      isSubmitting.value = false;
    }
  }

  return { popupVisible, content, isSubmitting, open, close, submit };
}
