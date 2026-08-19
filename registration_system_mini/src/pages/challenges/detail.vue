<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShareAppMessage, onShareTimeline, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { acceptChallenge, cancelChallenge, cancelIndividualChallengeAcceptance, getChallengeDetail } from "@/api/challenge";
import { createChallengeIndividualPaymentOrder, syncPaymentOrderStatus } from "@/api/payment";
import { useTeamContext } from "@/stores/teamContext";
import type { BackendChallenge, BackendChallengeDetail } from "@/types/backend";
import { getCustomNavMetrics } from "@/utils/customNav";
import { isOpenLocationSupported } from "@/utils/location";
import { isMockWxPaymentParams, isPaymentCancelled, normalizeWxPaymentParams, requestWxPayment } from "@/utils/payment";
import { DEFAULT_SHARE_IMAGE_URL } from "@/utils/share";
import { getAppPlatform } from "@/utils/systemInfo";
import { buildChallengeCards } from "@/utils/viewModels";
import ChallengeActions from "./components/ChallengeActions.vue";
import ChallengeDetailSkeleton from "./components/ChallengeDetailSkeleton.vue";
import ChallengeHeroCard from "./components/ChallengeHeroCard.vue";
import ChallengeIndividualRegistration from "./components/ChallengeIndividualRegistration.vue";
import ChallengeInfoCard from "./components/ChallengeInfoCard.vue";
import ChallengeTeamProgressCard from "./components/ChallengeTeamProgressCard.vue";
import { buildIndividualParticipantPreview } from "./detailState";
import { formatCountdown } from "../matches/detailState";

const { currentTeam, currentUser, ensureSessionReady } = useTeamContext();
const navMetrics = getCustomNavMetrics();
const canUseOpenLocation = isOpenLocationSupported(getAppPlatform());

const challengeId = ref("");
const isLoading = ref(false);
const actionLoading = ref(false);
const errorMessage = ref("");
const detail = ref<BackendChallengeDetail | null>(null);
const nowTick = ref(Date.now());
function challengeMinSignupPlayers(challenge: BackendChallenge) {
  return challenge.kind === "individual" ? challenge.min_players ?? challenge.players_per_team * 2 : challenge.players_per_team;
}

function challengeMaxSignupPlayers(challenge: BackendChallenge) {
  return challenge.kind === "individual" ? challenge.max_players ?? challenge.players_per_team * 2 + 4 : challenge.players_per_team;
}

let countdownTimer: ReturnType<typeof setInterval> | null = null;

