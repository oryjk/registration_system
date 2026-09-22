<script setup lang="ts">
import { computed } from "vue";
import AppButton from "./AppButton.vue";
import { useOverlayPresence } from "./useOverlayPresence";
import { prefersReducedMotion } from "@/utils/reducedMotion";

export type ConfirmDialogTone = "accent" | "danger";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    title: string;
    message?: string;
    /** message 中需要醒目展示的片段，命中后以高亮样式渲染。 */
    highlight?: string;
    /** message 中需要可点击跳转的片段（与 highlight 互斥，优先命中），命中后以链接样式渲染。 */
    linkText?: string;
    /** message 下方的可点击链接列表（如"去取消约队"）；点击触发 link-item 事件并关闭弹窗。 */
    linkItems?: string[];
    /** message 下方展示的图片（如微信联系二维码），宽度固定、等比缩放。 */
    imageSrc?: string;
    /** 第一张图片下方的说明文字（如"加开发者微信"）。 */
    imageCaption?: string;
    /** 第二张图片；与 imageSrc 同时提供时双图并排展示（如公众号二维码）。 */
    secondImageSrc?: string;
    /** 第二张图片下方的说明文字。 */
    secondImageCaption?: string;
    primaryIcon?: string;
    secondaryIcon?: string;
    primaryText?: string;
    secondaryText?: string;
    primaryTone?: ConfirmDialogTone;
    loading?: boolean;
    /** 额外禁用主按钮（如表单未填完），loading 时始终禁用。 */
    primaryDisabled?: boolean;
  }>(),
  {
    message: "",
    highlight: "",
    linkText: "",
    linkItems: () => [],
    imageSrc: "",
    imageCaption: "",
    secondImageSrc: "",
    secondImageCaption: "",
    primaryText: "确认",
    secondaryText: "再想想",
    primaryTone: "accent",
    loading: false,
    primaryDisabled: false,
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

// 退场时序：visible 关闭后保留 DOM 播放退场动画并维持遮罩拦截（防点穿），
// 动画结束后移除；快速关开不会误关新弹层。时长与 --ui-motion-overlay-duration 一致，
// 关闭时刻实时读取"减少动态效果"，系统设置切换后立即生效。
const { rendered, leaving } = useOverlayPresence(
  computed(() => props.visible),
  { leaveDurationMs: () => prefersReducedMotion() ? 0 : 210 },
);

const emit = defineEmits<{
  (event: "primary"): void;
  (event: "secondary"): void;
  /** 遮罩 / 右上角关闭：只收起弹框，不触发次要按钮的业务含义。 */
  (event: "close"): void;
  /** message 中链接片段（linkText）被点击。 */
  (event: "link"): void;
  /** linkItems 列表项被点击，参数为下标。 */
  (event: "link-item", index: number): void;
}>();

function handleSecondary() {
  if (!props.loading && !leaving.value && props.secondaryText) emit("secondary");
}

function handleClose() {
  if (!props.loading && !leaving.value) emit("close");
}
</script>

<template>
  <view
    v-if="rendered"
    :class="['ui-confirm-dialog-mask', leaving ? 'ui-confirm-dialog-mask--leaving' : '']"
    @tap="handleClose"
  >
    <view :class="['ui-confirm-dialog', leaving ? 'ui-confirm-dialog--leaving' : '']" @tap.stop>
      <view class="ui-confirm-dialog-head">
        <view class="ui-confirm-dialog-texts">
          <text class="ui-confirm-dialog-title">{{ title }}</text>
          <text v-if="message" class="ui-confirm-dialog-message"><template v-if="messageParts">{{ messageParts.before }}<text v-if="messageParts.kind === 'link'" class="ui-confirm-dialog-link" @tap.stop="emit('link')">{{ messageParts.segment }}</text><text v-else class="ui-confirm-dialog-highlight">{{ messageParts.segment }}</text>{{ messageParts.after }}</template><template v-else>{{ message }}</template></text>
        </view>
        <view class="ui-confirm-dialog-close" @tap="handleClose">×</view>
      </view>
      <!-- 链接列表（如解散球队的阻塞项处理入口）：整行可点，点击后由外层关闭弹窗并跳转。 -->
      <view v-if="linkItems.length" class="ui-confirm-dialog-links">
        <text
          v-for="(item, index) in linkItems"
          :key="index"
          class="ui-confirm-dialog-link-item"
          @tap.stop="emit('link-item', index)"
        >{{ item }}</text>
      </view>
      <!-- 双图并排（如微信 + 公众号二维码）；两张码必须各自独立 image，合成长图微信长按识别不了。 -->
      <view v-if="imageSrc && secondImageSrc" class="ui-confirm-dialog-images">
        <view class="ui-confirm-dialog-image-item">
          <image
            class="ui-confirm-dialog-image ui-confirm-dialog-image-pair"
            :src="imageSrc"
            mode="widthFix"
            :show-menu-by-longpress="true"
          />
          <text v-if="imageCaption" class="ui-confirm-dialog-image-caption">{{ imageCaption }}</text>
        </view>
        <view class="ui-confirm-dialog-image-item">
          <image
            class="ui-confirm-dialog-image ui-confirm-dialog-image-pair"
            :src="secondImageSrc"
            mode="widthFix"
            :show-menu-by-longpress="true"
          />
          <text v-if="secondImageCaption" class="ui-confirm-dialog-image-caption">{{ secondImageCaption }}</text>
        </view>
      </view>
      <template v-else>
        <!-- show-menu-by-longpress：微信端长按弹出"识别二维码/保存图片"，否则二维码图无法长按识别。 -->
        <image
          v-if="imageSrc"
          class="ui-confirm-dialog-image"
          :src="imageSrc"
          mode="widthFix"
          :show-menu-by-longpress="true"
        />
        <text v-if="imageSrc && imageCaption" class="ui-confirm-dialog-image-caption">
          {{ imageCaption }}
        </text>
      </template>
      <!-- 自定义内容插槽（如密码输入等轻量表单），位于正文与按钮之间。 -->
      <slot />
      <view :class="['ui-confirm-dialog-actions', secondaryText ? '' : 'ui-confirm-dialog-actions-single']">
        <AppButton :icon="secondaryIcon" v-if="secondaryText" variant="outline" block :disabled="loading" @click="handleSecondary">
          {{ secondaryText }}
        </AppButton>
        <AppButton
          :icon="primaryIcon"
          :variant="primaryTone === 'danger' ? 'danger' : 'lime'"
          block
          :loading="loading"
          :disabled="loading || primaryDisabled"
          @click="emit('primary')"
        >
          {{ loading ? "提交中..." : primaryText }}
        </AppButton>
      </view>
    </view>
  </view>
</template>

<style scoped>
.ui-confirm-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background: var(--ui-color-overlay);
  box-sizing: border-box;
  animation: ui-confirm-dialog-mask-fade-in var(--ui-motion-overlay-duration) ease;
}

