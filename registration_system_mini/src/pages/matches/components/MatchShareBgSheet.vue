<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
// #endif
import { computed } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";
import { useMinioImages } from "@/composables/useMinioImages";
import type { BackendTeamShareBackgroundItem } from "@/types/backend";
import { prefersReducedMotion } from "@/utils/reducedMotion";

const { minioImageSrc } = useMinioImages();

const props = withDefaults(
  defineProps<{
    visible: boolean;
    teamName?: string;
    currentBgUrl?: string;
    backgrounds?: BackendTeamShareBackgroundItem[];
    loading?: boolean;
    busy?: boolean;
    hasAccess?: boolean;
    vipSummaryText?: string;
  }>(),
  {
    teamName: "",
    currentBgUrl: "",
    backgrounds: () => [],
    loading: false,
    busy: false,
    hasAccess: false,
    vipSummaryText: "免费版",
  },
);

const emit = defineEmits<{
  (event: "close"): void;
  (event: "selectDefault"): void;
  (event: "selectBackground", imageUrl: string): void;
  (event: "uploadNew"): void;
  (event: "openVip"): void;
}>();

const { rendered, leaving } = useOverlayPresence(
  computed(() => props.visible),
  { leaveDurationMs: () => (prefersReducedMotion() ? 0 : 210) },
);

const normalizedCurrentUrl = computed(() => (props.currentBgUrl ?? "").trim());
const isDefaultSelected = computed(() => !normalizedCurrentUrl.value);

function isItemSelected(url: string): boolean {
  return !!normalizedCurrentUrl.value && normalizedCurrentUrl.value === url.trim();
}

function handleClose() {
  if (!rendered.value || leaving.value || props.busy) return;
  emit("close");
}

function handleSelectDefault() {
  if (props.busy) return;
  emit("selectDefault");
}

function handleSelectItem(url: string) {
  if (props.busy) return;
  emit("selectBackground", url);
}

function handleUploadNew() {
  if (props.busy) return;
  emit("uploadNew");
}

function handleOpenVip() {
  if (props.busy) return;
  emit("openVip");
}
</script>