const card = computed(() => {
  if (!detail.value) return null;
  const summary = detail.value.summary;
  const canAccept =
    summary.challenge.kind === "team"
      ? !!currentTeam.value?.canManageTeam &&
        summary.challenge.status === "open" &&
        summary.challenge.host_team_id !== currentTeam.value?.id
      : summary.challenge.status !== "cancelled" &&
        !summary.current_user_joined &&
        summary.accepted_count < challengeMaxSignupPlayers(summary.challenge);
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
    detail.value.summary.challenge.status === "open" &&
    ((!!currentTeam.value &&
      currentTeam.value.canManageTeam &&
      detail.value.summary.challenge.host_team_id === currentTeam.value.id) ||
      (detail.value.summary.challenge.host_team_id == null &&
        detail.value.summary.challenge.host_user_id === currentUser.value?.id &&
        !!currentUser.value?.is_venue)),
);
const canCancelIndividualAcceptance = computed(
  () =>
    !!detail.value &&
    detail.value.summary.challenge.kind === "individual" &&
    detail.value.summary.current_user_joined &&
    detail.value.summary.challenge.status !== "cancelled",
);
const canAccept = computed(() => !!card.value?.canAccept);
const individualProgressPercent = computed(() => {
  if (!card.value || card.value.kind !== "individual") return 0;
  return Math.min(100, Math.round((card.value.acceptedCount / Math.max(card.value.minPlayers, 1)) * 100));
});
const individualProgressWidth = computed(() => `${individualProgressPercent.value}%`);
const individualRemainingCount = computed(() => {
  if (!card.value || card.value.kind !== "individual") return 0;
  return Math.max(card.value.maxPlayers - card.value.acceptedCount, 0);
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
const individualActionLabel = computed(() => {
  if (actionLoading.value) return "处理中...";
  if (!card.value) return "立即报名";
  if (card.value.currentUserJoined) return "取消报名";
  if (!canAccept.value) return individualRemainingCount.value <= 0 ? "已达上限" : "暂不可报名";
  return "立即报名";
});
const challengeStartTimestamp = computed(() => {
  const challenge = detail.value?.summary.challenge;
  if (!challenge) return 0;
  return new Date((challenge.start_time || challenge.holding_date).replace(" ", "T")).getTime();
});
const individualCountdownText = computed(() => formatCountdown(challengeStartTimestamp.value - nowTick.value));
const currentAcceptance = computed(() => detail.value?.current_user_acceptance ?? null);
const paymentDeadlineTimestamp = computed(() => {
  const deadline = currentAcceptance.value?.payment_deadline_at;
  if (!deadline) return 0;
  const timestamp = new Date(deadline.replace(" ", "T")).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
});
const paymentCountdownText = computed(() => {
  const challenge = detail.value?.summary.challenge;
  if (
    !challenge ||
    challenge.kind !== "individual" ||
    challenge.payment_mode !== "prepaid" ||
    currentAcceptance.value?.payment_status !== "unpaid" ||
    !paymentDeadlineTimestamp.value
  ) {
    return "";
  }
  return `支付倒计时 ${formatCountdown(paymentDeadlineTimestamp.value - nowTick.value)}`;
});
const paymentStatusLabel = computed(() => {
  const challenge = detail.value?.summary.challenge;
  const acceptance = currentAcceptance.value;
  if (!challenge || challenge.kind !== "individual" || !acceptance) return "";
  if (acceptance.payment_status === "paid") return "已支付";
  if (acceptance.payment_status === "cancelled") return "已取消";
  if (!challenge.fee_per_person || Number(challenge.fee_per_person) <= 0) return "无需支付";
  return challenge.payment_mode === "prepaid" ? "待支付" : "赛后支付待完成";
});
const canPayChallenge = computed(() => {
  const challenge = detail.value?.summary.challenge;
  const acceptance = currentAcceptance.value;
  if (!challenge || challenge.kind !== "individual" || !acceptance || actionLoading.value) return false;
  if (!detail.value?.summary.current_user_joined || acceptance.payment_status !== "unpaid") return false;
  if (!challenge.fee_per_person || Number(challenge.fee_per_person) <= 0) return false;
  return !paymentDeadlineTimestamp.value || paymentDeadlineTimestamp.value > nowTick.value;
});
const pageTitle = computed(() => (card.value?.kind === "individual" ? "散人报名" : "约队详情"));
const shareTitle = computed(() => {
  if (!card.value) return "邀请你查看约队报名";
  return card.value.kind === "individual" ? `邀请你报名：${card.value.title}` : `邀请你接约：${card.value.title}`;
});
const sharePath = computed(() => `/pages/challenges/detail?id=${challengeId.value || card.value?.id || ""}`);
const canOpenChallengeLocation = computed(
  () =>
    !!detail.value &&
    detail.value.summary.challenge.location_latitude != null &&
    detail.value.summary.challenge.location_longitude != null,
);
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
  const activityHomeTeamId = challenge.host_team_id ?? challenge.guest_team_id ?? null;
  const activityAwayTeamId = challenge.host_team_id != null ? challenge.guest_team_id ?? null : null;
  const isTeamReservedByCurrentTeam =
    !isIndividual &&
    challenge.status === "open" &&
    challenge.host_team_id === currentTeam.value?.id &&
    !challenge.guest_team_id;
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
      host_team_name: isTeamReservedByCurrentTeam ? currentTeam.value?.name ?? detail.value.summary.host_team_name : detail.value.summary.host_team_name,
      host_team_credit_score: isTeamReservedByCurrentTeam ? currentTeam.value?.creditScore ?? detail.value.summary.host_team_credit_score : detail.value.summary.host_team_credit_score,
      host_team_trust_label: isTeamReservedByCurrentTeam ? currentTeam.value?.trustLabel ?? detail.value.summary.host_team_trust_label : detail.value.summary.host_team_trust_label,
      guest_team_name: isIndividual || isTeamReservedByCurrentTeam ? detail.value.summary.guest_team_name : currentTeam.value?.name ?? detail.value.summary.guest_team_name,
      guest_team_credit_score: isIndividual || isTeamReservedByCurrentTeam ? detail.value.summary.guest_team_credit_score : currentTeam.value?.creditScore ?? detail.value.summary.guest_team_credit_score,
      guest_team_trust_label: isIndividual || isTeamReservedByCurrentTeam ? detail.value.summary.guest_team_trust_label : currentTeam.value?.trustLabel ?? detail.value.summary.guest_team_trust_label,
      current_team_relation: isIndividual ? detail.value.summary.current_team_relation : isTeamReservedByCurrentTeam ? "host" : "guest",
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
          home_team_id: activityHomeTeamId,
          away_team_id: activityAwayTeamId,
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

function applyCancelledIndividualAcceptanceDetail(challenge: BackendChallenge) {
  if (!detail.value) return;
  const userId = currentUser.value?.id;

  detail.value = {
    ...detail.value,
    summary: {
      ...detail.value.summary,
      challenge,
      accepted_count: Math.max(detail.value.summary.accepted_count - 1, 0),
      current_user_joined: false,
      can_accept: challenge.status !== "cancelled" && detail.value.summary.accepted_count < challengeMaxSignupPlayers(challenge),
    },
    individual_participants: userId
      ? detail.value.individual_participants.filter((item) => item.user_id !== userId)
      : detail.value.individual_participants,
    current_user_acceptance: null,
  };
}

async function handleAccept() {
  if (!card.value || !canAccept.value || actionLoading.value) return;

  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: card.value?.kind === "team" ? "确认接约" : "确认报名",
      content:
        card.value?.kind === "team"
          ? `确认以当前球队接约「${card.value?.title ?? "约队"}」？`
          : `确认报名参加「${card.value?.title ?? "散人约球"}」？`,
      confirmText: card.value?.kind === "team" ? "确认接约" : "确认报名",
      cancelText: "再想想",
      success: (result) => resolve(!!result.confirm),
      fail: () => resolve(false),
    });
  });
  if (!confirmed) return;

  actionLoading.value = true;
  try {
    const challenge = await acceptChallenge(challengeId.value, card.value.kind === "team" ? currentTeam.value?.id : undefined);
    if (card.value.kind === "individual") {
      await loadPageData();
    } else {
      applyAcceptedChallengeDetail(challenge);
    }
    uni.$emit("home:data-may-changed");
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
    uni.$emit("home:data-may-changed");
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

async function handlePayChallenge() {
  if (!card.value || !canPayChallenge.value || actionLoading.value) return;

  actionLoading.value = true;
  try {
    const order = await createChallengeIndividualPaymentOrder({
      challenge_id: challengeId.value,
    });
    const paymentParams = normalizeWxPaymentParams(order.params);
    if (paymentParams && !isMockWxPaymentParams(paymentParams)) {
      await requestWxPayment(paymentParams);
    }
    await syncPaymentOrderStatus(order.order_no);
    await loadPageData();
    uni.showToast({
      title: paymentParams ? "支付已提交" : "支付订单已创建",
      icon: "none",
    });
  } catch (error) {
    uni.showToast({
      title: isPaymentCancelled(error) ? "已取消支付" : error instanceof Error ? error.message : "支付失败",
      icon: "none",
    });
  } finally {
    actionLoading.value = false;
  }
}

async function handleCancelIndividualAcceptance() {
  if (!canCancelIndividualAcceptance.value || actionLoading.value) return;

  uni.showModal({
    title: "确认取消报名",
    content: `确认取消「${card.value?.title ?? "散人约球"}」的报名？取消后可重新报名。`,
    confirmText: "取消报名",
    cancelText: "再想想",
    success: async (result) => {
      if (!result.confirm) return;
      actionLoading.value = true;
      try {
        const challenge = await cancelIndividualChallengeAcceptance(challengeId.value);
        applyCancelledIndividualAcceptanceDetail(challenge);
        uni.$emit("home:data-may-changed");
        uni.showToast({
          title: "已取消报名",
          icon: "none",
        });
      } catch (error) {
        uni.showToast({
          title: error instanceof Error ? error.message : "取消报名失败",
          icon: "none",
        });
      } finally {
        actionLoading.value = false;
      }
    },
  });
}

function openActivities() {
  uni.switchTab({
    url: "/pages/activities/index",
  });
}

function openChallengeLocation() {
  const challenge = detail.value?.summary.challenge;
  if (!challenge || challenge.location_latitude == null || challenge.location_longitude == null) {
    uni.showToast({
      title: "暂无可打开的地图定位",
      icon: "none",
    });
    return;
  }

  if (!canUseOpenLocation) {
    uni.showToast({
      title: "开发者工具不支持地图打开，请真机测试",
      icon: "none",
      duration: 2800,
    });
    return;
  }

  uni.openLocation({
    latitude: Number(challenge.location_latitude),
    longitude: Number(challenge.location_longitude),
    name: challenge.title,
    address: challenge.location,
  });
}

function openMatchDetail(matchId: string) {
  uni.navigateTo({
    url: `/pages/matches/detail?id=${matchId}`,
  });
}

function startCountdownTimer() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
}

