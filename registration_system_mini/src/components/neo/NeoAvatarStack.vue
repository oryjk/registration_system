<script setup lang="ts">
import { computed } from "vue";

export type NeoAvatarItem = {
  id: string | number;
  name: string;
  avatarUrl?: string;
  tone?: string;
};
export type NeoAvatarSize = "sm" | "md" | "lg";

const props = withDefaults(defineProps<{
  items: NeoAvatarItem[];
  selectedId?: string | number | null;
  maxVisible?: number;
  interactive?: boolean;
  size?: NeoAvatarSize;
}>(), {
  selectedId: null,
  maxVisible: 6,
  interactive: false,
  size: "md",
});

const emit = defineEmits<{
  (event: "select", id: string | number): void;
}>();

/** maxVisible 为 0 表示不限制，展示全部并允许换行。 */
const isUnlimited = computed(() => props.maxVisible <= 0);
const visibleItems = computed(() => (
  isUnlimited.value ? props.items : props.items.slice(0, props.maxVisible)
));
const hiddenCount = computed(() => Math.max(props.items.length - visibleItems.value.length, 0));

function fallbackName(name: string) {
  return name.trim().slice(0, 1) || "?";
}

function handleSelect(item: NeoAvatarItem) {
  if (props.interactive) emit("select", item.id);
}
</script>

<template>
  <view class="neo-avatar-stack" :class="[`neo-avatar-stack--${size}`, isUnlimited ? 'neo-avatar-stack--wrap' : '']">
    <view
      v-for="item in visibleItems"
      :key="item.id"
      class="neo-avatar-stack__item"
      :class="[
        interactive ? 'neo-avatar-stack__item--interactive' : '',
        selectedId === item.id ? 'neo-avatar-stack__item--selected' : '',
      ]"
      :style="{ backgroundColor: item.tone || 'var(--neo-color-text)' }"
      :hover-class="interactive ? 'neo-avatar-stack__item--pressed' : 'none'"
      @tap="handleSelect(item)"
    >
      <image v-if="item.avatarUrl" class="neo-avatar-stack__image" :src="item.avatarUrl" mode="aspectFill" />
      <text v-else class="neo-avatar-stack__fallback">{{ fallbackName(item.name) }}</text>
    </view>
    <view v-if="hiddenCount" class="neo-avatar-stack__more">+{{ hiddenCount }}</view>
  </view>
</template>

<style scoped>
.neo-avatar-stack {
  display: flex;
  align-items: center;
  padding-left: var(--neo-avatar-overlap);
}

.neo-avatar-stack--wrap {
  flex-wrap: wrap;
  row-gap: 16rpx;
}

/* 换行模式下让每行行首都保持相同的重叠偏移，避免第二行相对第一行左移。 */
.neo-avatar-stack--wrap .neo-avatar-stack__item:first-child,
.neo-avatar-stack--wrap .neo-avatar-stack__more:first-child {
  margin-left: var(--neo-avatar-overlap-negative);
}

.neo-avatar-stack__item,
.neo-avatar-stack__more {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: var(--neo-avatar-overlap-negative);
  border: var(--neo-avatar-border);
  border-radius: 50%;
  box-sizing: border-box;
  overflow: hidden;
}

.neo-avatar-stack__item:first-child {
  margin-left: 0;
}

.neo-avatar-stack--sm .neo-avatar-stack__item,
.neo-avatar-stack--sm .neo-avatar-stack__more {
  width: var(--neo-avatar-size-sm);
  height: var(--neo-avatar-size-sm);
}

.neo-avatar-stack--md .neo-avatar-stack__item,
.neo-avatar-stack--md .neo-avatar-stack__more {
  width: var(--neo-avatar-size-md);
  height: var(--neo-avatar-size-md);
}

.neo-avatar-stack--lg .neo-avatar-stack__item,
.neo-avatar-stack--lg .neo-avatar-stack__more {
  width: var(--neo-avatar-size-lg);
  height: var(--neo-avatar-size-lg);
}

.neo-avatar-stack__image {
  width: 100%;
  height: 100%;
}

.neo-avatar-stack__fallback {
  color: var(--neo-color-text-inverse);
  font-size: 26rpx;
  font-weight: 900;
  line-height: 1;
}

.neo-avatar-stack__item--interactive {
  transition: transform var(--neo-motion-fast), box-shadow var(--neo-motion-fast);
}

.neo-avatar-stack__item--selected {
  z-index: 2;
  transform: translateY(-4rpx);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-text);
}

.neo-avatar-stack__item--pressed {
  transform: translate(2rpx, 2rpx);
  box-shadow: none;
}

.neo-avatar-stack__more {
  background: var(--neo-avatar-plus-bg);
  color: var(--neo-avatar-plus-fg);
  font-size: 22rpx;
  font-weight: 900;
}
</style>
