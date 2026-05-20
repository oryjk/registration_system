<script setup lang="ts">
import { computed, ref } from "vue";
import { onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import MatchDetailSkeleton from "./components/MatchDetailSkeleton.vue";
import MatchIndividualRegistration from "./components/MatchIndividualRegistration.vue";
import MatchTeamRegistration from "./components/MatchTeamRegistration.vue";
import TeamSettlementCard from "./components/TeamSettlementCard.vue";
import { DEFAULT_SHARE_IMAGE_URL } from "@/utils/share";
import { useMatchDetailPage } from "./useMatchDetailPage";

const {
  matchId,
  pageStyle,
  contentStyle,
  errorMessage,
  isLoading,
  match,
  registrationMode,
  canUseTeamRegistration,
  matchKindLabel,
  homeTeamLabel,
  displayOpponentLabel,
  homeTeamColor,
  awayTeamColor,
  matchDateLabel,
  matchClockLabel,
  matchLocation,
  joinedCount,
  requiredPlayers,
  countdownText,
  progressBaseWidth,
  progressExtraWidth,
  progressSplitLeft,
  participantPreview,
  teamMemberRegistrationGroups,
  remainingPlayersLabel,
  submittingStatus,
  individualCtaLabel,
  isGuestMode,
  currentTeam,
  interestCards,
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
  openMatchDetail,
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
} = useMatchDetailPage();

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
  <page-meta :page-style="teamMemberDialogVisible ? 'overflow: hidden;' : ''" />
  <view class="registration-page" :style="pageStyle">
    <AppTabHeader title="比赛报名" showBack showLocation />

    <view class="registration-content" :style="contentStyle">
      <view v-if="errorMessage" class="registration-empty">{{ errorMessage }}</view>
      <MatchDetailSkeleton v-else-if="isLoading" />

      <view v-else-if="match" class="registration-shell">
      <view class="registration-segment">
        <view
          :class="['registration-segment-item', registrationMode === 'individual' ? 'registration-segment-item-active' : '']"
          @tap="registrationMode = 'individual'"
        >
          个人报名
        </view>
        <view
          v-if="canUseTeamRegistration"
          :class="['registration-segment-item', registrationMode === 'team' ? 'registration-segment-item-active' : '']"
          @tap="registrationMode = 'team'"
        >
          球队报名
        </view>
      </view>

      <MatchIndividualRegistration
        v-if="registrationMode === 'individual'"
        :match="match"
        :match-kind-label="matchKindLabel"
        :home-team-label="homeTeamLabel"
        :display-opponent-label="displayOpponentLabel"
        :home-team-color="homeTeamColor"
        :away-team-color="awayTeamColor"
        :match-date-label="matchDateLabel"
        :match-clock-label="matchClockLabel"
        :match-location="matchLocation"
        :joined-count="joinedCount"
        :required-players="requiredPlayers"
        :countdown-text="countdownText"
        :progress-base-width="progressBaseWidth"
        :progress-extra-width="progressExtraWidth"
        :progress-split-left="progressSplitLeft"
        :participant-preview="participantPreview"
        :remaining-players-label="remainingPlayersLabel"
        :submitting-status="submittingStatus"
        :individual-cta-label="individualCtaLabel"
        :is-guest-mode="isGuestMode"
        :current-team="currentTeam"
        :team-member-registration-groups="teamMemberRegistrationGroups"
        :interest-cards="interestCards"
        @open-location="openMatchLocation"
        @select-individual-signup="handleSelectIndividualSignup"
        @select-team-member-stand="handleSelectTeamMemberStand"
        @open-match-detail="openMatchDetail"
        @dialog-visibility-change="handleTeamMemberDialogVisibilityChange"
      />

      <MatchTeamRegistration
        v-if="registrationMode === 'team'"
        v-model:team-registration-count="teamRegistrationCount"
        :match="match"
        :date-line="dateLine"
        :hero-meta-chips="heroMetaChips"
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

    <view v-if="match && registrationMode === 'team' && canUseTeamRegistration" class="team-submit-bar">
      <view class="team-submit-button" @tap="handleTeamSubmit">{{ submittingStatus ? "提交中..." : teamSubmitLabel }}</view>
    </view>
  </view>
</template>

<style scoped>
.registration-page {
  min-height: 100vh;
  padding-left: 24rpx;
  padding-right: 24rpx;
  background: linear-gradient(180deg, #f7f7f7 0%, #f2f2f2 100%);
  box-sizing: border-box;
}

.registration-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.registration-segment {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 12rpx;
  padding: 10rpx;
  border-radius: 999rpx;
  background: #ececec;
}

.registration-segment-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 74rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
  color: #2e2e2e;
  font-weight: 800;
}

.registration-segment-item-active {
  background: #c8ff00;
  color: #171717;
}

.team-submit-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(env(safe-area-inset-bottom) + 22rpx);
  z-index: 40;
}

.team-submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 94rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, #2f82ff 0%, #2b68f7 100%);
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
  box-shadow: 0 16rpx 28rpx rgba(43, 104, 247, 0.28);
}

.registration-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 520rpx;
  color: #666666;
  font-size: 30rpx;
  font-weight: 700;
}
</style>
