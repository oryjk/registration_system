<script setup lang="ts">
import { useMinioImages } from "@/composables/useMinioImages";
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import MembershipCrown from "./MembershipCrown.vue";
import type { AvatarItem, AvatarSize } from "./avatarTypes";
import { avatarStackLayout } from "./avatarStackLayout";
import { avatarParticipationLevel } from "./avatarParticipationLevel";
import { getWindowMetrics } from "@/utils/systemInfo";

const { minioImageSrc } = useMinioImages();

const props = withDefaults(defineProps<{
  items: AvatarItem[];
  size?: AvatarSize;
  selectedId?: string | number | null;
  interactive?: boolean;
  disabled?: boolean;
  /** 首页独立排版：头像占满一行，名单开关放在下方。H5 忽略。 */
  homeLayout?: boolean;
}>(), {
  size: "sm",
  selectedId: null,
  interactive: true,
  disabled: false,
});
const emit = defineEmits<{ (event: "select", id: string | number): void; (event: "layoutChange", delta?: number): void; (event: "expandedChange", expanded: boolean): void }>();
const expanded = ref(false);
const homeGridHeight = ref(0);
const isHomeLayout = computed(() => {
  // #ifdef MP-WEIXIN
  return props.homeLayout === true;
  // #endif
  // #ifndef MP-WEIXIN
  return false;
  // #endif
});
const containerWidth = ref(0);
const scrollLeft = ref(0);
const failedImages = ref<Record<string, boolean>>({});
const instance = getCurrentInstance();
let disposed = false;
let measurement = 0;
let layoutSettleTimer: ReturnType<typeof setTimeout> | undefined;
const sizes: Record<AvatarSize, number> = { xs: 42, sm: 52, md: 68, lg: 84 };
const viewportWidth = ref(getWindowMetrics().windowWidth);
const toPixels = (rpx: number) => rpx * viewportWidth.value / 750;
const avatarSize = computed(() => toPixels(sizes[props.size]));
const hasMembers = computed(() => props.items.some(item => item.isPaidMember));
// 给皇冠及摇摆范围留出滚动容器内空间，避免折叠/展开时被裁切。
const hasAttendance = computed(() => props.items.some(item => hasParticipationLevel(item)));
function hasParticipationLevel(item: AvatarItem) { return avatarParticipationLevel(item.teamCumulativeParticipationPoints) !== null; }
const attendanceHeight = computed(() => expanded.value && hasAttendance.value ? toPixels(28) : 0);
const crownHeadroom = computed(() => hasMembers.value ? avatarSize.value * 0.44 : 0);
// 包含头像的 4px 下移量与标签后的留白，避免等级贴近进度条。
const trackHeight = computed(() => layout.value.height + crownHeadroom.value + 4 + toPixels(16));
const layout = computed(() => avatarStackLayout(
  props.items.length,
  containerWidth.value,
  avatarSize.value,
  toPixels(props.size === "xs" ? 10 : 14),
  toPixels(10),
  expanded.value,
  avatarSize.value + attendanceHeight.value,
  crownHeadroom.value + toPixels(10),
));

