<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { acceptChallenge, cancelChallenge, getChallengeDetail } from "@/api/challenge";
import { useTeamContext } from "@/stores/teamContext";
import type { BackendChallenge, BackendChallengeDetail } from "@/types/backend";
import { getCustomNavMetrics } from "@/utils/customNav";
import { buildChallengeCards } from "@/utils/viewModels";
import ChallengeActions from "./components/ChallengeActions.vue";
import ChallengeDetailSkeleton from "./components/ChallengeDetailSkeleton.vue";
import ChallengeHeroCard from "./components/ChallengeHeroCard.vue";
import ChallengeIndividualProgressCard from "./components/ChallengeIndividualProgressCard.vue";
import ChallengeInfoCard from "./components/ChallengeInfoCard.vue";
import ChallengeTeamProgressCard from "./components/ChallengeTeamProgressCard.vue";
import { buildIndividualParticipantPreview } from "./detailState";

const { currentTeam, currentUser, ensureSessionReady } = useTeamContext();
const navMetrics = getCustomNavMetrics();

const challengeId = ref("");
const isLoading = ref(false);
const actionLoading = ref(false);
const errorMessage = ref("");
const detail = ref<BackendChallengeDetail | null>(null);

const card = computed(() => {
  if (!detail.value) return null;
  const summary = detail.value.summary;
  const canAccept =
    summary.challenge.kind === "team"
      ? !!currentTeam.value?.canManageTeam &&
        summary.challenge.status === "open" &&
        summary.challenge.host_team_id !== currentTeam.value?.id
      : summary.challenge.status === "open" &&
        !summary.current_user_joined &&
        summary.accepted_count < summary.challenge.players_per_team * 2;
  const [item] = buildChallengeCards([
    {
      ...summary,
      current_team_relation:
        summary.challenge.host_team_id === currentTeam.value?.id
          ? "host"
          : summary.challenge.guest_team_id === currentTeam.value?.id
            ? "guest"
            : "viewer",
      can_accept: canAccept,
    },
  ]);
  return item;
});

const canCancel = computed(
  () =>
    !!detail.value &&
    !!currentTeam.value &&
    currentTeam.value.canManageTeam &&
    detail.value.summary.challenge.host_team_id === currentTeam.value.id &&
    detail.value.summary.challenge.status === "open",
);
const canAccept = computed(() => !!card.value?.canAccept);
const individualProgressPercent = computed(() => {
  if (!card.value || card.value.kind !== "individual") return 0;
  return Math.min(100, Math.round((card.value.acceptedCount / Math.max(card.value.capacity, 1)) * 100));
});
const individualRemainingCount = computed(() => {
  if (!card.value || card.value.kind !== "individual") return 0;
  return Math.max(card.value.capacity - card.value.acceptedCount, 0);
});
const individualParticipantPreview = computed(() =>
  buildIndividualParticipantPreview(detail.value?.individual_participants ?? []),
);
const individualAvatarNote = computed(() => {
  if (!card.value) return "";
  if (!individualParticipantPreview.value.length) return "还没有人报名";
  const hiddenCount = Math.max(card.value.acceptedCount - individualParticipantPreview.value.length, 0);
  return hiddenCount > 0 ? `已显示 ${individualParticipantPreview.value.length} 人，另有 ${hiddenCount} 人` : "已报名球员";
});
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