onLoad((options) => {
  challengeId.value = options?.id ?? "";
  startCountdownTimer();
  void loadPageData();
});

onUnload(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
});

onShareAppMessage(() => ({
  title: shareTitle.value,
  path: sharePath.value,
  imageUrl: DEFAULT_SHARE_IMAGE_URL,
}));

onShareTimeline(() => ({
  title: shareTitle.value,
  query: `id=${challengeId.value || card.value?.id || ""}`,
  imageUrl: DEFAULT_SHARE_IMAGE_URL,
}));
</script>

<template>
  <view class="challenge-detail-page" :style="pageStyle">
    <AppTabHeader :title="pageTitle" showBack />

    <view v-if="errorMessage" class="challenge-empty">{{ errorMessage }}</view>
    <ChallengeDetailSkeleton v-else-if="isLoading" />

    <view v-if="detail && card">
      <ChallengeIndividualRegistration
        v-if="card.kind === 'individual'"
        :card="card"
        :action-label="individualActionLabel"
        :can-accept="canAccept"
        :can-cancel-individual-acceptance="canCancelIndividualAcceptance"
        :action-loading="actionLoading"
        :countdown-text="individualCountdownText"
        :progress-width="individualProgressWidth"
        :individual-remaining-count="individualRemainingCount"
        :individual-participant-preview="individualParticipantPreview"
        :individual-avatar-note="individualAvatarNote"
        :can-open-location="canOpenChallengeLocation"
        :payment-status-label="paymentStatusLabel"
        :payment-countdown-text="paymentCountdownText"
        :can-pay="canPayChallenge"
        @accept="handleAccept"
        @cancel-individual-acceptance="handleCancelIndividualAcceptance"
        @pay="handlePayChallenge"
        @open-location="openChallengeLocation"
        @open-activities="openActivities"
      />
      <template v-else>
        <ChallengeHeroCard :card="card" />
        <ChallengeInfoCard :card="card" :detail="detail" />
        <ChallengeTeamProgressCard :detail="detail" />
        <ChallengeActions
          :activity="detail.summary.challenge.status === 'matched' ? detail.activity : null"
          :card="card"
          :can-accept="canAccept"
          :can-cancel="canCancel"
          :can-cancel-individual-acceptance="canCancelIndividualAcceptance"
          :action-loading="actionLoading"
          @open-activities="openActivities"
          @open-match-detail="openMatchDetail"
          @accept="handleAccept"
          @cancel="handleCancel"
          @cancel-individual-acceptance="handleCancelIndividualAcceptance"
        />
      </template>
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