async function measure() {
  const version = ++measurement;
  viewportWidth.value = getWindowMetrics().windowWidth;
  await nextTick();
  if (disposed) return;
  if (isHomeLayout.value) {
    uni.createSelectorQuery().in(instance?.proxy).select(".expandable-avatars__home-grid")
      .boundingClientRect(rect => {
        if (disposed || version !== measurement) return;
        const box = Array.isArray(rect) ? rect[0] : rect;
        if (typeof box?.height === "number" && box.height > 0) homeGridHeight.value = box.height;
        void nextTick(() => { if (!disposed) emit("layoutChange"); });
      }).exec();
    return;
  }
  uni.createSelectorQuery().in(instance?.proxy).select(".expandable-avatars__items")
    .boundingClientRect(rect => {
      if (disposed || version !== measurement) return;
      const box = Array.isArray(rect) ? rect[0] : rect;
      if (box?.width) containerWidth.value = box.width;
      void nextTick(() => { if (!disposed) emit("layoutChange"); });
    }).exec();
}
function toggle() {
  if (props.disabled) return;
  scrollLeft.value = 0;
  expanded.value = !expanded.value;
  emit("expandedChange", expanded.value);
  if (isHomeLayout.value) {
    if (homeGridHeight.value > 0) {
      emit("layoutChange", expanded.value ? homeGridHeight.value : -homeGridHeight.value);
    }
    if (layoutSettleTimer !== undefined) clearTimeout(layoutSettleTimer);
    layoutSettleTimer = setTimeout(() => { if (!disposed) emit("layoutChange"); }, 252);
    return;
  }
  void measure();
}
function rankBadgeClass(item: AvatarItem) {
  if ((item.teamParticipationPoints ?? 0) <= 0 || !item.teamParticipationRank) return "";
  if (item.teamParticipationRank === 1) return "expandable-avatars__home-badge--rank-1";
  if (item.teamParticipationRank === 2) return "expandable-avatars__home-badge--rank-2";
  if (item.teamParticipationRank === 3) return "expandable-avatars__home-badge--rank-3";
  return "";
}
function imageKey(item: AvatarItem) { return `${item.id}:${item.avatarUrl}`; }
function select(item: AvatarItem) {
  if (props.interactive && !props.disabled) emit("select", item.id);
}
onMounted(() => { void measure(); uni.onWindowResize(measure); });
onUnmounted(() => { disposed = true; measurement++; if (layoutSettleTimer !== undefined) clearTimeout(layoutSettleTimer); uni.offWindowResize(measure); });
watch(() => [props.items.length, props.size, hasMembers.value, hasAttendance.value], () => { void measure(); });
watch(trackHeight, () => {
  if (layoutSettleTimer !== undefined) clearTimeout(layoutSettleTimer);
  // 与 expand 的 220ms 过渡一致，留一帧余量再让首页 swiper 测量最终高度。
  layoutSettleTimer = setTimeout(() => { if (!disposed) emit("layoutChange"); }, 252);
}, { flush: "post" });
</script>

