<script setup lang="ts">
import { computed } from "vue";
import type { BackendActivity } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import IndividualCountdownCard from "./IndividualCountdownCard.vue";
import IndividualInfoCard from "./IndividualInfoCard.vue";
import IndividualMatchupHero from "./IndividualMatchupHero.vue";
import TeamMemberRegistrationBoard from "./TeamMemberRegistrationBoard.vue";

const props = defineProps<{
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
  canSubmitIndividualRegistration: boolean;
  currentTeam: TeamProfileViewModel | null;
  teamMemberRegistrationGroups: {
    joined: Array<{ userId: number; name: string; avatarUrl: string; tone: string; jerseyNumber: string; isCurrentUser: boolean }>;
    leave: Array<{ userId: number; name: string; avatarUrl: string; tone: string; jerseyNumber: string; isCurrentUser: boolean }>;
    pending: Array<{ userId: number; name: string; avatarUrl: string; tone: string; jerseyNumber: string; isCurrentUser: boolean }>;
  };
}>();

const emit = defineEmits<{
  (event: "openLocation"): void;
  (event: "selectIndividualSignup"): void;
  (event: "selectTeamMemberStand", value: 0 | 1 | 2): void;
  (event: "dialogVisibilityChange", visible: boolean): void;
}>();

const showTeamMemberRegistrationBoard = computed(() => {
  const groups = props.teamMemberRegistrationGroups;
  return groups.joined.length + groups.leave.length + groups.pending.length > 0;
});

function handleOpenLocation() {
  emit("openLocation");
}

function handleSelectIndividualSignup() {
  emit("selectIndividualSignup");
}

function handleSelectTeamMemberStand(stand: 0 | 1 | 2) {
  emit("selectTeamMemberStand", stand);
}

function handleTeamMemberDialogVisibilityChange(visible: boolean) {
  emit("dialogVisibilityChange", visible);
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
      :cta-disabled="!canSubmitIndividualRegistration"
      :show-cta="!showTeamMemberRegistrationBoard"
      @select-individual-signup="handleSelectIndividualSignup"
    />
    <TeamMemberRegistrationBoard
      v-if="showTeamMemberRegistrationBoard"
      :groups="teamMemberRegistrationGroups"
      :submitting-status="submittingStatus"
      @select-stand="handleSelectTeamMemberStand"
      @dialog-visibility-change="handleTeamMemberDialogVisibilityChange"
    />
    <IndividualInfoCard :credit-score="currentTeam?.creditScore ?? 0" />
  </view>
</template>

<style scoped>
.individual-mode-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
</style>