.ui-confirm-dialog {
  width: 100%;
  max-width: 620rpx;
  padding: 34rpx 32rpx 32rpx;
  border: var(--ui-border-strong);
  border-radius: var(--ui-radius-card);
  background: var(--ui-surface-bg);
  box-shadow: var(--ui-surface-shadow);
  box-sizing: border-box;
  animation: ui-confirm-dialog-enter var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
  transform-origin: center center;
}

.ui-confirm-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.ui-confirm-dialog-title {
  display: block;
  color: var(--ui-color-text);
  font-size: 32rpx;
  line-height: 44rpx;
  font-weight: 600;
}

.ui-confirm-dialog-message {
  display: block;
  margin-top: 14rpx;
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
  line-height: 40rpx;
  font-weight: 400;
}

.ui-confirm-dialog-highlight {
  padding: 0 12rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-accent-deep);
  font-weight: 600;
}

/* 链接片段沿用场馆链接先例：下划线 + 强调深色传达可点击。 */
.ui-confirm-dialog-link {
  color: var(--ui-color-accent-deep);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 6rpx;
}

/* 链接列表：逐条一行，靠下划线与主文字色传达可点击（沿用场馆链接先例）。 */
.ui-confirm-dialog-links {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14rpx;
  margin-top: 22rpx;
}

.ui-confirm-dialog-link-item {
  color: var(--ui-color-accent-deep);
  font-size: 26rpx;
  line-height: 40rpx;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 6rpx;
}

.ui-confirm-dialog-image {
  display: block;
  width: 320rpx;
  margin-top: 26rpx;
  margin-left: auto;
  margin-right: auto;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-md);
  background: var(--ui-color-surface);
}

.ui-confirm-dialog-images {
  display: flex;
  justify-content: center;
  gap: 24rpx;
  margin-top: 26rpx;
}

.ui-confirm-dialog-image-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  max-width: 266rpx;
}

.ui-confirm-dialog-image-pair {
  width: 100%;
  margin-top: 0;
}

.ui-confirm-dialog-image-caption {
  margin-top: 10rpx;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  line-height: 34rpx;
  font-weight: 400;
  text-align: center;
}

.ui-confirm-dialog-close {
  width: 56rpx;
  height: 56rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-round);
  background: var(--ui-surface-bg);
  color: var(--ui-color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  line-height: 1;
  flex-shrink: 0;
  box-sizing: border-box;
}

.ui-confirm-dialog-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 30rpx;
}

/* 纯提示类弹窗（secondaryText 传空）只保留主按钮，改为单列。 */
.ui-confirm-dialog-actions-single {
  grid-template-columns: 1fr;
}

@keyframes ui-confirm-dialog-mask-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes ui-confirm-dialog-enter {
  from {
    opacity: 0;
    transform: translateY(16rpx) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 退场：遮罩淡出期间仍覆盖屏幕拦截点击（防点穿），内容不再接受交互。 */
.ui-confirm-dialog-mask--leaving {
  animation: ui-confirm-dialog-mask-fade-out var(--ui-motion-overlay-duration) ease forwards;
}

.ui-confirm-dialog--leaving {
  pointer-events: none;
  animation: ui-confirm-dialog-exit var(--ui-motion-overlay-duration) var(--ui-motion-ease-out) forwards;
}

@keyframes ui-confirm-dialog-mask-fade-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@keyframes ui-confirm-dialog-exit {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  to {
    opacity: 0;
    transform: translateY(12rpx) scale(0.98);
  }
}

/* H5 减少动态效果：进场直接呈现、退场立即结束（JS 侧同步跳过移除延迟）。 */
@media (prefers-reduced-motion: reduce) {
  .ui-confirm-dialog-mask,
  .ui-confirm-dialog,
  .ui-confirm-dialog-mask--leaving,
  .ui-confirm-dialog--leaving {
    animation: none;
  }
}
</style>
