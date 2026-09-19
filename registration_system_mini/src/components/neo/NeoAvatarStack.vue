<script setup lang="ts">
import { computed, getCurrentInstance, onUnmounted, ref } from "vue";

export type NeoAvatarItem = {
  id: string | number;
  name: string;
  avatarUrl?: string;
  tone?: string;
};
export type NeoAvatarSize = "xs" | "sm" | "md" | "lg";

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

/** maxVisible 为 0 表示不限制，展示全部并允许换行（叠压展示，无展开交互）。 */
const isUnlimited = computed(() => props.maxVisible <= 0);
// 受限模式点 +N 依次展开（互不遮挡），再点 -N 依次收回；溢出头像常驻 DOM，
// 收起时收缩为 0 宽，靠 CSS 过渡按 --avatar-delay 逐项完成动画。
const expanded = ref(false);
// wrap 与 expanded 分开编排：展开前先开 wrap（收起的一行不受影响），收回后
// 等动画结束再关 wrap，避免动画中途换行跳变把头像瞬间挤回一行。
const wrapEnabled = ref(false);
let wrapDisableTimer: ReturnType<typeof setTimeout> | null = null;

const STAGGER_STEP_EXPAND_MS = 26;
const STAGGER_STEP_COLLAPSE_MS = 18;
const RESTORE_DURATION_MS = 220; // 与 --neo-avatar-restore-duration 保持一致

const overflowCount = computed(() =>
  isUnlimited.value ? 0 : Math.max(props.items.length - props.maxVisible, 0),
);
const shouldWrap = computed(() => isUnlimited.value || wrapEnabled.value);

function isOverflow(index: number) {
  return !isUnlimited.value && !expanded.value && index >= props.maxVisible;
}

// 展开从左到右依次滑开，收回从右到左依次合拢（收回节奏更快，显得利落）。
function staggerDelay(index: number) {
  return expanded.value
    ? index * STAGGER_STEP_EXPAND_MS
    : (props.items.length - 1 - index) * STAGGER_STEP_COLLAPSE_MS;
}

const moreDelay = computed(() => (expanded.value ? props.items.length * STAGGER_STEP_EXPAND_MS : 0));

// 展开态间隙按容器实际宽度计算，保证满行两端与左右边距对齐（第一个头像钉在
// padding 起点，行尾预留同样的边距）；量不到宽度时回退到写死的档位默认值。
// 尺寸/边距/最小间隙的 rpx 值与 neo-tokens.css 保持一致。
const SIZE_RPX: Record<NeoAvatarSize, number> = { xs: 42, sm: 52, md: 68, lg: 84 };
const SIDE_RPX: Record<NeoAvatarSize, number> = { xs: 10, sm: 14, md: 14, lg: 14 };
const MIN_GAP_RPX: Record<NeoAvatarSize, number> = { xs: 8, sm: 10, md: 10, lg: 10 };

const expandedGap = ref("");

function computeExpandedGap(containerWidth: number, size: NeoAvatarSize, total: number) {
  const sidePx = uni.upx2px(SIDE_RPX[size]);
  const avatarPx = uni.upx2px(SIZE_RPX[size]);
  const minGapPx = uni.upx2px(MIN_GAP_RPX[size]);
  const usable = containerWidth - sidePx * 2;
  if (usable <= avatarPx || total <= 1) {
    expandedGap.value = "";
    return;
  }
  // 每行最多能放多少个（间隙不小于最小值），行数不足一行时按实际数量算。
  const perRow = Math.min(
    Math.max(1, Math.floor((usable + minGapPx) / (avatarPx + minGapPx))),
    total,
  );
  const gapPx = perRow > 1 ? (usable - perRow * avatarPx) / (perRow - 1) : minGapPx;
  // 项很少时避免间隙被拉得过大，封顶为一个头像宽。
  expandedGap.value = `${Math.min(gapPx, avatarPx)}px`;
}

function measureAndExpand() {
  const instance = getCurrentInstance()?.proxy;
  if (!instance) {
    expandedGap.value = "";
    expanded.value = true;
    return;
  }
  uni.createSelectorQuery()
    .in(instance)
    .select(".neo-avatar-stack")
    .boundingClientRect((rect) => {
      const width = Array.isArray(rect) ? rect[0]?.width ?? 0 : rect?.width ?? 0;
      // 展开态末尾还有 -N 角标，与头像同宽，计算每行容量时计入。
      computeExpandedGap(width, props.size, props.items.length + 1);
      expanded.value = true;
    })
    .exec();
}

function toggleExpanded() {
  if (expanded.value) {
    expanded.value = false;
    if (wrapDisableTimer) clearTimeout(wrapDisableTimer);
    const totalMs = props.items.length * STAGGER_STEP_COLLAPSE_MS + RESTORE_DURATION_MS;
    wrapDisableTimer = setTimeout(() => {
      wrapEnabled.value = false;
    }, totalMs);
  } else {
    if (wrapDisableTimer) clearTimeout(wrapDisableTimer);
    wrapEnabled.value = true;
    measureAndExpand();
  }
}

onUnmounted(() => {
  if (wrapDisableTimer) clearTimeout(wrapDisableTimer);
});

function fallbackName(name: string) {
  return name.trim().slice(0, 1) || "?";
}

function handleSelect(item: NeoAvatarItem) {
  if (props.interactive) emit("select", item.id);
}
</script>