async function loadPageData() {
  if (!challengeId.value) return;

  isLoading.value = true;
  errorMessage.value = "";
  try {
    await ensureSessionReady();
    detail.value = await getChallengeDetail(challengeId.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "约队详情加载失败";
  } finally {
    isLoading.value = false;
  }
}

function applyAcceptedChallengeDetail(challenge: BackendChallenge) {
  if (!detail.value) return;

  const isIndividual = challenge.kind === "individual";
  const existingParticipants = detail.value.individual_participants ?? [];
  const individualParticipants =
    isIndividual && currentUser.value && !existingParticipants.some((item) => item.user_id === currentUser.value?.id)
      ? [
          ...existingParticipants,
          {
            user_id: currentUser.value.id,
            display_name: currentUser.value.real_name || currentUser.value.nickname || currentUser.value.username || "我",
            avatar_url: currentUser.value.avatar_url || null,
          },
        ]
      : existingParticipants;

  detail.value = {
    ...detail.value,
    summary: {
      ...detail.value.summary,
      challenge,
      guest_team_name: isIndividual ? detail.value.summary.guest_team_name : currentTeam.value?.name ?? detail.value.summary.guest_team_name,
      guest_team_credit_score: isIndividual ? detail.value.summary.guest_team_credit_score : currentTeam.value?.creditScore ?? detail.value.summary.guest_team_credit_score,
      guest_team_trust_label: isIndividual ? detail.value.summary.guest_team_trust_label : currentTeam.value?.trustLabel ?? detail.value.summary.guest_team_trust_label,
      current_team_relation: isIndividual ? detail.value.summary.current_team_relation : "guest",
      accepted_count: isIndividual ? detail.value.summary.accepted_count + 1 : detail.value.summary.accepted_count,
      current_user_joined: isIndividual ? true : detail.value.summary.current_user_joined,
      can_accept: false,
    },
    activity: challenge.activity_id
      ? {
          id: challenge.activity_id,
          name: challenge.title,
          holding_date: challenge.holding_date,
          start_time: challenge.start_time,
          end_time: challenge.end_time,
          location: challenge.location,
          home_team_id: challenge.host_team_id,
          away_team_id: challenge.guest_team_id,
          players_per_team: challenge.players_per_team,
        }
      : detail.value.activity,
    individual_participants: individualParticipants,
  };
}

function applyCancelledChallengeDetail(challenge: BackendChallenge) {
  if (!detail.value) return;

  detail.value = {
    ...detail.value,
    summary: {
      ...detail.value.summary,
      challenge,
      can_accept: false,
    },
  };
}

async function handleAccept() {
  if (!card.value || !canAccept.value || actionLoading.value) return;

  actionLoading.value = true;
  try {
    const challenge = await acceptChallenge(challengeId.value, card.value.kind === "team" ? currentTeam.value?.id : undefined);
    applyAcceptedChallengeDetail(challenge);
    uni.showToast({
      title: card.value.kind === "team" ? "接约成功" : "报名成功",
      icon: "none",
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "接约失败",
      icon: "none",
    });
  } finally {
    actionLoading.value = false;
  }
}

async function handleCancel() {
  if (!canCancel.value || actionLoading.value) return;

  actionLoading.value = true;
  try {
    const challenge = await cancelChallenge(challengeId.value);
    applyCancelledChallengeDetail(challenge);
    uni.showToast({
      title: "约队已取消",
      icon: "none",
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "取消失败",
      icon: "none",
    });
  } finally {
    actionLoading.value = false;
  }
}

function openActivities() {
  uni.switchTab({
    url: "/pages/activities/index",
  });
}

function openMatchDetail(matchId: string) {
  uni.navigateTo({
    url: `/pages/matches/detail?id=${matchId}`,
  });
}

onLoad((options) => {
  challengeId.value = options?.id ?? "";
  void loadPageData();
});
</script>

<template>
  <view class="challenge-detail-page" :style="pageStyle">
    <AppTabHeader title="约队详情" showBack />

    <view v-if="errorMessage" class="challenge-empty">{{ errorMessage }}</view>
    <ChallengeDetailSkeleton v-else-if="isLoading" />

    <view v-if="detail && card">
      <ChallengeHeroCard :card="card" />
      <ChallengeInfoCard :card="card" :detail="detail" />
      <ChallengeTeamProgressCard v-if="card.kind === 'team'" :detail="detail" />
      <ChallengeIndividualProgressCard
        v-else
        :card="card"
        :individual-progress-percent="individualProgressPercent"
        :individual-remaining-count="individualRemainingCount"
        :individual-participant-preview="individualParticipantPreview"
        :individual-avatar-note="individualAvatarNote"
      />
      <ChallengeActions
        :activity="detail.activity"
        :card="card"
        :can-accept="canAccept"
        :can-cancel="canCancel"
        :action-loading="actionLoading"
        @open-activities="openActivities"
        @open-match-detail="openMatchDetail"
        @accept="handleAccept"
        @cancel="handleCancel"
      />
    </view>
  </view>
</template>

<style scoped>
.challenge-detail-page {
  min-height: 100vh;
  padding: 30rpx 28rpx 100rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.14), transparent 24%),
    linear-gradient(180deg, #fbfcf7 0%, #f3f5ee 100%);
  box-sizing: border-box;
}

.challenge-empty {
  padding: 26rpx;
  border-radius: 28rpx;
  background: #ffffff;
  color: #6c7168;
  font-size: 28rpx;
  line-height: 1.6;
}
</style>
