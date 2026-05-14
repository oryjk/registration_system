<script setup lang="ts">
import type { BackendActivity, BackendTeam } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import TeamActivityReviewCard from "./TeamActivityReviewCard.vue";
import TeamCheckInPanel from "./TeamCheckInPanel.vue";
import TeamCheckInSettingsCard from "./TeamCheckInSettingsCard.vue";
import TeamMatchInfoCard from "./TeamMatchInfoCard.vue";
import TeamRegistrationFormCard from "./TeamRegistrationFormCard.vue";
import TeamRegistrationHero from "./TeamRegistrationHero.vue";

const props = defineProps<{
  match: BackendActivity;
  dateLine: string;
  heroMetaChips: string[];
  currentTeam: TeamProfileViewModel | null;
  opponentTeam: BackendTeam | null;
  existingTeamDerivedActivity: BackendActivity | null;
  teamFormTitle: string;
  teamSignupHint: string;
  teamRegistrationCount: number;
  teamRegistrationCountOptions: Array<{ value: number; label: string }>;
  canShowCheckIn: boolean;
  hasCheckedIn: boolean;
  canManageCurrentMatch: boolean;
  checkInForm: {
    enabled: boolean;
    radiusMeters: number;
    openMinutesBefore: number;
    closeMinutesAfter: number;
  };
  canShowActivityReview: boolean;
  canSubmitActivityReview: boolean;
  reviewSubmitted: boolean;
  reviewForm: {
    rating: number;
    comment: string;
  };
  submittingStatus: boolean;
}>();

const emit = defineEmits<{
  (event: "update:teamRegistrationCount", value: number): void;
  (event: "checkIn"): void;
  (event: "checkInSwitchChange", value: Event): void;
  (event: "saveCheckInConfig"): void;
  (event: "reviewRatingChange", value: Event): void;
  (event: "submitActivityReview"): void;
}>();

function handleCheckIn() {
  emit("checkIn");
}

function handleCheckInSwitchChange(event: Event) {
  emit("checkInSwitchChange", event);
}

function handleSaveCheckInConfig() {
  emit("saveCheckInConfig");
}

function handleReviewRatingChange(event: Event) {
  emit("reviewRatingChange", event);
}

function handleSubmitActivityReview() {
  emit("submitActivityReview");
}
</script>

<template>
  <view class="team-mode-shell">
    <TeamRegistrationHero
      :match="match"
      :date-line="dateLine"
      :hero-meta-chips="heroMetaChips"
      :current-team="currentTeam"
      :opponent-team="opponentTeam"
    />
    <TeamRegistrationFormCard
      :match="match"
      :opponent-team="opponentTeam"
      :existing-team-derived-activity="existingTeamDerivedActivity"
      :team-form-title="teamFormTitle"
      :team-signup-hint="teamSignupHint"
      :team-registration-count="teamRegistrationCount"
      :team-registration-count-options="teamRegistrationCountOptions"
      :date-line="dateLine"
      @update:team-registration-count="$emit('update:teamRegistrationCount', $event)"
    />
    <TeamMatchInfoCard :credit-score="currentTeam?.creditScore ?? 0" />
    <TeamCheckInPanel
      v-if="canShowCheckIn"
      :has-checked-in="hasCheckedIn"
      :submitting-status="submittingStatus"
      @check-in="handleCheckIn"
    />
    <TeamCheckInSettingsCard
      v-if="canManageCurrentMatch"
      :check-in-form="checkInForm"
      :submitting-status="submittingStatus"
      @check-in-switch-change="handleCheckInSwitchChange"
      @save-check-in-config="handleSaveCheckInConfig"
    />
    <TeamActivityReviewCard
      v-if="canShowActivityReview"
      :can-submit-activity-review="canSubmitActivityReview"
      :review-submitted="reviewSubmitted"
      :review-form="reviewForm"
      :submitting-status="submittingStatus"
      @review-rating-change="handleReviewRatingChange"
      @submit-activity-review="handleSubmitActivityReview"
    />
  </view>
</template>

<style scoped>
.team-mode-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
</style>
