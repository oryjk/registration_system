<script setup lang="ts">
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import type { AppUser } from "@/types/app";
import { impersonationTargetLabel } from "../mineImpersonation";

defineProps<{
  impersonating: boolean;
  canSwitch: boolean;
  currentName: string;
  keyword: string;
  results: AppUser[];
  searching: boolean;
  switching: boolean;
  restoring: boolean;
  searched: boolean;
}>();

const emit = defineEmits<{
  (event: "update:keyword", value: string): void;
  (event: "search"): void;
  (event: "switch", user: AppUser): void;
  (event: "restore"): void;
}>();

function handleKeywordInput(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  emit("update:keyword", detail.detail?.value ?? "");
}
</script>

<template>
  <!-- 切换中：醒目警示卡片，任何身份下都提供一键恢复入口。 -->
  <NeoSurface v-if="impersonating" variant="raised" flush>
    <view class="impersonation-banner">
      <view class="impersonation-banner__chip">
        <text class="impersonation-banner__chip-text">调试模式</text>
      </view>
      <view class="impersonation-banner__copy">
        <text class="impersonation-banner__title">正在以「{{ currentName }}」的身份使用小程序</text>
        <text class="impersonation-banner__desc">所有操作都会以该用户身份生效，仅用于问题排查复现。</text>
      </view>
      <NeoButton block variant="dark" :loading="restoring" :disabled="restoring" @click="emit('restore')">
        {{ restoring ? "恢复中..." : "恢复我的身份" }}
      </NeoButton>
    </view>
  </NeoSurface>

  <!-- 产品负责人调试入口：搜索并切换为任意用户。 -->
  <NeoSurface v-else-if="canSwitch" variant="raised" flush>
    <view class="impersonation-panel">
      <view class="impersonation-panel__head">
        <text class="impersonation-panel__title">身份切换</text>
        <text class="impersonation-panel__desc">调试专用：切换为任意用户复现问题，可随时恢复本人身份。</text>
      </view>
      <view class="impersonation-panel__search">
        <input
          class="impersonation-panel__input"
          :value="keyword"
          placeholder="昵称 / 姓名 / 手机号 / 用户 ID"
          confirm-type="search"
          @input="handleKeywordInput"
          @confirm="emit('search')"
        />
        <NeoButton variant="dark" size="sm" :loading="searching" :disabled="searching || switching" @click="emit('search')">
          搜索
        </NeoButton>
      </view>
      <view v-if="results.length" class="impersonation-panel__results">
        <view
          v-for="user in results"
          :key="user.id"
          class="impersonation-panel__result"
          hover-class="impersonation-panel__result--pressed"
          :hover-stay-time="100"
          @click="emit('switch', user)"
        >
          <view class="impersonation-panel__result-main">
            <text class="impersonation-panel__result-name">{{ impersonationTargetLabel(user) }}</text>
            <text class="impersonation-panel__result-meta">ID {{ user.id }}{{ user.phone_number ? ` · ${user.phone_number}` : "" }}</text>
          </view>
          <text class="impersonation-panel__result-action">{{ switching ? "切换中..." : "切换 ›" }}</text>
        </view>
      </view>
      <text v-else-if="searched && !searching" class="impersonation-panel__empty">没有匹配的用户</text>
    </view>
  </NeoSurface>
</template>

<style scoped>
/* 布局与配色都由自己模板内的包裹 view 承载（NeoSurface flush），避免 custom-class 布局在 mp 端失效。 */
.impersonation-banner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16rpx;
  padding: 28rpx;
  background: var(--neo-color-warning-soft);
}

.impersonation-banner__chip {
  padding: 4rpx 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-text);
}

.impersonation-banner__chip-text {
  color: var(--neo-color-text-inverse);
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}

.impersonation-banner__copy {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.impersonation-banner__title {
  color: var(--neo-color-text);
  font-size: 32rpx;
  font-weight: 950;
  line-height: 1.3;
}

.impersonation-banner__desc {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.5;
}

.impersonation-banner :deep(.neo-button) {
  align-self: stretch;
}

.impersonation-panel {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 28rpx;
}

.impersonation-panel__head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.impersonation-panel__title {
  color: var(--neo-color-text);
  font-size: 32rpx;
  font-weight: 950;
}

.impersonation-panel__desc {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.5;
}

.impersonation-panel__search {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.impersonation-panel__input {
  flex: 1;
  min-width: 0;
  height: 80rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.impersonation-panel__results {
  display: flex;
  flex-direction: column;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  overflow: hidden;
}

.impersonation-panel__result {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;
  background: var(--neo-color-surface);
}

.impersonation-panel__result--pressed {
  background: var(--neo-color-muted);
}

.impersonation-panel__result + .impersonation-panel__result {
  border-top: var(--neo-border-default);
}

.impersonation-panel__result-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4rpx;
}

.impersonation-panel__result-name {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.impersonation-panel__result-meta {
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
}

.impersonation-panel__result-action {
  color: var(--neo-color-accent-deep);
  font-size: 24rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.impersonation-panel__empty {
  padding: 12rpx 0;
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 700;
  text-align: center;
}
</style>
