<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { AvatarItem, AvatarSize } from "./avatarTypes";
import { avatarStackLayout } from "./avatarStackLayout";

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
const emit = defineEmits<{ (event: "select", id: string | number): void }>();
const expanded = ref(false);
const containerWidth = ref(0);
const scrollLeft = ref(0);
const failedImages = ref<Record<string, boolean>>({});
const instance = getCurrentInstance();
let disposed = false;
let measurement = 0;
const sizes: Record<AvatarSize, number> = { xs: 42, sm: 52, md: 68, lg: 84 };
const avatarSize = computed(() => uni.upx2px(sizes[props.size]));
const layout = computed(() => avatarStackLayout(
  props.items.length,
  containerWidth.value,
  avatarSize.value,
  uni.upx2px(props.size === "xs" ? 10 : 14),
  uni.upx2px(10),
  expanded.value,
));

async function measure() {
  const version = ++measurement;
  await nextTick();
  if (disposed) return;
  uni.createSelectorQuery().in(instance?.proxy).select(".expandable-avatars__items")
    .boundingClientRect(rect => {
      if (disposed || version !== measurement) return;
      const box = Array.isArray(rect) ? rect[0] : rect;
      if (box?.width) containerWidth.value = box.width;
    }).exec();
}
function toggle() {
  if (props.disabled) return;
  scrollLeft.value = 0;
  expanded.value = !expanded.value;
  void measure();
}
function imageKey(item: AvatarItem) { return `${item.id}:${item.avatarUrl}`; }
function select(item: AvatarItem) {
  if (props.interactive && !props.disabled) emit("select", item.id);
}
onMounted(() => { void measure(); uni.onWindowResize(measure); });
onUnmounted(() => { disposed = true; measurement++; uni.offWindowResize(measure); });
watch(() => [props.items.length, props.size], () => { void measure(); });
</script>

<template>
  <view class="expandable-avatars" @tap.stop>
    <view class="expandable-avatars__items">
      <scroll-view scroll-x :show-scrollbar="false" :scroll-left="scrollLeft" class="expandable-avatars__scroll" @scroll="scrollLeft = $event.detail.scrollLeft">
        <view class="expandable-avatars__track" :style="{ width: `${layout.width}px`, height: `${layout.height + 8}px` }">
          <view
            v-for="(item, index) in items"
            :key="item.id"
            class="expandable-avatars__avatar"
            :style="{
              width: `${avatarSize}px`, height: `${avatarSize}px`,
              transform: `translate(${layout.positions[index].x}px, ${layout.positions[index].y + (selectedId === item.id ? 0 : 4)}px)`,
              backgroundColor: item.tone || 'var(--ui-color-text)',
            }"
            :aria-label="item.name"
            :hover-class="interactive && !disabled ? 'expandable-avatars__avatar--pressed' : 'none'"
            @tap.stop="select(item)"
          >
            <image v-if="item.avatarUrl && !failedImages[imageKey(item)]" class="expandable-avatars__image" :src="item.avatarUrl" mode="aspectFill" @error="failedImages[imageKey(item)] = true" />
            <text v-else class="expandable-avatars__fallback">{{ Array.from(item.name.trim())[0] || '?' }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
    <button
      v-if="items.length > 1"
      class="expandable-avatars__toggle"
      :disabled="disabled"
      :aria-expanded="expanded"
      :aria-label="expanded ? '收起头像' : `展开全部 ${items.length} 人头像`"
      hover-class="expandable-avatars__toggle--pressed"
      @tap.stop="toggle"
    >
      <text>{{ expanded ? '收起' : '展开' }}</text>
      <view class="expandable-avatars__chevron" :class="{ 'expandable-avatars__chevron--left': expanded }" />
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
.expandable-avatars__scroll { width: 100%; }
.expandable-avatars__track { position: relative; transition: height var(--ui-motion-expand-duration) var(--ui-motion-ease-out); }
.expandable-avatars__avatar {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--ui-avatar-border);
  border-radius: var(--ui-radius-round);
  overflow: hidden;
  box-sizing: border-box;
  transition: transform var(--ui-motion-expand-duration) var(--ui-motion-ease-out);
}
.expandable-avatars__avatar--pressed { opacity: 0.7; }
.expandable-avatars__image { width: 100%; height: 100%; }
.expandable-avatars__fallback { color: var(--ui-color-text-inverse); font-size: 22rpx; }

.expandable-avatars__chevron { width: 10rpx; height: 10rpx; border-right: 3rpx solid currentColor; border-bottom: 3rpx solid currentColor; transform: rotate(-45deg); transition: transform var(--ui-motion-expand-duration) var(--ui-motion-ease-out); }
.expandable-avatars__chevron--left { transform: rotate(135deg); }
@media (prefers-reduced-motion: reduce) {
  .expandable-avatars__track, .expandable-avatars__avatar, .expandable-avatars__chevron { transition: none; }
}
</style>