<template>
  <view
    class="neo-avatar-stack"
    :class="[
      `neo-avatar-stack--${size}`,
      shouldWrap ? 'neo-avatar-stack--wrap' : '',
      expanded ? 'neo-avatar-stack--expanded' : '',
      isUnlimited ? 'neo-avatar-stack--stacked' : '',
    ]"
    :style="expanded && expandedGap ? { '--neo-avatar-gap-effective': expandedGap } : undefined"
  >
    <view
      v-for="(item, index) in items"
      :key="item.id"
      class="neo-avatar-stack__item"
      :class="[
        isOverflow(index) ? 'neo-avatar-stack__item--overflow' : '',
        interactive ? 'neo-avatar-stack__item--interactive' : '',
        selectedId === item.id ? 'neo-avatar-stack__item--selected' : '',
      ]"
      :style="{ backgroundColor: item.tone || 'var(--neo-color-text)', '--avatar-delay': `${staggerDelay(index)}ms` }"
      :hover-class="interactive ? 'neo-avatar-stack__item--pressed' : 'none'"
      @tap="handleSelect(item)"
    >
      <image v-if="item.avatarUrl" class="neo-avatar-stack__image" :src="item.avatarUrl" mode="aspectFill" />
      <text v-else class="neo-avatar-stack__fallback">{{ fallbackName(item.name) }}</text>
    </view>
    <view
      v-if="overflowCount"
      class="neo-avatar-stack__more neo-avatar-stack__more--toggle"
      :style="{ '--avatar-delay': `${moreDelay}ms` }"
      hover-class="neo-avatar-stack__more--pressed"
      @tap.stop="toggleExpanded"
    >
      {{ expanded ? "-" : "+" }}{{ overflowCount }}
    </view>
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
  row-gap: 12rpx;
}

/* 不限数量的常驻叠压换行：行首保持相同的重叠偏移，避免第二行相对第一行左移。
   只挂在 unlimited 模式上——受限模式收回过渡期 wrap 仍开着，若挂 --wrap 会把
   第一个头像拽向左再弹回，产生抖动。 */
.neo-avatar-stack--stacked .neo-avatar-stack__item:first-child,
.neo-avatar-stack--stacked .neo-avatar-stack__more:first-child {
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
  /* 按压/选中反馈即时响应；展开与收回的几何变化按 --avatar-delay 逐项进行。 */
  transition-property: transform, box-shadow, width, margin-left, margin-right, opacity;
  transition-duration: 120ms, 120ms, var(--neo-avatar-restore-duration), var(--neo-avatar-restore-duration), var(--neo-avatar-restore-duration), var(--neo-avatar-restore-duration);
  transition-timing-function: ease, ease, var(--neo-avatar-restore-easing), var(--neo-avatar-restore-easing), var(--neo-avatar-restore-easing), var(--neo-avatar-restore-easing);
  transition-delay: 0ms, 0ms, var(--avatar-delay, 0ms), var(--avatar-delay, 0ms), var(--avatar-delay, 0ms), var(--avatar-delay, 0ms);
}

.neo-avatar-stack__item:first-child {
  margin-left: 0;
}

/* 受限模式收起时，溢出头像收缩为 0 宽并隐藏；展开时恢复档位尺寸逐个长出。 */
.neo-avatar-stack:not(.neo-avatar-stack--expanded) .neo-avatar-stack__item--overflow {
  width: 0;
  margin-left: 0;
  opacity: 0;
  border-width: 0;
  pointer-events: none;
}

/* 展开态：头像滑开互不遮挡；容器 padding 保持不变，第一个头像钉在原位。
   间隙优先用按容器宽度算出的 --neo-avatar-gap-effective（满行两端与左右
   边距对齐），量不到时回退档位默认值。 */
.neo-avatar-stack--expanded .neo-avatar-stack__item,
.neo-avatar-stack--expanded .neo-avatar-stack__more {
  margin-left: 0;
  margin-right: var(--neo-avatar-gap-effective, var(--neo-avatar-gap));
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

/* xs 档（首页卡片）：尺寸和重叠量更小，文字与 +N 角标字号同步缩小。 */
.neo-avatar-stack--xs {
  padding-left: var(--neo-avatar-overlap-xs);
}

.neo-avatar-stack--xs .neo-avatar-stack__item,
.neo-avatar-stack--xs .neo-avatar-stack__more {
  width: var(--neo-avatar-size-xs);
  height: var(--neo-avatar-size-xs);
  margin-left: var(--neo-avatar-overlap-negative-xs);
}

.neo-avatar-stack--xs .neo-avatar-stack__item:first-child {
  margin-left: 0;
}

.neo-avatar-stack--xs.neo-avatar-stack--stacked .neo-avatar-stack__item:first-child,
.neo-avatar-stack--xs.neo-avatar-stack--stacked .neo-avatar-stack__more:first-child {
  margin-left: var(--neo-avatar-overlap-negative-xs);
}

.neo-avatar-stack--xs .neo-avatar-stack__fallback {
  font-size: 18rpx;
}

.neo-avatar-stack--xs .neo-avatar-stack__more {
  font-size: 16rpx;
}

.neo-avatar-stack--xs.neo-avatar-stack--expanded .neo-avatar-stack__item,
.neo-avatar-stack--xs.neo-avatar-stack--expanded .neo-avatar-stack__more {
  margin-left: 0;
  margin-right: var(--neo-avatar-gap-effective, var(--neo-avatar-gap-xs));
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

.neo-avatar-stack__more--pressed {
  transform: translate(2rpx, 2rpx);
  box-shadow: none;
}
</style>
