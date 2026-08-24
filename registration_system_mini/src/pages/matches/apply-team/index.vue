<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";
import ApplyTeamInheritCard from "./components/ApplyTeamInheritCard.vue";
import ApplyTeamFormCard from "./components/ApplyTeamFormCard.vue";
import ApplyTeamStatusCard from "./components/ApplyTeamStatusCard.vue";
import { useApplyTeamPage } from "./useApplyTeamPage";
import { getCustomNavMetrics } from "@/utils/customNav";

const matchId = ref("");
const {
  isLoading,
  errorMessage,
  detail,
  myApplication,
  introduction,
  isSubmitting,
  isWithdrawing,
  confirmDialogVisible,
  confirmDialogState,
  handleConfirmPrimary,
  handleConfirmSecondary,
  handleConfirmClose,
  teamName,
  canApply,
  canWithdraw,
  blockedMessage,
  hasActiveApplication,
  loadPageData,
  submitApplication,
  withdrawApplication,
  openMatchDetail,
} = useApplyTeamPage(matchId);

const navMetrics = getCustomNavMetrics();
const pageStyle = computed(() => ({
  padding: "0 28rpx 96rpx",
}));
const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

onLoad((options) => {
  matchId.value = options?.id ?? "";
  if (!matchId.value) {
    uni.showToast({ title: "比赛信息缺失", icon: "none" });
    setTimeout(() => uni.navigateBack(), 600);
    return;
  }
  void loadPageData();
});

onShow(() => {
  uni.hideTabBar({ animation: false });
});
</script>

<template>
  <view class="apply-team-page" :style="pageStyle">
    <AppTabHeader title="接约确认" showBack />

    <view class="apply-team-content" :style="contentStyle">
      <view v-if="isLoading" class="apply-team-hint">加载接约信息中...</view>

      <view v-else-if="errorMessage" class="apply-team-hint">
        <view>{{ errorMessage }}</view>
        <view class="apply-team-retry" @tap="loadPageData()">点击重试</view>
      </view>

      <template v-else-if="detail">
        <ApplyTeamInheritCard :detail="detail" />

        <ApplyTeamStatusCard
          v-if="hasActiveApplication && myApplication"
          :application="myApplication"
          :is-withdrawing="isWithdrawing"
          :can-withdraw="canWithdraw"
          @withdraw="withdrawApplication()"
          @go-match="openMatchDetail()"
        />

        <view v-else-if="!canApply" class="apply-team-blocked">
          <text class="apply-team-blocked-title">暂时无法接约</text>
          <text class="apply-team-blocked-copy">
            {{ blockedMessage }}
          </text>
        </view>

        <ApplyTeamFormCard
          v-else
          :team-name="teamName"
          v-model:introduction="introduction"
          :is-submitting="isSubmitting"
          @submit="submitApplication()"
        />
      </template>
    </view>

    <NeoConfirmDialog
      :visible="confirmDialogVisible"
      :title="confirmDialogState.title"
      :message="confirmDialogState.message"
      :highlight="confirmDialogState.highlight"
      :primary-text="confirmDialogState.primaryText"
      :secondary-text="confirmDialogState.secondaryText"
      :primary-tone="confirmDialogState.primaryTone"
      :loading="isWithdrawing"
      @primary="handleConfirmPrimary"
      @secondary="handleConfirmSecondary"
      @close="handleConfirmClose"
    />
  </view>
</template>

<style scoped>
.apply-team-page {
  min-height: 100vh;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.apply-team-content {
  position: relative;
}

.apply-team-hint {
  padding: 28rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text-muted);
  font-size: 26rpx;
  line-height: 1.6;
}

.apply-team-retry {
  display: inline-flex;
  margin-top: 16rpx;
  padding: 10rpx 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 700;
}

.apply-team-blocked {
  margin-top: 20rpx;
  padding: 28rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
}

.apply-team-blocked-title {
  display: block;
  font-size: 30rpx;
  font-weight: 900;
  color: var(--neo-color-text);
}

.apply-team-blocked-copy {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
  font-weight: 600;
  color: var(--neo-color-text-muted);
}

/* #ifdef H5 */
.apply-team-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.apply-team-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