<template>
  <view data-deck-ignore="true" class="expandable-avatars" :class="{ 'expandable-avatars--home': isHomeLayout }" @tap.stop>
    <!-- #ifdef MP-WEIXIN -->
    <template v-if="isHomeLayout">
      <view data-deck-ignore="true" class="expandable-avatars__home-bar">
        <scroll-view
          data-deck-ignore="true"
          scroll-x
          :show-scrollbar="false"
          class="expandable-avatars__home-scroll"
          :class="{ 'expandable-avatars__home-scroll--dimmed': expanded }"
          @touchmove.stop
        >
          <view data-deck-ignore="true" class="expandable-avatars__home-strip">
            <view
              v-for="item in items"
              :key="item.id"
              data-deck-ignore="true"
              class="expandable-avatars__home-chip"
              :hover-class="interactive && !disabled ? 'expandable-avatars__avatar--pressed' : 'none'"
              @tap.stop="select(item)"
            >
              <view data-deck-ignore="true" class="expandable-avatars__home-chip-face" :style="{ backgroundColor: item.tone || 'var(--ui-color-text)' }">
                <image data-deck-ignore="true" v-if="item.avatarUrl && !failedImages[imageKey(item)]" class="expandable-avatars__image" :src="minioImageSrc(item.avatarUrl)" mode="aspectFill" @error="minioImageSrc(item.avatarUrl) && (failedImages[imageKey(item)] = true)" />
                <text data-deck-ignore="true" v-else class="expandable-avatars__fallback">{{ Array.from(item.name.trim())[0] || '?' }}</text>
              </view>
              <view v-if="item.isPaidMember" data-deck-ignore="true" class="expandable-avatars__home-chip-crown">
                <MembershipCrown width="36rpx" height="20rpx" />
              </view>
            </view>
          </view>
        </scroll-view>
        <button
          v-if="items.length > 0"
          data-deck-ignore="true"
          class="expandable-avatars__home-btn"
          :disabled="disabled"
          :aria-expanded="expanded"
          :aria-label="expanded ? '收起报名名单' : '展开报名名单'"
          hover-class="expandable-avatars__toggle--pressed"
          @tap.stop="toggle"
        >
          <text data-deck-ignore="true">{{ expanded ? "收起名单" : "展开名单" }}</text>
          <image data-deck-ignore="true" class="expandable-avatars__home-chevron" :class="{ 'expandable-avatars__home-chevron--open': expanded }" src="/static/home-icons/chevron-down.png" mode="aspectFit" aria-hidden="true" />
        </button>
      </view>
      <view
        data-deck-ignore="true"
        class="expandable-avatars__home-drawer"
        :class="{ 'expandable-avatars__home-drawer--open': expanded }"
        :style="{ height: `${expanded ? homeGridHeight : 0}px` }"
      >
        <view data-deck-ignore="true" class="expandable-avatars__home-grid">
          <view data-deck-ignore="true" class="expandable-avatars__home-grid-cells">
            <view
              v-for="item in items"
              :key="`grid-${item.id}`"
              data-deck-ignore="true"
              class="expandable-avatars__home-cell"
              :hover-class="interactive && !disabled ? 'expandable-avatars__avatar--pressed' : 'none'"
              @tap.stop="select(item)"
            >
              <view data-deck-ignore="true" class="expandable-avatars__home-cell-avatar">
                <view data-deck-ignore="true" class="expandable-avatars__home-cell-face" :style="{ backgroundColor: item.tone || 'var(--ui-color-text)' }">
                  <image data-deck-ignore="true" v-if="item.avatarUrl && !failedImages[imageKey(item)]" class="expandable-avatars__image" :src="minioImageSrc(item.avatarUrl)" mode="aspectFill" @error="minioImageSrc(item.avatarUrl) && (failedImages[imageKey(item)] = true)" />
                  <text data-deck-ignore="true" v-else class="expandable-avatars__fallback">{{ Array.from(item.name.trim())[0] || '?' }}</text>
                </view>
                <view v-if="item.isPaidMember" data-deck-ignore="true" class="expandable-avatars__home-cell-crown">
                  <MembershipCrown width="44rpx" height="24rpx" />
                </view>
              </view>
              <text data-deck-ignore="true" class="expandable-avatars__home-name">{{ item.name }}</text>
              <view v-if="hasParticipationLevel(item)" data-deck-ignore="true" class="expandable-avatars__home-badge" :class="rankBadgeClass(item)">
                <text data-deck-ignore="true">{{ avatarParticipationLevel(item.teamCumulativeParticipationPoints) }}级</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </template>
    <template v-else>
    <!-- #endif -->
    <!-- 只隔离头像滚动，勿在外层拦截 touchstart，否则小程序按钮 tap 无法触发。 -->
    <view data-deck-ignore="true" class="expandable-avatars__items">
      <scroll-view data-deck-ignore="true" scroll-x :show-scrollbar="false" :scroll-left="scrollLeft" class="expandable-avatars__scroll" @touchmove.stop :style="{ height: `${trackHeight}px` }" @scroll="scrollLeft = $event.detail.scrollLeft">
        <view data-deck-ignore="true" class="expandable-avatars__track" :style="{ width: `${layout.width}px`, height: `${trackHeight}px` }">
          <view
            v-for="(item, index) in items"
            :key="item.id"
            data-deck-ignore="true"
            class="expandable-avatars__avatar"
            :style="{
              width: `${avatarSize}px`, height: `${avatarSize}px`,
              transform: `translate(${layout.positions[index].x}px, ${layout.positions[index].y + crownHeadroom + (selectedId === item.id ? 0 : 4)}px)`,
            }"
            :aria-label="`${item.name}${item.isPaidMember ? '，球队会员' : ''}${hasParticipationLevel(item) ? `，等级${avatarParticipationLevel(item.teamCumulativeParticipationPoints)}级` : ''}`"
            :hover-class="interactive && !disabled ? 'expandable-avatars__avatar--pressed' : 'none'"
            @tap.stop="select(item)"
          >
            <view data-deck-ignore="true" class="expandable-avatars__face" :style="{ backgroundColor: item.tone || 'var(--ui-color-text)' }">
              <image data-deck-ignore="true" v-if="item.avatarUrl && !failedImages[imageKey(item)]" class="expandable-avatars__image" :src="minioImageSrc(item.avatarUrl)" mode="aspectFill" @error="minioImageSrc(item.avatarUrl) && (failedImages[imageKey(item)] = true)" />
              <text data-deck-ignore="true" v-else class="expandable-avatars__fallback">{{ Array.from(item.name.trim())[0] || '?' }}</text>
            </view>
            <view v-if="expanded && hasParticipationLevel(item)" data-deck-ignore="true" class="expandable-avatars__attendance">
              <text :class="(item.teamParticipationPoints ?? 0) > 0 && item.teamParticipationRank ? `expandable-avatars__attendance--rank-${item.teamParticipationRank}` : ''">{{ avatarParticipationLevel(item.teamCumulativeParticipationPoints) }}</text><text>级</text>
            </view>
            <view v-if="item.isPaidMember" data-deck-ignore="true" class="expandable-avatars__crown"><MembershipCrown :width="`${avatarSize * 0.72}px`" :height="`${avatarSize * 0.4}px`" /></view>
          </view>
        </view>
      </scroll-view>
    </view>
    <button
      v-if="items.length > 0"
      data-deck-ignore="true"
      class="expandable-avatars__toggle"
      :style="{ marginTop: `${isHomeLayout ? 0 : crownHeadroom}px` }"
      :disabled="disabled"
      :aria-expanded="expanded"
      :aria-label="expanded ? '收起报名名单' : '展开报名名单'"
      hover-class="expandable-avatars__toggle--pressed"
      @tap.stop="toggle"
    >
      <text data-deck-ignore="true">{{ expanded ? '收起' : '展开' }}</text>
      <!-- #ifdef MP-WEIXIN -->
      <image data-deck-ignore="true" class="expandable-avatars__home-chevron" :class="{ 'expandable-avatars__home-chevron--open': expanded }" src="/static/home-icons/chevron-down.png" mode="aspectFit" aria-hidden="true" />
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view data-deck-ignore="true" class="expandable-avatars__chevron" :class="{ 'expandable-avatars__chevron--left': expanded }" />
      <!-- #endif -->
    </button>
    <!-- #ifdef MP-WEIXIN -->
    </template>
    <!-- #endif -->
  </view>