<template>
  <view
    v-if="rendered"
    :class="[
      'bg-sheet-overlay',
      rendered && !leaving ? 'bg-sheet-overlay-open' : '',
      leaving ? 'bg-sheet-overlay-closing' : '',
    ]"
    @tap="handleClose"
  >
    <view class="bg-sheet-backdrop" />
    <view class="bg-sheet-panel" @tap.stop>
      <view class="bg-sheet-head">
        <view class="bg-sheet-heading">
          <view class="bg-sheet-title-row">
            <text class="bg-sheet-title">分享海报背景</text>
            <view class="bg-sheet-vip-pill" hover-class="bg-sheet-vip-pill--pressed" @tap="handleOpenVip">
              <text class="bg-sheet-vip-pill__text">{{ hasAccess ? vipSummaryText : "开通球队会员" }}</text>
              <view class="bg-sheet-vip-pill__chevron" />
            </view>
          </view>
          <text v-if="teamName" class="bg-sheet-subtitle">{{ teamName }} · 球队共享背景资源库</text>
        </view>
        <button class="bg-sheet-close" aria-label="关闭分享背景选择" @tap="handleClose">
          <!-- #ifdef MP-WEIXIN -->
          <AppIcon name="x" tone="muted" />
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          ×
          <!-- #endif -->
        </button>
      </view>

      <!-- 免费版明确提示 + 具体使用示例 -->
      <view class="bg-free-banner">
        <!-- #ifdef MP-WEIXIN -->
        <view class="bg-free-banner__icon">
          <AppIcon name="info" size="var(--ui-icon-sm)" tone="muted" />
        </view>
        <!-- #endif -->
        <text class="bg-free-banner__text">
          免费版也可正常分享比赛和阵型（使用默认热血红黑海报底）。开通球队会员后，可上传球队 Logo、公司 Logo、球队合照等作为专属分享背景。
        </text>
      </view>

      <!-- 背景图网格（独立滚动，保持顶部标题与底部主按钮常驻可见） -->
      <view class="bg-sheet-body">
        <view class="bg-grid">
          <!-- 默认热血海报底（免费） -->
          <view
            :class="['bg-card', isDefaultSelected ? 'bg-card--active' : '']"
            hover-class="bg-card--pressed"
            @tap="handleSelectDefault"
          >
            <!-- decorative asset colors: 默认红黑热血海报微缩预览 -->
            <view class="bg-thumb bg-thumb--default">
              <view class="bg-thumb-bar" />
              <text class="bg-thumb-watermark">MATCHDAY</text>
              <view class="bg-thumb-badge bg-thumb-badge--free">
                <text class="bg-thumb-badge__text">免费</text>
              </view>
              <view v-if="isDefaultSelected" class="bg-thumb-check">
                <!-- #ifdef MP-WEIXIN -->
                <AppIcon name="check" size="22rpx" />
                <!-- #endif -->
                <!-- #ifndef MP-WEIXIN -->
                <text class="bg-thumb-check__glyph">✓</text>
                <!-- #endif -->
              </view>
            </view>
            <text class="bg-card-label">默认热血海报底</text>
          </view>

          <!-- 暂无自定义背景时，第二格展示自定义示例引导卡，平衡双列版面并直观说明可上传内容 -->
          <view
            v-if="!loading && backgrounds.length === 0"
            class="bg-card bg-card--placeholder"
            hover-class="bg-card--pressed"
            @tap="handleUploadNew"
          >
            <view class="bg-thumb bg-thumb--placeholder">
              <!-- #ifdef MP-WEIXIN -->
              <AppIcon name="image" size="var(--ui-icon-lg)" tone="muted" />
              <!-- #endif -->
              <text class="bg-placeholder-hint">球队 Logo / 公司 Logo / 合照</text>
              <view class="bg-thumb-badge bg-thumb-badge--vip">
                <text class="bg-thumb-badge__text">{{ hasAccess ? "可上传" : "会员专属" }}</text>
              </view>
            </view>
            <text class="bg-card-label">{{ hasAccess ? "点击上传自定义背景" : "自定义专属背景" }}</text>
          </view>

          <!-- 球队资源库已有背景 -->
          <view
            v-for="item in backgrounds"
            :key="item.id"
            :class="['bg-card', isItemSelected(item.image_url) ? 'bg-card--active' : '']"
            hover-class="bg-card--pressed"
            @tap="handleSelectItem(item.image_url)"
          >
            <view class="bg-thumb">
              <image
                class="bg-thumb-image"
                :src="minioImageSrc(item.image_url)"
                mode="aspectFill"
              />
              <view v-if="isItemSelected(item.image_url)" class="bg-thumb-check">
                <!-- #ifdef MP-WEIXIN -->
                <AppIcon name="check" size="22rpx" />
                <!-- #endif -->
                <!-- #ifndef MP-WEIXIN -->
                <text class="bg-thumb-check__glyph">✓</text>
                <!-- #endif -->
              </view>
            </view>
            <text class="bg-card-label">{{ isItemSelected(item.image_url) ? "当前使用" : "点击切换" }}</text>
          </view>
        </view>

        <text v-if="loading && backgrounds.length === 0" class="bg-loading-hint">正在加载球队背景资源库...</text>
      </view>

      <!-- 上传新背景图 -->
      <view class="bg-sheet-footer">
        <view class="bg-sheet-upload-btn">
          <AppButton
            block
            variant="lime"
            :loading="busy"
            :disabled="busy"
            @click="handleUploadNew"
          >
            {{ busy ? "处理中..." : "+ 上传新背景图" }}
          </AppButton>
        </view>
        <text class="bg-sheet-note">
          例如：球队 Logo、公司 Logo、赛场合照或赞助商海报；上传后自动存入球队资源库，下次建赛默认沿用（支持 JPG/PNG/WebP，≤2MB）
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.bg-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 140;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ui-motion-overlay-duration) ease;
}

.bg-sheet-overlay-open {
  opacity: 1;
  pointer-events: auto;
}

.bg-sheet-overlay-closing {
  opacity: 0;
  pointer-events: auto;
}

.bg-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: var(--ui-color-overlay);
}

.bg-sheet-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  max-height: 86vh;
  overflow: hidden;
  padding: var(--ui-space-7) var(--ui-page-padding-inline, 28rpx) calc(var(--ui-space-7) + env(safe-area-inset-bottom));
  border-top-left-radius: var(--ui-card-radius, 36rpx);
  border-top-right-radius: var(--ui-card-radius, 36rpx);
  background: var(--ui-color-surface);
  transform: translateY(100%);
  transition: transform var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
}

.bg-sheet-overlay-open .bg-sheet-panel {
  transform: translateY(0);
}

.bg-sheet-overlay-closing .bg-sheet-panel {
  pointer-events: none;
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .bg-sheet-overlay,
  .bg-sheet-panel {
    transition: none;
  }
}

.bg-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.bg-sheet-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
  flex: 1;
}

.bg-sheet-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}

.bg-sheet-title {
  color: var(--ui-color-text);
  font-size: var(--ui-text-title, 34rpx);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.3;
}

.bg-sheet-vip-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 44rpx;
  padding: 0 18rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-warning-bg);
  box-sizing: border-box;
  transition: box-shadow var(--ui-motion-press-duration) ease;
}

