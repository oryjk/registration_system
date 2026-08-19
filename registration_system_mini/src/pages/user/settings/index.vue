<script setup lang="ts">
import { computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useSettingsPage } from "./useSettingsPage";

const {
  isLoading,
  isOwner,
  clearProfileEnabled,
  reviewToggleEnabled,
  reviewMode,
  confirmDialogVisible,
  confirmDialogState,
  handleConfirmPrimary,
  handleConfirmSecondary,
  handleConfirmClose,
  handleConfirmLink,
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
        <view v-if="reviewToggleEnabled" class="settings-item settings-item--stacked">
          <view class="settings-item__texts">
            <text class="settings-item__title">审核状态</text>
            <text class="settings-item__desc">针对当前小程序版本切换审核状态，全量用户创建入口显隐立即变化</text>
          </view>
          <view class="settings-radio-group">
            <view
              :class="['settings-radio', reviewMode ? 'settings-radio--active' : '']"
              hover-class="settings-radio--pressed"
              :hover-stay-time="100"
              @click="!reviewMode && handleToggleReviewStatus()"
            >
              <view class="settings-radio__dot" />
              <text class="settings-radio__label">审核中</text>
            </view>
            <view
              :class="['settings-radio', !reviewMode ? 'settings-radio--active' : '']"
              hover-class="settings-radio--pressed"
              :hover-stay-time="100"
              @click="reviewMode && handleToggleReviewStatus()"
            >
              <view class="settings-radio__dot" />
              <text class="settings-radio__label">已过审</text>
            </view>
          </view>
        </view>
        <view v-if="!isLoading && !hasVisibleItems" class="settings-empty">
          <text class="settings-empty__text">暂无可用设置项，可在管理端「系统设置」打开对应开关</text>
        </view>
      </NeoSurface>

      <NeoSurface v-else custom-class="settings-card">
        <text class="settings-empty__text">该页面仅对指定账号开放</text>
      </NeoSurface>
    </view>

    <NeoConfirmDialog
      :visible="confirmDialogVisible"
      :title="confirmDialogState.title"
      :message="confirmDialogState.message"
      :highlight="confirmDialogState.highlight"
      :link-text="confirmDialogState.linkText"
      :primary-text="confirmDialogState.primaryText"
      :secondary-text="confirmDialogState.secondaryText"
      :primary-tone="confirmDialogState.primaryTone"
      @primary="handleConfirmPrimary"
      @secondary="handleConfirmSecondary"
      @close="handleConfirmClose"
      @link="handleConfirmLink"
    />
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

/* 审核状态带单选组，文字与选项改为上下排布。 */
.settings-item--stacked {
  flex-direction: column;
  align-items: stretch;
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

.settings-radio-group {
  display: flex;
  gap: 16rpx;
  margin-top: 22rpx;
}

.settings-radio {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 14rpx;
  min-height: 84rpx;
  padding: 0 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-sizing: border-box;
}

.settings-radio--pressed {
  opacity: 0.72;
}

/* 未选中项保持实线边框与正常文字色（虚线灰显会被当成禁用）；选中态靠实心彩点与加重边框表达。 */
.settings-radio--active {
  border: var(--neo-border-strong);
  box-shadow: var(--neo-shadow-raised);
}

.settings-radio__dot {
  width: 30rpx;
  height: 30rpx;
  flex-shrink: 0;
  border: 4rpx solid var(--neo-color-text);
  border-radius: var(--neo-radius-round);
  background: var(--neo-color-surface);
  box-sizing: border-box;
}

.settings-radio--active .settings-radio__dot {
  border-color: var(--neo-color-text);
  background: var(--neo-color-accent);
}

.settings-radio__label {
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 900;
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
