<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import MembershipCrown from "./MembershipCrown.vue";
import type { AvatarItem, AvatarSize } from "./avatarTypes";
import { avatarStackLayout } from "./avatarStackLayout";
import { getWindowMetrics } from "@/utils/systemInfo";

const props = withDefaults(defineProps<{
  items: AvatarItem[];
  size?: AvatarSize;
  selectedId?: string | number | null;
  interactive?: boolean;
  disabled?: boolean;
}>(), {
  size: "sm",
  selectedId: null,
  interactive: true,
  disabled: false,
});
const emit = defineEmits<{ (event: "select", id: string | number): void; (event: "layoutChange"): void; (event: "expandedChange", expanded: boolean): void }>();
const expanded = ref(false);
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
const hasAttendance = computed(() => props.items.some(item => hasAttendanceCount(item)));
function hasAttendanceCount(item: AvatarItem) { return typeof item.teamParticipationPoints === "number" && Number.isFinite(item.teamParticipationPoints) && item.teamParticipationPoints >= 0; }
const attendanceHeight = computed(() => expanded.value && hasAttendance.value ? toPixels(28) : 0);
const crownHeadroom = computed(() => hasMembers.value ? avatarSize.value * 0.44 : 0);
// 包含头像的 4px 下移量与标签后的留白，避免次数贴近进度条。
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
  void measure();
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
  <view data-deck-ignore="true" class="expandable-avatars" @tap.stop>
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
            :aria-label="`${item.name}${item.isPaidMember ? '，球队会员' : ''}${hasAttendanceCount(item) ? `，年度星数${item.teamParticipationPoints}星` : ''}`"
            :hover-class="interactive && !disabled ? 'expandable-avatars__avatar--pressed' : 'none'"
            @tap.stop="select(item)"
          >
            <view data-deck-ignore="true" class="expandable-avatars__face" :style="{ backgroundColor: item.tone || 'var(--ui-color-text)' }">
              <image data-deck-ignore="true" v-if="item.avatarUrl && !failedImages[imageKey(item)]" class="expandable-avatars__image" :src="item.avatarUrl" mode="aspectFill" @error="failedImages[imageKey(item)] = true" />
              <text data-deck-ignore="true" v-else class="expandable-avatars__fallback">{{ Array.from(item.name.trim())[0] || '?' }}</text>
            </view>
            <view v-if="expanded && hasAttendanceCount(item)" data-deck-ignore="true" class="expandable-avatars__attendance">
              <text :class="(item.teamParticipationPoints ?? 0) > 0 && item.teamParticipationRank ? `expandable-avatars__attendance--rank-${item.teamParticipationRank}` : ''">{{ item.teamParticipationPoints }}</text><text>星</text>
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
      :style="{ marginTop: `${crownHeadroom}px` }"
      :disabled="disabled"
      :aria-expanded="expanded"
      :aria-label="expanded ? '收起报名名单' : '展开报名名单'"
      hover-class="expandable-avatars__toggle--pressed"
      @tap.stop="toggle"
    >
      <text data-deck-ignore="true">{{ expanded ? '收起' : '展开' }}</text>
      <view data-deck-ignore="true" class="expandable-avatars__chevron" :class="{ 'expandable-avatars__chevron--left': expanded }" />
    </button>
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
@media (prefers-reduced-motion: reduce) {
  .expandable-avatars__scroll, .expandable-avatars__track, .expandable-avatars__avatar, .expandable-avatars__chevron { transition: none; }
}
</style>
