<script setup lang="ts">
import type { BackendActivity } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import IndividualCountdownCard from "./IndividualCountdownCard.vue";
import IndividualInfoCard from "./IndividualInfoCard.vue";
import IndividualMatchupHero from "./IndividualMatchupHero.vue";
import IndividualPromoBanner from "./IndividualPromoBanner.vue";
import InterestMatchGrid from "./InterestMatchGrid.vue";

defineProps<{
  match: BackendActivity;
  matchKindLabel: string;
  homeTeamLabel: string;
  displayOpponentLabel: string;
  homeTeamColor: string;
  awayTeamColor: string;
  matchDateLabel: string;
  matchClockLabel: string;
  matchLocation: string;
  joinedCount: number;
  requiredPlayers: number;
  countdownText: string;
  progressBaseWidth: string;
  progressExtraWidth: string;
  progressSplitLeft: string;
  participantPreview: Array<{
    id: number;
    name: string;
    avatarUrl: string;
    tone: string;
  }>;
  remainingPlayersLabel: string;
  submittingStatus: boolean;
  individualCtaLabel: string;
  isGuestMode: boolean;
  currentTeam: TeamProfileViewModel | null;
  interestCards: Array<{
    id: string;
    title: string;
    dateLine: string;
    venue: string;
  }>;
}>();

const emit = defineEmits<{
  (event: "openLocation"): void;
  (event: "selectIndividualSignup"): void;
  (event: "openMatchDetail", matchId: string): void;
}>();

function handleOpenLocation() {
  emit("openLocation");
}

function handleSelectIndividualSignup() {
  emit("selectIndividualSignup");
}

function handleOpenMatchDetail(matchId: string) {
  emit("openMatchDetail", matchId);
}
</script>

<template>
  <view class="individual-mode-shell">
    <IndividualMatchupHero
      :match="match"
      :match-kind-label="matchKindLabel"
      :home-team-label="homeTeamLabel"
      :display-opponent-label="displayOpponentLabel"
      :home-team-color="homeTeamColor"
      :away-team-color="awayTeamColor"
      :match-date-label="matchDateLabel"
      :match-clock-label="matchClockLabel"
      :match-location="matchLocation"
      @open-location="handleOpenLocation"
    />
    <IndividualCountdownCard
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
      @select-individual-signup="handleSelectIndividualSignup"
    />
    <IndividualInfoCard :credit-score="currentTeam?.creditScore ?? 0" />
    <IndividualPromoBanner />
    <InterestMatchGrid :interest-cards="interestCards" @open-match-detail="handleOpenMatchDetail" />
  </view>
</template>

<style scoped>
.individual-mode-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
</style>
