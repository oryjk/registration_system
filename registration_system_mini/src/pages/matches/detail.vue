<script setup lang="ts">
import { computed, ref } from "vue";
import { onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";
import MatchSignupCountSheet from "./components/MatchSignupCountSheet.vue";
import NeoSegmentedControl from "@/components/neo/NeoSegmentedControl.vue";
import NeoStickyActionBar from "@/components/neo/NeoStickyActionBar.vue";
import MatchDetailSkeleton from "./components/MatchDetailSkeleton.vue";
import MatchFinishCard from "./components/MatchFinishCard.vue";
import MatchIndividualRegistration from "./components/MatchIndividualRegistration.vue";
import MatchTeamRegistration from "./components/MatchTeamRegistration.vue";
import TeamSettlementCard from "./components/TeamSettlementCard.vue";
import { DEFAULT_SHARE_IMAGE_URL } from "@/utils/share";
import { useMatchDetailPage } from "./useMatchDetailPage";
import { useMatchTeamApplications } from "./useMatchTeamApplications";
import MatchTeamApplications from "./components/MatchTeamApplications.vue";

defineOptions({ inheritAttrs: false });

const {
  matchId,
  pageStyle,
  contentStyle,
  errorMessage,
  isLoading,
  match,
  sourceMatch,
  teamProgressItems,
  registrationMode,
  canUseTeamRegistration,
  isRegistrationClosed,
  matchKindLabel,
  publicationModeLabel,
  homeTeamLabel,
  displayOpponentLabel,
  homeTeamColor,
  awayTeamColor,
  matchClockLabel,
  matchLocation,
  joinedCount,
  requiredPlayers,
  progressTargetPlayers,
  maxPlayers,
  countdownText,
  currentStatus,
  participantPreview,
  teamMemberRegistrationGroups,
  remainingPlayersLabel,
  submittingStatus,
  pendingPaymentFeeLabel,
  submittingPayment,
  handlePayRegistration,
  confirmRegistrationAction,
  confirmDialogVisible,
  confirmDialogState,
  handleConfirmPrimary,
  handleConfirmSecondary,
  handleConfirmClose,
  individualCtaLabel,
  canSubmitIndividualRegistration,
  isGuestMode,
  isPickupMatch,
  myRegistrationPaid,
  myRegistrationCount,
  signupSheetVisible,
  signupMaxCount,
  feePerPersonLabel,
  closeSignupSheet,
  handleSignupSheetConfirm,
  handleSignupSheetCancelRegistration,
  currentTeam,
  dateLine,
  heroMetaChips,
  opponentTeam,
  existingTeamDerivedActivity,
  teamFormTitle,
  teamSignupHint,
  teamRegistrationCount,
  teamRegistrationCountOptions,
  canShowCheckIn,
  hasCheckedIn,
  canManageCurrentMatch,
  checkInForm,
  canShowActivityReview,
  canSubmitActivityReview,
  reviewSubmitted,
  reviewForm,
  canShowSettlement,
  settlementSummary,
  settlementForm,
  settlementParticipants,
  settlementAttendeeCount,
  settlementSearchKeyword,
  settlementSearchResults,
  settlementSearching,
  teamSubmitLabel,
  openMatchLocation,
  handleSelectIndividualSignup,
  handleSelectTeamMemberStand,
  handleCheckIn,
  handleCheckInSwitchChange,
  handleSaveCheckInConfig,
  handleReviewRatingChange,
  handleSubmitActivityReview,
  handleSettlementModeChange,
  handleSettlementScopeChange,
  handleSettlementChargeAmountInput,
  handleRemoveSettlementCustomUser,
  handleSearchSettlementUsers,
  handleAddSettlementCustomUser,
  handleSubmitSettlement,
  handleTeamSubmit,
  canFinishMatch,
  canCancelMatch,
  finishDialogVisible,
  handleOpenFinishDialog,
  handleCloseFinishDialog,
  handleFinishMatch,
  cancelDialogVisible,
  cancelDialogState,
  handleCancelMatch,
  handleCancelPrimary,
  handleCancelSecondary,
  handleCancelClose,
  loadPageData,
} = useMatchDetailPage();

const {
  applications: matchApplications,
  isLoading: applicationsLoading,
  isSelecting: applicationSelecting,
  loadErrorMessage: applicationsError,
  canManageApplications,
  selectOpponent: selectMatchOpponent,
} = useMatchTeamApplications(sourceMatch, loadPageData, confirmRegistrationAction);

const registrationModeOptions = computed(() => [
  { label: "个人报名", value: "individual" },
  ...(canUseTeamRegistration.value ? [{ label: "球队报名", value: "team" }] : []),
]);

const shareTitle = computed(() => {
  if (!match.value) return "邀请你参加比赛报名";
  return `邀请你报名：${match.value.name}`;
});

const sharePath = computed(() => `/pages/matches/detail?id=${matchId.value || match.value?.id || ""}`);
const teamMemberDialogVisible = ref(false);

function handleTeamMemberDialogVisibilityChange(visible: boolean) {
  teamMemberDialogVisible.value = visible;
}

onShareAppMessage(() => ({
  title: shareTitle.value,
  path: sharePath.value,
  imageUrl: DEFAULT_SHARE_IMAGE_URL,
}));

onShareTimeline(() => ({
  title: shareTitle.value,
  query: `id=${matchId.value || match.value?.id || ""}`,
  imageUrl: DEFAULT_SHARE_IMAGE_URL,
}));
</script>

<template>
  <page-meta :page-style="teamMemberDialogVisible || confirmDialogVisible || finishDialogVisible || cancelDialogVisible || signupSheetVisible ? 'overflow: hidden;' : ''" />
  <view class="registration-page" :style="pageStyle">
    <AppTabHeader title="比赛报名" showBack showLocation />

    <view class="registration-content" :style="contentStyle">
      <view v-if="errorMessage" class="registration-empty">{{ errorMessage }}</view>
      <MatchDetailSkeleton v-else-if="isLoading" />

      <view v-else-if="match" class="registration-shell">
      <!-- 只有同时具备球队报名入口时才需要模式切换；单一「个人报名」时隐藏，避免无意义的占高。 -->
      <NeoSegmentedControl
        v-if="registrationModeOptions.length > 1"
        v-model="registrationMode"
        class="registration-segment"
        :options="registrationModeOptions"
      />

      <MatchIndividualRegistration
        v-if="registrationMode === 'individual'"
        :match="match"
        :match-kind-label="matchKindLabel"
        :publication-mode-label="publicationModeLabel"
        :home-team-label="homeTeamLabel"
        :display-opponent-label="displayOpponentLabel"
        :home-team-color="homeTeamColor"
        :away-team-color="awayTeamColor"
        :match-clock-label="matchClockLabel"
        :match-location="matchLocation"
        :joined-count="joinedCount"
        :required-players="progressTargetPlayers"
        :max-players="maxPlayers"
        :countdown-text="countdownText"
        :participant-preview="participantPreview"
        :remaining-players-label="remainingPlayersLabel"
        :submitting-status="submittingStatus"
        :individual-cta-label="individualCtaLabel"
        :is-guest-mode="isGuestMode"
        :can-submit-individual-registration="canSubmitIndividualRegistration"
        :registration-closed="isRegistrationClosed"
        :show-free-tag="!!sourceMatch?.is_free"
        :team-progress="teamProgressItems"
        :pending-payment-fee-label="pendingPaymentFeeLabel"
        :pending-payment-title="currentStatus === '参加' ? `已报 ${myRegistrationCount} 人 · 报名费待支付` : ''"
        :submitting-payment="submittingPayment"
        :current-team="currentTeam"
        :team-member-registration-groups="teamMemberRegistrationGroups"
        @open-location="openMatchLocation"
        @select-individual-signup="handleSelectIndividualSignup"
        @pay-registration="handlePayRegistration"
        @select-team-member-stand="handleSelectTeamMemberStand"
        @dialog-visibility-change="handleTeamMemberDialogVisibilityChange"
      />

      <MatchTeamRegistration
        v-if="registrationMode === 'team'"
        v-model:team-registration-count="teamRegistrationCount"
        :match="match"
        :date-line="dateLine"
        :hero-meta-chips="heroMetaChips"
        :publication-mode-label="publicationModeLabel"
        :current-team="currentTeam"
        :opponent-team="opponentTeam"
        :existing-team-derived-activity="existingTeamDerivedActivity"
        :team-form-title="teamFormTitle"
        :team-signup-hint="teamSignupHint"
        :team-registration-count-options="teamRegistrationCountOptions"
        :can-show-check-in="canShowCheckIn"
        :has-checked-in="hasCheckedIn"
        :can-manage-current-match="canManageCurrentMatch"
        :check-in-form="checkInForm"
        :can-show-activity-review="canShowActivityReview"
        :can-submit-activity-review="canSubmitActivityReview"
        :review-submitted="reviewSubmitted"
        :review-form="reviewForm"
        :submitting-status="submittingStatus"
        @check-in="handleCheckIn"
        @check-in-switch-change="handleCheckInSwitchChange"
        @save-check-in-config="handleSaveCheckInConfig"
        @review-rating-change="handleReviewRatingChange"
        @submit-activity-review="handleSubmitActivityReview"
      />
      <!-- 接约申请是主队管理功能，不依赖“球队报名”标签（Go 比赛没有该标签）。 -->
      <MatchTeamApplications
        v-if="canManageApplications"
        :applications="matchApplications"
        :is-loading="applicationsLoading"
        :is-selecting="applicationSelecting"
        :load-error-message="applicationsError"
        @select-opponent="selectMatchOpponent"
      />
      <!-- 主队管理方在比赛过结束时间后收尾比赛。 -->
      <MatchFinishCard
        v-if="(canFinishMatch || canCancelMatch) && sourceMatch"
        :match="sourceMatch"
        :submitting-status="submittingStatus"
        :can-cancel="canCancelMatch"
        @open-finish-dialog="handleOpenFinishDialog"
        @cancel-match="handleCancelMatch"
      />
      <TeamSettlementCard
        v-if="registrationMode === 'team' && canShowSettlement"
        v-model:search-keyword="settlementSearchKeyword"
        :summary="settlementSummary"
        :form="settlementForm"
        :participants="settlementParticipants"
        :attendee-count="settlementAttendeeCount"
        :search-results="settlementSearchResults"
        :searching="settlementSearching"
        :submitting-status="submittingStatus"
        @mode-change="handleSettlementModeChange"
        @scope-change="handleSettlementScopeChange"
        @charge-amount-input="handleSettlementChargeAmountInput"
        @remove-custom-user="handleRemoveSettlementCustomUser"
        @search-users="handleSearchSettlementUsers"
        @add-custom-user="handleAddSettlementCustomUser"
        @submit-settlement="handleSubmitSettlement"
      />
      </view>
    </view>

    <NeoStickyActionBar v-if="match && registrationMode === 'team' && canUseTeamRegistration && !isRegistrationClosed">
      <NeoButton
        block
        :loading="submittingStatus"
        :disabled="submittingStatus"
        @click="handleTeamSubmit"
      >
        {{ submittingStatus ? "提交中..." : teamSubmitLabel }}
      </NeoButton>
    </NeoStickyActionBar>

    <NeoConfirmDialog
      :visible="confirmDialogVisible"
      :title="confirmDialogState.title"
      :message="confirmDialogState.message"
      :highlight="confirmDialogState.highlight"
      :primary-text="confirmDialogState.primaryText"
      :secondary-text="confirmDialogState.secondaryText"
      :primary-tone="confirmDialogState.primaryTone"
      :loading="submittingStatus"
      @primary="handleConfirmPrimary"
      @secondary="handleConfirmSecondary"
      @close="handleConfirmClose"
    />

    <!-- 结束比赛：主按钮=正常结束，次按钮=取消比赛，遮罩/× 只是关闭不改动状态。
         赛前支付的比赛不支持取消（后端同样拦截），只保留正常结束。 -->
    <NeoConfirmDialog
      :visible="finishDialogVisible"
      title="结束比赛"
      message="比赛时间已过，请选择本场比赛的最终结果。"
      primary-text="比赛结束"
      :secondary-text="sourceMatch?.payment_mode === 'prepaid' ? '' : '比赛取消'"
      :loading="submittingStatus"
      @primary="handleFinishMatch('ended')"
      @secondary="handleFinishMatch('cancelled')"
      @close="handleCloseFinishDialog"
    />

    <!-- 赛前取消比赛：创建者二次确认（danger），确认后提交 cancelled。 -->
    <NeoConfirmDialog
      :visible="cancelDialogVisible"
      :title="cancelDialogState.title"
      :message="cancelDialogState.message"
      :highlight="cancelDialogState.highlight"
      :primary-text="cancelDialogState.primaryText"
      :secondary-text="cancelDialogState.secondaryText"
      :primary-tone="cancelDialogState.primaryTone"
      :loading="submittingStatus"
      @primary="handleCancelPrimary"
      @secondary="handleCancelSecondary"
      @close="handleCancelClose"
    />

    <!-- 散人约球：报名人数选择（一人可代朋友报名，费用按人数合计）。 -->
    <MatchSignupCountSheet
      :visible="signupSheetVisible"
      :max-count="signupMaxCount"
      :current-count="currentStatus === '参加' ? myRegistrationCount : 1"
      :fee-per-person-label="feePerPersonLabel"
      :submitting="submittingStatus"
      :can-cancel="currentStatus === '参加' && !myRegistrationPaid"
      @close="closeSignupSheet"
      @confirm="handleSignupSheetConfirm"
      @cancel-registration="handleSignupSheetCancelRegistration"
    />
  </view>
</template>

<style scoped>
.registration-page {
  min-height: 100vh;
  padding-left: 24rpx;
  padding-right: 24rpx;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.registration-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.registration-segment {
  width: 100%;
}

.registration-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 520rpx;
  color: var(--neo-color-text-muted);
  font-size: 30rpx;
  font-weight: 700;
}

/* #ifdef H5 */
.registration-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.registration-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
