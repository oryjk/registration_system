<script setup lang="ts">
import { computed, ref } from "vue";
import { onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { NeoButton, NeoSegmentedControl, NeoStickyActionBar } from "@/components/neo";
import MatchDetailSkeleton from "./components/MatchDetailSkeleton.vue";
import MatchIndividualRegistration from "./components/MatchIndividualRegistration.vue";
import MatchTeamRegistration from "./components/MatchTeamRegistration.vue";
import TeamSettlementCard from "./components/TeamSettlementCard.vue";
import { DEFAULT_SHARE_IMAGE_URL } from "@/utils/share";
import { useMatchDetailPage } from "./useMatchDetailPage";

defineOptions({ inheritAttrs: false });

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
  maxPlayers,
  countdownText,
  participantPreview,
  teamMemberRegistrationGroups,
  remainingPlayersLabel,
  submittingStatus,
  individualCtaLabel,
  canSubmitIndividualRegistration,
  isGuestMode,
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
} = useMatchDetailPage();

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
  <page-meta :page-style="teamMemberDialogVisible ? 'overflow: hidden;' : ''" />
  <view class="registration-page" :style="pageStyle">
    <AppTabHeader title="比赛报名" showBack showLocation />

    <view class="registration-content" :style="contentStyle">
      <view v-if="errorMessage" class="registration-empty">{{ errorMessage }}</view>
      <MatchDetailSkeleton v-else-if="isLoading" />

      <view v-else-if="match" class="registration-shell">
      <NeoSegmentedControl
        v-model="registrationMode"
        class="registration-segment"
        :options="registrationModeOptions"
      />

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
        :max-players="maxPlayers"
        :countdown-text="countdownText"
        :participant-preview="participantPreview"
        :remaining-players-label="remainingPlayersLabel"
        :submitting-status="submittingStatus"
        :individual-cta-label="individualCtaLabel"
        :is-guest-mode="isGuestMode"
        :can-submit-individual-registration="canSubmitIndividualRegistration"
        :current-team="currentTeam"
        :team-member-registration-groups="teamMemberRegistrationGroups"
        @open-location="openMatchLocation"
        @select-individual-signup="handleSelectIndividualSignup"
        @select-team-member-stand="handleSelectTeamMemberStand"
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

    <NeoStickyActionBar v-if="match && registrationMode === 'team' && canUseTeamRegistration">
      <NeoButton
        block
        :loading="submittingStatus"
        :disabled="submittingStatus"
        @click="handleTeamSubmit"
      >
        {{ submittingStatus ? "提交中..." : teamSubmitLabel }}
      </NeoButton>
    </NeoStickyActionBar>
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
