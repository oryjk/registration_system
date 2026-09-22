<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  /** 展开态：标题行宽度动画过渡到搜索框，球队名被挤掉；由父页面持有。 */
  active: boolean;
  query: string;
}>();

const emit = defineEmits<{
  (event: "update:active", value: boolean): void;
  (event: "update:query", value: string): void;
  (event: "search"): void;
  (event: "clear"): void;
}>();

// 宽度收起动画（240ms）结束后再换回图标，避免搜索框瞬间消失；展开则立即换内容。
const showField = ref(props.active);
let collapseTimer: ReturnType<typeof setTimeout> | null = null;

watch(() => props.active, (active) => {
  if (collapseTimer) {
    clearTimeout(collapseTimer);
    collapseTimer = null;
  }
  if (active) {
    showField.value = true;
    return;
  }
  collapseTimer = setTimeout(() => {
    showField.value = false;
    collapseTimer = null;
  }, 260);
});

onBeforeUnmount(() => {
  if (collapseTimer) clearTimeout(collapseTimer);
});

function openSearch() {
  emit("update:active", true);
}

function cancelSearch() {
  emit("update:active", false);
  emit("clear");
}

function updateQuery(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  emit("update:query", detail.detail?.value ?? "");
}
</script>

<template>
  <view class="home-header-search">
    <!-- 收起态：标题行右端一个放大镜图标，不带文字。 -->
    <view
      v-if="!showField"
      class="home-header-search__icon"
      hover-class="home-header-search__icon--pressed"
      :hover-stay-time="100"
      aria-label="搜索我的比赛"
      @tap="openSearch"
    >
      <view class="home-header-search__glyph">
        <view class="home-header-search__glyph-lens" />
        <view class="home-header-search__glyph-handle" />
      </view>
    </view>

    <!-- 展开态：整行变为搜索框 + 取消；搜索结果面板仍在页面正文。 -->
    <view v-else class="home-header-search__row">
      <view class="home-header-search__bar">
        <view class="home-header-search__glyph">
          <view class="home-header-search__glyph-lens" />
          <view class="home-header-search__glyph-handle" />
        </view>
        <input
          :value="query"
          :focus="showField"
          class="home-header-search__input"
          placeholder="搜索我的比赛"
          placeholder-class="home-header-search__placeholder"
          confirm-type="search"
          @input="updateQuery"
          @confirm="emit('search')"
        />
        <view
          v-if="query"
          class="home-header-search__clear"
          hover-class="home-header-search__clear--pressed"
          :hover-stay-time="100"
          @tap="emit('clear')"
        >
          ×
        </view>
      </view>
      <text
        class="home-header-search__cancel"
        hover-class="home-header-search__cancel--pressed"
        :hover-stay-time="100"
        @tap="cancelSearch"
      >
        取消
      </text>
    </view>
  </view>
</template>

<style scoped>
/* D 风格浅色描边：与 AppTabHeader 的 --app-tab-header-line 同值，待统一 token 收敛。 */
.home-header-search {
  --home-header-search-line: #e4eaf2;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  min-width: 0;
}

.home-header-search__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
}

.home-header-search__icon--pressed {
  opacity: 0.8;
}

/* 裸图标态：无外框，图形比搜索框内的小图标略大。 */
.home-header-search__icon .home-header-search__glyph-lens {
  width: 22rpx;
  height: 22rpx;
}

.home-header-search__icon .home-header-search__glyph-handle {
  width: 11rpx;
}

/* 纯 CSS 放大镜：镜片 + 斜柄，两处复用（图标与搜索框内）。 */
.home-header-search__glyph {
  position: relative;
  flex-shrink: 0;
  width: 26rpx;
  height: 26rpx;
}

.home-header-search__glyph-lens {
  width: 18rpx;
  height: 18rpx;
  border: 3rpx solid var(--ui-color-text);
  border-radius: 50%;
  box-sizing: border-box;
  margin: 1rpx 0 0 1rpx;
}

.home-header-search__glyph-handle {
  position: absolute;
  right: 0;
  bottom: 1rpx;
  width: 9rpx;
  height: 3rpx;
  background: var(--ui-color-text);
  border-radius: 2rpx;
  transform: rotate(45deg);
  transform-origin: right center;
}

.home-header-search__row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  width: 100%;
  min-width: 0;
}

.home-header-search__bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
  flex: 1;
  height: 64rpx;
  padding: 0 18rpx 0 22rpx;
  border: 2rpx solid var(--home-header-search-line);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-surface);
  box-sizing: border-box;
}

.home-header-search__bar .home-header-search__glyph-lens {
  border-color: var(--ui-color-text-muted);
}

.home-header-search__bar .home-header-search__glyph-handle {
  background: var(--ui-color-text-muted);
}

.home-header-search__input {
  min-width: 0;
  flex: 1;
  height: 100%;
  color: var(--ui-color-text);
  font-size: 26rpx;
}

.home-header-search__placeholder {
  color: var(--ui-color-text-disabled);
}

.home-header-search__clear {
  display: flex;
  width: 40rpx;
  height: 40rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-muted);
  color: var(--ui-color-text-muted);
  font-size: 30rpx;
  line-height: 1;
}

.home-header-search__clear--pressed {
  opacity: 0.7;
}

.home-header-search__cancel {
  flex-shrink: 0;
  padding: 8rpx 4rpx;
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
  font-weight: 600;
}

.home-header-search__cancel--pressed {
  opacity: 0.7;
}
</style>