</template>

<style scoped>
.expandable-avatars { display: flex; align-items: flex-start; gap: 16rpx; width: 100%; }
.expandable-avatars__items { flex: 1; min-width: 0; }
.expandable-avatars__toggle {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
  min-height: 56rpx;
  padding: 0 8rpx;
  margin: 0;
  border: 0;
  background: transparent;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.3;
}
.expandable-avatars__toggle::after { border: 0; }
.expandable-avatars__toggle--pressed { opacity: 0.65; }
.expandable-avatars__scroll { width: 100%; transition: height var(--ui-motion-expand-duration) var(--ui-motion-ease-out); }
.expandable-avatars__track { position: relative; transition: height var(--ui-motion-expand-duration) var(--ui-motion-ease-out); }
.expandable-avatars__avatar {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transition: transform var(--ui-motion-expand-duration) var(--ui-motion-ease-out);
}
.expandable-avatars__face { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border: var(--ui-avatar-border); border-radius: var(--ui-radius-round); overflow: hidden; box-sizing: border-box; }
.expandable-avatars__crown { position: absolute; z-index: 1; width: 72%; height: 40%; left: 14%; top: -34%; pointer-events: none; }
.expandable-avatars__attendance { position: absolute; display: flex; align-items: baseline; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 4rpx; font-size: 20rpx; line-height: 24rpx; white-space: nowrap; color: var(--ui-color-text-muted); font-variant-numeric: tabular-nums; }
.expandable-avatars__attendance--rank-1 { color: var(--ui-avatar-attendance-gold); font-weight: 600; }
.expandable-avatars__attendance--rank-2 { color: var(--ui-avatar-attendance-silver); font-weight: 600; }
.expandable-avatars__attendance--rank-3 { color: var(--ui-avatar-attendance-bronze); font-weight: 600; }
/* 只淡化头像内容，保留 face 的不透明底色，避免叠放头像互相透出。 */
.expandable-avatars__avatar--pressed .expandable-avatars__image,
.expandable-avatars__avatar--pressed .expandable-avatars__fallback { opacity: 0.7; }
.expandable-avatars__image { width: 100%; height: 100%; }
.expandable-avatars__fallback { color: var(--ui-color-text-inverse); font-size: 22rpx; }

