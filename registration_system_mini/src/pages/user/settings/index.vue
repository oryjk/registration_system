<script setup lang="ts">
import { usePageRefresh } from "@/composables/usePageRefresh";
import { useAccentTheme } from "@/stores/theme";
import { computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useSettingsPage } from "./useSettingsPage";

const { themePageStyle } = useAccentTheme();

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
usePageRefresh(loadPageData);
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope settings-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader title="设置" showBack />

    <view class="settings-content ui-plain-panel">
      <AppSurface v-if="isOwner" custom-class="settings-card">
        <SectionHeader title="验证与运营" caption="各项开关由管理端「系统设置」控制" />
        <view v-if="clearProfileEnabled" class="settings-item ui-list-row">
          <view class="settings-item__texts">
            <text class="settings-item__title">清除头像和昵称</text>
            <text class="settings-item__desc">清除后回到未完善资料状态，用于验证资料完善引导</text>
          </view>
          <AppButton variant="outline" size="sm" @click="handleClearProfile">清除</AppButton>
        </view>
        <view v-if="reviewToggleEnabled" class="settings-item settings-item--stacked ui-list-row">
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
      </AppSurface>

      <AppSurface v-else custom-class="settings-card">
        <text class="settings-empty__text">该页面仅对指定账号开放</text>
      </AppSurface>
    </view>

    <ConfirmDialog
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
@import "@/styles/list-surfaces.css";

.settings-page {
  min-height: 100vh;
  padding: 0 28rpx 48rpx;
  background: var(--ui-color-page);
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
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.settings-item__desc {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 400;
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
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-sizing: border-box;
}

.settings-radio--pressed {
  box-shadow: var(--ui-shadow-control-pressed);
}

/* 未选中项保持实线边框与正常文字色（虚线灰显会被当成禁用）；选中态靠实心彩点与加重边框表达。 */
.settings-radio--active {
  border: var(--ui-border-default);
  box-shadow: var(--ui-shadow-raised);
}

.settings-radio__dot {
  width: 30rpx;
  height: 30rpx;
  flex-shrink: 0;
  border: 4rpx solid var(--ui-color-text);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-surface);
  box-sizing: border-box;
}

.settings-radio--active .settings-radio__dot {
  border-color: var(--ui-color-text);
  background: var(--ui-color-accent);
}

.settings-radio__label {
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.settings-empty {
  padding: 32rpx 0 8rpx;
}

.settings-empty__text {
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
  line-height: 1.5;
}

/* #ifdef MP-WEIXIN */
.settings-page { padding-right: var(--ui-page-padding-inline); padding-left: var(--ui-page-padding-inline); padding-bottom: var(--ui-page-padding-bottom); }
.settings-content { --ui-panel-padding: 0; }
.settings-item { gap: var(--ui-space-5); margin-top: 0; min-height: var(--ui-list-row-min-height); padding: var(--ui-space-6) 0; }
.settings-item + .settings-item { border-top: var(--ui-list-divider); }
.settings-item__title { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); }
.settings-item__desc { margin-top: var(--ui-space-2); font-size: var(--ui-text-sm); line-height: var(--ui-line-height-body); }
.settings-radio-group { gap: var(--ui-space-4); margin-top: var(--ui-space-4); }
.settings-radio { gap: var(--ui-space-3); min-height: var(--ui-control-min-height); padding: var(--ui-space-3) var(--ui-space-4); border: var(--ui-control-border); border-radius: var(--ui-control-radius); background: var(--ui-control-subtle-bg); }
.settings-radio--active { border: var(--ui-control-border); background: var(--ui-control-selected-bg); box-shadow: var(--ui-panel-shadow); }
.settings-radio__dot { width: var(--ui-icon-xs); height: var(--ui-icon-xs); border: var(--ui-border-hairline); }
.settings-radio__label { font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-heading); }
.settings-empty { padding: var(--ui-space-8) 0 var(--ui-space-2); }
.settings-empty__text { font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
/* #endif */
</style>