.bg-sheet-vip-pill--pressed {
  box-shadow: var(--ui-shadow-control-pressed);
}

.bg-sheet-vip-pill__text {
  display: block;
  color: var(--ui-color-warning-fg);
  font-size: 22rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1;
}

.bg-sheet-vip-pill__chevron {
  width: 10rpx;
  height: 10rpx;
  margin-left: -2rpx;
  border-top: 3rpx solid var(--ui-color-warning-fg);
  border-right: 3rpx solid var(--ui-color-warning-fg);
  transform: rotate(45deg);
  flex-shrink: 0;
}

.bg-sheet-subtitle {
  color: var(--ui-color-text-secondary, var(--ui-color-text-muted));
  font-size: 22rpx;
  line-height: 1.4;
}

.bg-sheet-close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--ui-control-min-height, 72rpx);
  height: var(--ui-control-min-height, 72rpx);
  margin: -10rpx -12rpx 0 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ui-color-text-muted);
  font-size: 40rpx;
  line-height: 1;
}

.bg-sheet-close::after { border: 0; }

.bg-free-banner {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 20rpx;
  padding: 16rpx 18rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-success-bg);
  flex-shrink: 0;
}

.bg-free-banner__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4rpx;
  flex-shrink: 0;
}

.bg-free-banner__text {
  flex: 1;
  min-width: 0;
  color: var(--ui-color-success-fg);
  font-size: 22rpx;
  line-height: 1.5;
}

.bg-sheet-body {
  max-height: 52vh;
  margin-top: 22rpx;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.bg-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.bg-card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 10rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-sizing: border-box;
  transition:
    border-color var(--ui-motion-press-duration) var(--ui-motion-ease-out),
    background-color var(--ui-motion-press-duration) var(--ui-motion-ease-out),
    transform var(--ui-motion-press-duration) var(--ui-motion-ease-out);
}

.bg-card--active {
  border-color: var(--ui-color-accent);
  background: var(--ui-color-accent-subtle);
}

.bg-card--placeholder {
  border-style: dashed;
  border-color: var(--ui-color-line-strong);
  background: var(--ui-color-surface);
}

.bg-card--pressed {
  transform: scale(0.98);
}

.bg-thumb {
  position: relative;
  width: 100%;
  height: 180rpx;
  border-radius: 14rpx;
  overflow: hidden;
  background: var(--ui-color-neutral-bg);
}

/* decorative asset colors: C2 默认红黑球场射灯海报缩略预览 */
.bg-thumb--default {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2a0a10 0%, #12070b 52%, #3a0d15 100%);
}

.bg-thumb--placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 16rpx 14rpx 44rpx;
  box-sizing: border-box;
  background: var(--ui-color-page-muted);
}

.bg-placeholder-hint {
  color: var(--ui-color-text-secondary, var(--ui-color-text-muted));
  font-size: 20rpx;
  line-height: 1.35;
  text-align: center;
}

.bg-thumb-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 22rpx;
  background: #ff453a;
}

.bg-thumb-watermark {
  color: rgba(255, 255, 255, 0.24);
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 3rpx;
}

.bg-thumb-image {
  display: block;
  width: 100%;
  height: 100%;
}

.bg-thumb-badge {
  position: absolute;
  left: 10rpx;
  bottom: 10rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34rpx;
  padding: 0 12rpx;
  border-radius: var(--ui-radius-round);
  box-sizing: border-box;
}

.bg-thumb-badge__text {
  display: block;
  font-size: 20rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1;
}

.bg-thumb-badge--free {
  background: var(--ui-color-success-bg);
  color: var(--ui-color-success-fg);
}

.bg-thumb-badge--vip {
  background: var(--ui-color-warning-bg);
  color: var(--ui-color-warning-fg);
}

.bg-thumb-check {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38rpx;
  height: 38rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent);
  color: var(--ui-color-accent-fg);
}

.bg-thumb-check__glyph {
  display: block;
  font-size: 24rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1;
}

.bg-card-label {
  color: var(--ui-color-text);
  font-size: 23rpx;
  font-weight: 500;
  line-height: 1.35;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bg-loading-hint {
  display: block;
  margin-top: 16rpx;
  color: var(--ui-color-text-secondary, var(--ui-color-text-muted));
  font-size: 22rpx;
  text-align: center;
}

.bg-sheet-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  margin-top: 24rpx;
  flex-shrink: 0;
}

.bg-sheet-upload-btn {
  width: 100%;
}

.bg-sheet-note {
  color: var(--ui-color-text-secondary, var(--ui-color-text-muted));
  font-size: 22rpx;
  line-height: 1.5;
  text-align: center;
}
</style>