.expandable-avatars__chevron { width: 10rpx; height: 10rpx; border-right: 3rpx solid currentColor; border-bottom: 3rpx solid currentColor; transform: rotate(-45deg); transition: transform var(--ui-motion-expand-duration) var(--ui-motion-ease-out); }
.expandable-avatars__chevron--left { transform: rotate(135deg); }
/* #ifdef MP-WEIXIN */
.expandable-avatars__toggle { min-height: var(--ui-control-min-height); color: var(--ui-color-icon-muted); font-size: var(--ui-text-sm); }
.expandable-avatars--home { flex-direction: column; align-items: stretch; gap: 0; }
.expandable-avatars__home-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-4); width: 100%; }
.expandable-avatars__home-scroll { flex: 1; min-width: 0; white-space: nowrap; transition: opacity var(--ui-motion-expand-duration) var(--ui-motion-ease-out); }
.expandable-avatars__home-scroll--dimmed { opacity: 0.4; }
.expandable-avatars__home-strip { display: inline-flex; align-items: center; padding: var(--ui-space-3) var(--ui-space-2) var(--ui-space-1) var(--ui-space-1); }
.expandable-avatars__home-chip { position: relative; width: 64rpx; height: 64rpx; flex-shrink: 0; box-sizing: border-box; }
.expandable-avatars__home-chip + .expandable-avatars__home-chip { margin-left: -16rpx; }
.expandable-avatars__home-chip-face { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 20rpx; overflow: hidden; box-sizing: border-box; border: 0; box-shadow: 0 0 0 4rpx var(--ui-color-surface); }
/* 皇冠居中「戴」在头像正上方，约 40% 高度压住头像上沿；strip 顶部留白恰好容纳露出部分，避免被 scroll-view 裁切。 */
.expandable-avatars__home-chip-crown { position: absolute; top: -12rpx; left: 50%; z-index: 2; transform: translateX(-50%); pointer-events: none; }
.expandable-avatars__home-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-1);
  flex-shrink: 0;
  margin: 0;
  padding: var(--ui-space-2) var(--ui-space-4);
  border: 0;
  border-radius: var(--ui-space-4);
  background: var(--ui-color-page-muted);
  color: var(--ui-home-muted);
  font-size: var(--ui-text-body);
  font-weight: var(--ui-font-weight-medium);
  line-height: var(--ui-line-height-compact);
}
.expandable-avatars__home-btn::after { border: 0; }
.expandable-avatars__home-chevron { flex-shrink: 0; width: var(--ui-icon-sm); height: var(--ui-icon-sm); transition: transform var(--ui-motion-expand-duration) var(--ui-motion-ease-out); }
.expandable-avatars__home-chevron--open { transform: rotate(180deg); }
.expandable-avatars__home-drawer {
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transition:
    height var(--ui-motion-expand-duration) var(--ui-motion-ease-out),
    opacity var(--ui-motion-expand-duration) var(--ui-motion-ease-out);
}
.expandable-avatars__home-drawer--open {
  opacity: 1;
  pointer-events: auto;
}
.expandable-avatars__home-grid {
  padding-top: var(--ui-space-5);
  transform: translateY(-12rpx);
  transition: transform var(--ui-motion-expand-duration) var(--ui-motion-ease-out);
}
.expandable-avatars__home-drawer--open .expandable-avatars__home-grid {
  transform: translateY(0);
}
.expandable-avatars__home-grid-cells {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  row-gap: var(--ui-space-5);
  column-gap: var(--ui-space-3);
  padding-top: var(--ui-space-5);
  border-top: var(--ui-border-hairline);
}
.expandable-avatars__home-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  text-align: center;
}
.expandable-avatars__home-cell-avatar {
  position: relative;
  width: 80rpx;
  height: 80rpx;
  flex-shrink: 0;
}
.expandable-avatars__home-cell-face {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ui-space-6);
  overflow: hidden;
  box-sizing: border-box;
  border: 0;
}
.expandable-avatars__home-cell-crown {
  position: absolute;
  top: -14rpx;
  left: 50%;
  z-index: 2;
  transform: translateX(-50%);
  pointer-events: none;
}
.expandable-avatars__home-name {
  max-width: 112rpx;
  margin-top: var(--ui-space-2);
  color: var(--ui-color-text);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-weight-medium);
  line-height: var(--ui-line-height-tight);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.expandable-avatars__home-badge {
  margin-top: var(--ui-space-1);
  padding: 2rpx var(--ui-space-3);
  border-radius: var(--ui-space-2);
  background: var(--ui-color-page-muted);
  color: var(--ui-home-muted);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-weight-heading);
  line-height: var(--ui-line-height-compact);
  font-variant-numeric: tabular-nums;
}
.expandable-avatars__home-badge--rank-1 {
  background: var(--ui-avatar-attendance-gold-bg);
  color: var(--ui-avatar-attendance-gold);
}
.expandable-avatars__home-badge--rank-2 {
  background: var(--ui-avatar-attendance-silver-bg);
  color: var(--ui-avatar-attendance-silver);
}
.expandable-avatars__home-badge--rank-3 {
  background: var(--ui-avatar-attendance-bronze-bg);
  color: var(--ui-avatar-attendance-bronze);
}
.expandable-avatars__chevron { width: 32rpx; height: 32rpx; border: 0; font-size: 32rpx; line-height: 1; transform: none; }
.expandable-avatars__chevron--left { transform: rotate(180deg); }
/* #endif */
@media (prefers-reduced-motion: reduce) {
  .expandable-avatars__scroll, .expandable-avatars__track, .expandable-avatars__avatar, .expandable-avatars__chevron { transition: none; }
  /* #ifdef MP-WEIXIN */
  .expandable-avatars__home-chevron { transition: none; }
  /* #endif */
}
</style>
