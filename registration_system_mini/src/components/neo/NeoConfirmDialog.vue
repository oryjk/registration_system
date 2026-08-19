<script setup lang="ts">
import { computed } from "vue";
import NeoButton from "./NeoButton.vue";

export type NeoConfirmDialogTone = "accent" | "danger";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    title: string;
    message?: string;
    /** message 中需要醒目展示的片段，命中后以高亮样式渲染。 */
    highlight?: string;
    /** message 中需要可点击跳转的片段（与 highlight 互斥，优先命中），命中后以链接样式渲染。 */
    linkText?: string;
    primaryText?: string;
    secondaryText?: string;
    primaryTone?: NeoConfirmDialogTone;
    loading?: boolean;
  }>(),
  {
    message: "",
    highlight: "",
    linkText: "",
    primaryText: "确认",
    secondaryText: "再想想",
    primaryTone: "accent",
    loading: false,
  },
);

const messageParts = computed(() => {
  const link = props.linkText.trim();
  if (link) {
    const index = props.message.indexOf(link);
    if (index >= 0) {
      return {
        before: props.message.slice(0, index),
        after: props.message.slice(index + link.length),
        segment: link,
        kind: "link" as const,
      };
    }
  }
  const highlight = props.highlight.trim();
  if (!highlight) return null;
  const index = props.message.indexOf(highlight);
  if (index < 0) return null;
  return {
    before: props.message.slice(0, index),
    after: props.message.slice(index + highlight.length),
    segment: highlight,
    kind: "highlight" as const,
  };
});

const emit = defineEmits<{
  (event: "primary"): void;
  (event: "secondary"): void;
  /** 遮罩 / 右上角关闭：只收起弹框，不触发次要按钮的业务含义。 */
  (event: "close"): void;
  /** message 中链接片段（linkText）被点击。 */
  (event: "link"): void;
}>();

function handleSecondary() {
  if (!props.loading && props.secondaryText) emit("secondary");
}

function handleClose() {
  if (!props.loading) emit("close");
}
</script>

<template>
  <view v-if="visible" class="neo-confirm-dialog-mask" @tap="handleClose">
    <view class="neo-confirm-dialog" @tap.stop>
      <view class="neo-confirm-dialog-head">
        <view class="neo-confirm-dialog-texts">
          <text class="neo-confirm-dialog-title">{{ title }}</text>
          <text v-if="message" class="neo-confirm-dialog-message"><template v-if="messageParts">{{ messageParts.before }}<text v-if="messageParts.kind === 'link'" class="neo-confirm-dialog-link" @tap.stop="emit('link')">{{ messageParts.segment }}</text><text v-else class="neo-confirm-dialog-highlight">{{ messageParts.segment }}</text>{{ messageParts.after }}</template><template v-else>{{ message }}</template></text>
        </view>
        <view class="neo-confirm-dialog-close" @tap="handleClose">×</view>
      </view>
      <view :class="['neo-confirm-dialog-actions', secondaryText ? '' : 'neo-confirm-dialog-actions-single']">
        <NeoButton v-if="secondaryText" variant="outline" block :disabled="loading" @click="handleSecondary">
          {{ secondaryText }}
        </NeoButton>
        <NeoButton
          :variant="primaryTone === 'danger' ? 'danger' : 'lime'"
          block
          :loading="loading"
          :disabled="loading"
          @click="emit('primary')"
        >
          {{ loading ? "提交中..." : primaryText }}
        </NeoButton>
      </view>
    </view>
  </view>
</template>

<style scoped>
.neo-confirm-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background: rgba(11, 14, 10, 0.34);
  box-sizing: border-box;
  animation: neo-confirm-dialog-mask-fade-in 220ms ease;
}

.neo-confirm-dialog {
  width: 100%;
  max-width: 620rpx;
  padding: 34rpx 32rpx 32rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-surface-bg);
  box-shadow: var(--neo-surface-shadow);
  box-sizing: border-box;
  animation: neo-confirm-dialog-enter 240ms cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: center center;
}

.neo-confirm-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.neo-confirm-dialog-title {
  display: block;
  color: var(--neo-color-text);
  font-size: 36rpx;
  line-height: 46rpx;
  font-weight: 900;
}

.neo-confirm-dialog-message {
  display: block;
  margin-top: 14rpx;
  color: var(--neo-color-text-muted);
  font-size: 28rpx;
  line-height: 42rpx;
  font-weight: 700;
}

.neo-confirm-dialog-highlight {
  padding: 0 8rpx;
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-weight: 900;
}

/* 链接片段沿用场馆链接先例：主文字色 + 下划线，靠下划线传达可点击。 */
.neo-confirm-dialog-link {
  color: var(--neo-color-text);
  font-weight: 900;
  text-decoration: underline;
  text-underline-offset: 6rpx;
}

.neo-confirm-dialog-close {
  width: 56rpx;
  height: 56rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-round);
  background: var(--neo-surface-bg);
  color: var(--neo-color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  line-height: 1;
  flex-shrink: 0;
  box-sizing: border-box;
}

.neo-confirm-dialog-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 30rpx;
}

/* 纯提示类弹窗（secondaryText 传空）只保留主按钮，改为单列。 */
.neo-confirm-dialog-actions-single {
  grid-template-columns: 1fr;
}

@keyframes neo-confirm-dialog-mask-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes neo-confirm-dialog-enter {
  from {
    opacity: 0;
    transform: translateY(26rpx) scale(0.94);
  }

  70% {
    opacity: 1;
    transform: translateY(-4rpx) scale(1.01);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
