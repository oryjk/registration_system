<script setup lang="ts">
import { computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useSettingsPage } from "./useSettingsPage";

const {
  isLoading,
  isOwner,
  clearProfileEnabled,
  reviewToggleEnabled,
  currentReviewLabel,
  loadPageData,
  handleClearProfile,
  handleToggleReviewStatus,
} = useSettingsPage();

const navMetrics = getCustomNavMetrics();
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const hasVisibleItems = computed(() => clearProfileEnabled.value || reviewToggleEnabled.value);

onShow(async () => {
  await loadPageData();
  // 直达（分享/手输路径）时拦在门外；「我的」页入口本身只对负责人账号显示。
  if (!isOwner.value) {
    uni.showToast({ title: "该页面仅对指定账号开放", icon: "none" });
    setTimeout(() => {
      uni.navigateBack({
        fail: () => {
          uni.switchTab({ url: "/pages/user/index" });
        },
      });
    }, 600);
  }
});
</script>

<template>
  <view class="settings-page" :style="pageStyle">
    <AppTabHeader title="设置" showBack />

    <view class="settings-content">
      <NeoSurface v-if="isOwner" custom-class="settings-card">
        <NeoSectionHeader title="验证与运营" marker="设" caption="各项开关由管理端「系统设置」控制" />
        <view v-if="clearProfileEnabled" class="settings-item">
          <view class="settings-item__texts">
            <text class="settings-item__title">清除头像和昵称</text>
            <text class="settings-item__desc">清除后回到未完善资料状态，用于验证资料完善引导</text>
          </view>
          <NeoButton variant="outline" size="sm" @click="handleClearProfile">清除</NeoButton>
        </view>
        <view v-if="reviewToggleEnabled" class="settings-item">
          <view class="settings-item__texts">
            <text class="settings-item__title">审核状态：{{ currentReviewLabel }}</text>
            <text class="settings-item__desc">针对当前小程序版本切换审核状态，全量用户创建入口显隐立即变化</text>
          </view>
          <NeoButton variant="lime" size="sm" @click="handleToggleReviewStatus">
            {{ currentReviewLabel === "审核中" ? "切为已过审" : "切为审核中" }}
          </NeoButton>
        </view>
        <view v-if="!isLoading && !hasVisibleItems" class="settings-empty">
          <text class="settings-empty__text">暂无可用设置项，可在管理端「系统设置」打开对应开关</text>
        </view>
      </NeoSurface>

      <NeoSurface v-else custom-class="settings-card">
        <text class="settings-empty__text">该页面仅对指定账号开放</text>
      </NeoSurface>
    </view>
  </view>
</template>

<style scoped>
.settings-page {
  min-height: 100vh;
  padding: 0 28rpx 48rpx;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.settings-content {
  max-width: 900rpx;
  margin: 0 auto;
}

.settings-card {
  margin-top: 24rpx;
  padding: 6rpx 24rpx 28rpx;
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 26rpx;
}

.settings-item__texts {
  flex: 1;
  min-width: 0;
}

.settings-item__title {
  display: block;
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

.settings-item__desc {
  display: block;
  margin-top: 8rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.45;
}

.settings-empty {
  padding: 32rpx 0 8rpx;
}

.settings-empty__text {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.5;
}
</style>
