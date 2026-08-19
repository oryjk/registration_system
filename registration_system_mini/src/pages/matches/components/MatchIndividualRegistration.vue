<script setup lang="ts">
import { computed } from "vue";
import type { BackendActivity } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import type { MatchTeamProgressItem } from "@/types/viewModels";
import IndividualInfoCard from "./IndividualInfoCard.vue";
import IndividualMatchupHero from "./IndividualMatchupHero.vue";
import MatchRegistrationStatusCard from "./MatchRegistrationStatusCard.vue";
import TeamMemberRegistrationBoard from "./TeamMemberRegistrationBoard.vue";

const props = defineProps<{
  match: BackendActivity;
  matchKindLabel: string;
  publicationModeLabel: string;
  homeTeamLabel: string;
  displayOpponentLabel: string;
  homeTeamColor: string;
  awayTeamColor: string;
  matchClockLabel: string;
  matchLocation: string;
  joinedCount: number;
  requiredPlayers: number;
  maxPlayers: number;
  countdownText: string;
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
  /** 报名已截止：隐藏所有修改报名状态的入口。 */
  registrationClosed?: boolean;
  /** 比赛免费时才在报名 CTA 上展示「免费」角标。 */
  showFreeTag?: boolean;
  /** 球队约队的主/客队双边报名进度；散人约局为空。 */
  teamProgress?: MatchTeamProgressItem[];
  /** 待支付报名费标签（如 ¥25.00）；非空时展示「去支付」面板。 */
  pendingPaymentFeeLabel?: string;
  /** 支付流程进行中（下单/拉起/核销）。 */
  submittingPayment?: boolean;
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
  (event: "payRegistration"): void;
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

function handlePayRegistration() {
  emit("payRegistration");
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
      :match-clock-label="matchClockLabel"
      :match-location="matchLocation"
      @open-location="handleOpenLocation"
    />
    <MatchRegistrationStatusCard
      :joined-count="joinedCount"
      :required-players="requiredPlayers"
      :max-players="maxPlayers"
      :countdown-text="countdownText"
      :participant-preview="participantPreview"
      :remaining-players-label="remainingPlayersLabel"
      :submitting-status="submittingStatus"
      :individual-cta-label="individualCtaLabel"
      :is-guest-mode="isGuestMode"
      :cta-disabled="!canSubmitIndividualRegistration"
      :show-cta="!showTeamMemberRegistrationBoard && !registrationClosed"
      :show-free-tag="showFreeTag"
      :team-progress="teamProgress"
      :pending-payment-fee-label="pendingPaymentFeeLabel"
      :submitting-payment="submittingPayment"
      @select-individual-signup="handleSelectIndividualSignup"
      @pay-registration="handlePayRegistration"
    />
    <TeamMemberRegistrationBoard
      v-if="showTeamMemberRegistrationBoard"
      :groups="teamMemberRegistrationGroups"
      :submitting-status="submittingStatus"
      :registration-closed="registrationClosed"
      @select-stand="handleSelectTeamMemberStand"
      @dialog-visibility-change="handleTeamMemberDialogVisibilityChange"
    />
    <IndividualInfoCard
      :credit-score="currentTeam?.creditScore ?? 0"
      :publication-mode-label="publicationModeLabel"
    />
  </view>
</template>

<style scoped>
.individual-mode-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
</style>
