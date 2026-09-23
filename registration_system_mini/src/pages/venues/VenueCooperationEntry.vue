<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";
import { prefersReducedMotion } from "@/utils/reducedMotion";
import { DEVELOPER_WECHAT_QRCODE_URL } from "@/utils/developerContact";

const emit = defineEmits<{ (event: "presence", rendered: boolean): void }>();
const visible = ref(false);
const { rendered } = useOverlayPresence(visible, { leaveDurationMs: () => prefersReducedMotion() ? 0 : 210 });
watch(rendered, value => emit("presence", value));
onUnmounted(() => emit("presence", false));
function previewCode() {
  uni.previewImage({
    urls: [DEVELOPER_WECHAT_QRCODE_URL],
    current: DEVELOPER_WECHAT_QRCODE_URL,
    fail: () => uni.showToast({ title: "图片打开失败，请重试", icon: "none" }),
  });
}
</script>

<template>
  <view class="venue-cooperation">
    <button class="venue-cooperation-entry" hover-class="venue-cooperation-entry--pressed" @tap="visible = true">
      <view class="venue-cooperation-icon"><wd-icon name="location" size="30rpx" /></view>
      <view class="venue-cooperation-copy">
        <text class="venue-cooperation-title">场馆入驻</text>
        <text class="venue-cooperation-hint">创建场地 · 商务合作</text>
      </view>
      <text class="venue-cooperation-link">联系合作 →</text>
    </button>
    <ConfirmDialog
      :visible="visible"
      borderless
      title="场馆入驻与合作"
      message="想让更多球队找到你的场馆？添加微信，联系开通场地、入驻展示及商务合作。请备注「场馆名称＋合作」。"
      :image-src="DEVELOPER_WECHAT_QRCODE_URL"
      image-caption="可查看大图并保存，再用微信扫一扫从相册识别添加好友。"
      primary-text="查看大图"
      secondary-text="关闭"
      @primary="previewCode"
      @secondary="visible = false"
      @close="visible = false"
    />
  </view>
</template>

<style scoped>
.venue-cooperation { flex-shrink: 0; padding: 0 28rpx calc(env(safe-area-inset-bottom) + 12rpx); background: var(--ui-color-surface); }
.venue-cooperation-entry { display: flex; align-items: center; gap: 16rpx; width: 100%; min-height: 92rpx; padding: 16rpx 0; margin: 0; border: 0; border-top: var(--ui-border-default); border-radius: 0; background: transparent; color: var(--ui-color-text); line-height: 1.4; text-align: left; }
.venue-cooperation-entry::after { border: 0; }
.venue-cooperation-entry--pressed { opacity: 0.7; }
.venue-cooperation-icon { display: flex; align-items: center; justify-content: center; width: 52rpx; height: 52rpx; flex-shrink: 0; border-radius: var(--ui-radius-button); background: var(--ui-color-accent-soft); color: var(--ui-color-accent-deep); }
.venue-cooperation-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.venue-cooperation-title { font-size: 24rpx; font-weight: var(--ui-font-weight-heading); }
.venue-cooperation-hint { font-size: 22rpx; color: var(--ui-color-text-muted); }
.venue-cooperation-link { flex-shrink: 0; font-size: 24rpx; }
</style>
