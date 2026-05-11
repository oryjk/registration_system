<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import {
  getActivity,
  getActivityUsers,
  listActivities,
  cancelTeamRegistration,
  submitActivityCheckIn,
  submitTeamRegistration,
  updateTeamCheckInConfig,
  updateMyStand,
} from "@/api/activity";
import { getTeamDetail, submitTeamActivityReview } from "@/api/team";
import { listUsers } from "@/api/user";
import { useCurrentLocation } from "@/stores/currentLocation";
import { useTeamContext } from "@/stores/teamContext";
import type {
  BackendActivity,
  BackendActivityCheckInRecord,
  BackendRegistration,
  BackendTeam,
  BackendUser,
} from "@/types/backend";
import { getCustomNavMetrics } from "@/utils/customNav";
import { resolveUserDisplayName, toStandLabel } from "@/utils/viewModels";

const { currentTeam, currentUser, ensureSessionReady } = useTeamContext();
const { ensureCurrentLocation } = useCurrentLocation();

const navMetrics = getCustomNavMetrics();
const matchId = ref("");
const isLoading = ref(false);
const errorMessage = ref("");
const submittingStatus = ref(false);
const registrationMode = ref<"individual" | "team">("individual");
const match = ref<BackendActivity | null>(null);
const registrations = ref<BackendRegistration[]>([]);
const usersById = ref<Record<number, BackendUser>>({});
const teamsById = ref<Record<string, BackendTeam>>({});
const relatedActivities = ref<BackendActivity[]>([]);
const sourceTeamRegistrationCount = ref(0);
const existingTeamDerivedActivity = ref<BackendActivity | null>(null);
const currentStatus = ref("待定");
const nowTick = ref(Date.now());
const teamRegistrationCount = ref(5);
const checkInForm = ref({
  enabled: false,
  radiusMeters: 200,
  openMinutesBefore: 60,
  closeMinutesAfter: 45,
});
const reviewForm = ref({
  rating: 5,
  comment: "",
});
const reviewSubmitted = ref(false);

let countdownTimer: ReturnType<typeof setInterval> | null = null;

const pageStyle = computed(() => ({
  paddingBottom: registrationMode.value === "team" && canUseTeamRegistration.value ? "188rpx" : "96rpx",
}));

const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

const joinedRegistrations = computed(() => registrations.value.filter((item) => item.stand === 1 || item.stand === 3));
const joinedCount = computed(() => joinedRegistrations.value.length + sourceTeamRegistrationCount.value);
const requiredPlayers = computed(() => match.value?.players_per_team ?? 0);
const maxPlayers = computed(() => (requiredPlayers.value > 0 ? requiredPlayers.value + 2 : 0));
const isAtRegistrationCapacity = computed(() => maxPlayers.value > 0 && joinedCount.value >= maxPlayers.value);
const progressBaseWidth = computed(() => {
  const denominator = Math.max(maxPlayers.value || requiredPlayers.value, 1);
  return `${Math.min((Math.min(joinedCount.value, requiredPlayers.value) / denominator) * 100, 100)}%`;
});
const progressExtraWidth = computed(() => {
  const denominator = Math.max(maxPlayers.value || requiredPlayers.value, 1);
  return `${Math.min((Math.max(joinedCount.value - requiredPlayers.value, 0) / denominator) * 100, 100)}%`;
});
const progressSplitLeft = computed(() => {
  const denominator = Math.max(maxPlayers.value || requiredPlayers.value, 1);
  return `${Math.min((requiredPlayers.value / denominator) * 100, 100)}%`;
});

const remainingPlayersLabel = computed(() => {
  if (!requiredPlayers.value) return "人数待定";
  const left = Math.max(requiredPlayers.value - joinedCount.value, 0);
  return left > 0 ? `还差 ${left} 人成行` : "人数已齐";
});

const matchWeekdayLabel = computed(() => (match.value ? formatWeekday(match.value.holding_date) : "周日"));
const eventToneLabel = computed(() => `${matchWeekdayLabel.value}友谊赛`);
const dateLine = computed(() => {
  if (!match.value) return "";
  return `${formatMonthDay(match.value.holding_date)} ${formatWeekday(match.value.holding_date)} ${formatClock(match.value.start_time)}`;
});

const matchStartTimestamp = computed(() => {
  if (!match.value) return 0;
  return parseDateValue(match.value.start_time || match.value.holding_date).getTime();
});

const countdownText = computed(() => formatCountdown(matchStartTimestamp.value - nowTick.value));

const heroMetaChips = computed(() => {
  if (!match.value) return [];
  return [
    requiredPlayers.value ? `${requiredPlayers.value}人制` : "人数待定",
    describeDaysUntil(matchStartTimestamp.value, nowTick.value),
    "免费报名",
  ];
});

const participantPreview = computed(() =>
  joinedRegistrations.value.slice(0, 5).map((item) => {
    const user = usersById.value[item.user_id];
    return {
      id: item.user_id,
      name: resolveUserDisplayName(user),
      avatarUrl: user?.avatar_url ?? "",
      tone: avatarColor(item.user_id),
    };
  }),
);

const opponentTeam = computed(() => {
  if (!match.value || !currentTeam.value) return null;
  const teamIds = [match.value.home_team_id, match.value.away_team_id].filter((value): value is string => !!value);
  const opponentId = teamIds.find((teamId) => teamId !== currentTeam.value?.id);
  return opponentId ? teamsById.value[opponentId] ?? null : null;
});

const interestCards = computed(() =>
  relatedActivities.value.slice(0, 2).map((item) => ({
    id: item.id,
    title: item.name,
    dateLine: `${formatMonthDay(item.holding_date)} ${formatClock(item.start_time)}`,
    venue: item.location,
  })),
);

const individualCtaLabel = computed(() => (currentStatus.value === "参加" ? "取消报名" : "立即报名"));
const canUseTeamRegistration = computed(() => !!currentTeam.value?.canManageTeam && !match.value?.source_activity_id);
const teamRegistrationCountOptions = Array.from({ length: 7 }, (_, index) => {
  const value = index + 5;
  return { value, label: `${value} 人制` };
});
const teamSubmitLabel = computed(() =>
  existingTeamDerivedActivity.value ? "取消球队报名" : `发起球队报名（${teamRegistrationCount.value} 人）`,
);
const teamSignupHint = computed(() =>
  existingTeamDerivedActivity.value
    ? "取消后会关闭本球队对应的队内报名，首页进度会同步减少这组报名人数。"
    : "发起后会为当前球队创建一场独立报名，队员可在首页进入个人报名。",
);
const teamFormTitle = computed(() => (existingTeamDerivedActivity.value ? "球队已报名" : "发起球队报名"));
const currentTeamCheckInConfig = computed(() => {
  const teamId = currentTeam.value?.id;
  if (!teamId || !match.value) return null;
  return match.value.team_checkin_configs.find((item) => item.team_id === teamId) ?? null;
});
const isDerivedTeamSignupActivity = computed(() => !!match.value?.source_activity_id);
const hasCheckedIn = computed(() => {
  const userId = currentUser.value?.id;
  return !!registrations.value.find((item) => item.user_id === userId && item.checked_in_at);
});
const canShowCheckIn = computed(() => !isDerivedTeamSignupActivity.value && !!currentTeamCheckInConfig.value?.enabled && !!currentTeam.value);
const canManageCurrentMatch = computed(() => !isDerivedTeamSignupActivity.value && !!currentTeam.value?.canManageTeam);
const isEndedMatch = computed(() => match.value?.status === 2 || (matchStartTimestamp.value > 0 && nowTick.value > matchStartTimestamp.value));
const canSubmitActivityReview = computed(
  () => !!currentTeam.value && !!opponentTeam.value && isEndedMatch.value && canManageCurrentMatch.value && !reviewSubmitted.value,
);

function isActiveTeamRegistrationActivity(activity: BackendActivity) {
  return !!activity.source_activity_id && activity.status !== 3;
}
const canShowActivityReview = computed(
  () => !!currentTeam.value && !!opponentTeam.value && isEndedMatch.value && canManageCurrentMatch.value,
);

function parseDateValue(value: string) {
  return new Date(value.replace(" ", "T"));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatMonthDay(value: string) {
  const date = parseDateValue(value);
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function formatClock(value: string) {
  const date = parseDateValue(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWeekday(value: string) {
  const date = parseDateValue(value);
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()] ?? "周日";
}

function formatCountdown(distance: number) {
  if (distance <= 0) return "00 : 00 : 00";
  const seconds = Math.floor(distance / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;
  return `${pad(hours)} : ${pad(minutes)} : ${pad(remainSeconds)}`;
}

function describeDaysUntil(target: number, current: number) {
  if (!target) return "时间待定";
  const diff = target - current;
  if (diff <= 0) return "即将开赛";
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days <= 1) return "1天内开赛";
  return `${days}天后开赛`;
}

function avatarColor(userId: number) {
  const palette = ["#111111", "#1b55ff", "#0f766e", "#8b5cf6", "#ea580c", "#16a34a", "#be123c"];
  return palette[userId % palette.length];
}

async function loadPageData() {
  if (!matchId.value) return;

  isLoading.value = true;
  errorMessage.value = "";

  try {
    await ensureSessionReady();
    const [activity, activityUsers, users, activityPage] = await Promise.all([
      getActivity(matchId.value),
      getActivityUsers(matchId.value),
      listUsers(),
      listActivities({ page: 1, pageSize: 100 }),
    ]);

    const teamIds = [activity.home_team_id, activity.away_team_id].filter((teamId): teamId is string => !!teamId);
    const fetchedTeams = await Promise.all(teamIds.map(async (teamId) => (await getTeamDetail(teamId)).team));
    const derivedActivity =
      currentTeam.value?.id
        ? activityPage.items.find(
            (item) => isActiveTeamRegistrationActivity(item) && item.source_activity_id === activity.id && item.home_team_id === currentTeam.value?.id,
          ) ?? null
        : null;
    const initialRegistrationCount =
      derivedActivity?.team_registration_count ?? activity.team_registration_count ?? activity.players_per_team ?? 5;

    match.value = activity;
    registrations.value = activityUsers;
    sourceTeamRegistrationCount.value = activity.source_activity_id
      ? 0
      : activityPage.items
          .filter((item) => isActiveTeamRegistrationActivity(item) && item.source_activity_id === activity.id)
          .reduce((total, item) => total + Number(item.team_registration_count ?? 0), 0);
    existingTeamDerivedActivity.value = derivedActivity;
    teamRegistrationCount.value = clampTeamRegistrationCount(initialRegistrationCount);
    usersById.value = Object.fromEntries(users.map((item) => [item.id, item]));
    teamsById.value = Object.fromEntries(fetchedTeams.map((team) => [team.id, team]));
    relatedActivities.value = activityPage.items.filter((item) => item.id !== activity.id && item.status === 0).slice(0, 2);
    currentStatus.value = toStandLabel(activityUsers.find((item) => item.user_id === currentUser.value?.id)?.stand ?? 0);
    if (!canUseTeamRegistration.value) {
      registrationMode.value = "individual";
    }
    const config = activity.source_activity_id
      ? null
      : activity.team_checkin_configs.find((item) => item.team_id === currentTeam.value?.id);
    checkInForm.value = {
      enabled: config?.enabled ?? false,
      radiusMeters: config?.radius_meters ?? 200,
      openMinutesBefore: config?.open_minutes_before ?? 60,
      closeMinutesAfter: config?.close_minutes_after ?? 45,
    };
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "比赛报名页加载失败";
  } finally {
    isLoading.value = false;
  }
}

function clampTeamRegistrationCount(value: number) {
  if (!Number.isFinite(value)) return 5;
  return Math.min(Math.max(Math.round(value), 5), 11);
}

function handleCheckInSwitchChange(event: Event) {
  const detail = event as Event & { detail?: { value?: boolean } };
  checkInForm.value = {
    ...checkInForm.value,
    enabled: !!detail.detail?.value,
  };
}

function handleReviewRatingChange(event: Event) {
  const detail = event as Event & { detail?: { value?: number | string } };
  reviewForm.value = {
    ...reviewForm.value,
    rating: Number(detail.detail?.value ?? 0) + 1,
  };
}

function applyIndividualRegistrationState(stand: number, registrationCount: number) {
  const userId = currentUser.value?.id;
  if (!userId) return;

  currentStatus.value = toStandLabel(stand);

  const existing = registrations.value.find((item) => item.user_id === userId);
  if (existing) {
    registrations.value = registrations.value.map((item) =>
      item.user_id === userId
        ? {
            ...item,
            stand,
            registration_count: registrationCount,
            operation_time: new Date().toISOString(),
          }
        : item,
    );
    return;
  }

  registrations.value = [
    ...registrations.value,
    {
      user_id: userId,
      stand,
      registration_count: registrationCount,
      paid: 0,
      operation_time: new Date().toISOString(),
    },
  ];
}

function applyCheckInState(record: BackendActivityCheckInRecord) {
  registrations.value = registrations.value.map((item) =>
    item.user_id === record.user_id
      ? {
          ...item,
          checked_in_at: record.checked_in_at,
          checkin_distance_meters: record.distance_meters,
        }
      : item,
  );
}

function applyCheckInConfigState(nextMatch: BackendActivity) {
  match.value = nextMatch;
}

function applyActivityReviewState() {
  reviewSubmitted.value = true;
}

function confirmRegistrationAction(options: { title: string; content: string; confirmText?: string }) {
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title: options.title,
      content: options.content,
      confirmText: options.confirmText ?? "确认",
      cancelText: "再想想",
      success: (result) => {
        resolve(!!result.confirm);
      },
      fail: () => resolve(false),
    });
  });
}

async function handleSelectIndividualSignup() {
  if (!match.value || submittingStatus.value) return;
  if (currentStatus.value === "参加") {
    await handleCancelIndividualSignup();
    return;
  }
  if (isAtRegistrationCapacity.value) {
    uni.showToast({
      title: "本场已满员",
      icon: "none",
    });
    return;
  }

  const confirmed = await confirmRegistrationAction({
    title: "确认报名",
    content: `确认报名参加「${match.value.name}」？`,
    confirmText: "确认报名",
  });
  if (!confirmed) return;

  submittingStatus.value = true;
  try {
    await ensureSessionReady();
    await updateMyStand(match.value.id, {
      stand: 1,
      registration_count: 1,
    });
    applyIndividualRegistrationState(1, 1);
    uni.showToast({
      title: "报名成功",
      icon: "none",
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "报名失败",
      icon: "none",
    });
  } finally {
    submittingStatus.value = false;
  }
}

async function handleCancelIndividualSignup() {
  if (!match.value || submittingStatus.value) return;

  const confirmed = await confirmRegistrationAction({
    title: "确认取消报名",
    content: `确认取消「${match.value.name}」的报名？取消后可重新报名。`,
    confirmText: "取消报名",
  });
  if (!confirmed) return;

  submittingStatus.value = true;
  try {
    await ensureSessionReady();
    await updateMyStand(match.value.id, {
      stand: 0,
      registration_count: 0,
    });
    applyIndividualRegistrationState(0, 0);
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
    submittingStatus.value = false;
  }
}

async function handleTeamSubmit() {
  if (!match.value || submittingStatus.value) return;
  if (!canUseTeamRegistration.value || !currentTeam.value) {
    uni.showToast({
      title: "仅队长或领队可发起球队报名",
      icon: "none",
      duration: 2800,
    });
    return;
  }

  const registrationCount = clampTeamRegistrationCount(Number(teamRegistrationCount.value));
  teamRegistrationCount.value = registrationCount;

  submittingStatus.value = true;
  try {
    if (existingTeamDerivedActivity.value) {
      const confirmed = await confirmRegistrationAction({
        title: "取消球队报名",
        content: "确认取消当前球队报名？对应的队内报名也会关闭。",
        confirmText: "取消报名",
      });
      if (!confirmed) return;

      await cancelTeamRegistration(match.value.id, {
        team_id: currentTeam.value.id,
      });
      sourceTeamRegistrationCount.value = Math.max(sourceTeamRegistrationCount.value - Number(existingTeamDerivedActivity.value.team_registration_count ?? 0), 0);
      existingTeamDerivedActivity.value = null;
      uni.showToast({
        title: "球队报名已取消",
        icon: "none",
      });
      return;
    }

    const derivedActivity = await submitTeamRegistration(match.value.id, {
      team_id: currentTeam.value.id,
      registration_count: registrationCount,
    });
    existingTeamDerivedActivity.value = derivedActivity;
    uni.showToast({
      title: "球队报名已发起",
      icon: "none",
    });
    if (derivedActivity.id && derivedActivity.id !== match.value.id) {
      setTimeout(() => {
        uni.redirectTo({ url: `/pages/matches/detail?id=${derivedActivity.id}` });
      }, 500);
    }
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "球队报名失败",
      icon: "none",
    });
  } finally {
    submittingStatus.value = false;
  }
}

async function handleCheckIn() {
  if (!match.value || !currentTeam.value || submittingStatus.value) return;
  if (!canShowCheckIn.value) {
    uni.showToast({
      title: "当前比赛未开启签到",
      icon: "none",
    });
    return;
  }
  if (hasCheckedIn.value) {
    uni.showToast({
      title: "你已经签到过了",
      icon: "none",
    });
    return;
  }

  submittingStatus.value = true;
  try {
    const location = await ensureCurrentLocation();
    if (!location) {
      throw new Error("未获取到当前位置");
    }
    const record = await submitActivityCheckIn(match.value.id, {
      team_id: currentTeam.value.id,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    applyCheckInState(record);
    uni.showToast({
      title: "签到成功",
      icon: "none",
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "签到失败",
      icon: "none",
    });
  } finally {
    submittingStatus.value = false;
  }
}

async function handleSaveCheckInConfig() {
  if (!match.value || !currentTeam.value || submittingStatus.value) return;
  if (!canManageCurrentMatch.value) {
    uni.showToast({ title: "只有队长或领队可以修改签到设置", icon: "none" });
    return;
  }

  submittingStatus.value = true;
  try {
    const nextMatch = await updateTeamCheckInConfig(match.value.id, {
      team_id: currentTeam.value.id,
      enabled: checkInForm.value.enabled,
      radius_meters: Number(checkInForm.value.radiusMeters),
      open_minutes_before: Number(checkInForm.value.openMinutesBefore),
      close_minutes_after: Number(checkInForm.value.closeMinutesAfter),
    });
    applyCheckInConfigState(nextMatch);
    uni.showToast({ title: "签到设置已保存", icon: "none" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "签到设置保存失败", icon: "none" });
  } finally {
    submittingStatus.value = false;
  }
}

async function handleSubmitActivityReview() {
  if (!match.value || !currentTeam.value || submittingStatus.value) return;
  if (!canSubmitActivityReview.value) {
    uni.showToast({ title: "比赛结束后由队长提交互评", icon: "none" });
    return;
  }

  submittingStatus.value = true;
  try {
    await submitTeamActivityReview(currentTeam.value.id, {
      activity_id: match.value.id,
      reviewer_team_id: currentTeam.value.id,
      rating: reviewForm.value.rating,
      comment: reviewForm.value.comment.trim() || undefined,
    });
    applyActivityReviewState();
    uni.showToast({ title: "赛后互评已提交", icon: "none" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "互评提交失败", icon: "none" });
  } finally {
    submittingStatus.value = false;
  }
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
  matchId.value = options?.id ?? "";
  startCountdownTimer();
  void loadPageData();
});

onUnload(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
});
</script>

<template>
  <view class="registration-page" :style="pageStyle">
    <AppTabHeader title="比赛报名" showBack showLocation />

    <view class="registration-content" :style="contentStyle">
      <view v-if="errorMessage" class="registration-empty">{{ errorMessage }}</view>
      <view v-else-if="isLoading" class="registration-skeleton-stack">
        <view class="registration-skeleton-segment">
          <view class="registration-skeleton-pill" />
          <view class="registration-skeleton-pill" />
        </view>

        <view class="registration-skeleton-card registration-skeleton-hero">
          <view class="registration-skeleton-copy">
            <view class="registration-skeleton-line registration-skeleton-line-chip" />
            <view class="registration-skeleton-line registration-skeleton-line-title" />
            <view class="registration-skeleton-line registration-skeleton-line-body" />
            <view class="registration-skeleton-line registration-skeleton-line-body short" />
          </view>
          <view class="registration-skeleton-ball" />
        </view>

        <view class="registration-skeleton-card registration-skeleton-countdown">
          <view class="registration-skeleton-row">
            <view class="registration-skeleton-line registration-skeleton-line-section" />
            <view class="registration-skeleton-pill small" />
          </view>
          <view class="registration-skeleton-line registration-skeleton-line-time" />
          <view class="registration-skeleton-progress" />
          <view class="registration-skeleton-avatar-row">
            <view class="registration-skeleton-avatar" />
            <view class="registration-skeleton-avatar" />
            <view class="registration-skeleton-avatar" />
            <view class="registration-skeleton-line registration-skeleton-line-body avatar-note" />
          </view>
        </view>

        <view class="registration-skeleton-card registration-skeleton-info">
          <view class="registration-skeleton-line registration-skeleton-line-section" />
          <view class="registration-skeleton-line registration-skeleton-line-body" />
          <view class="registration-skeleton-line registration-skeleton-line-body short" />
        </view>
      </view>

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

      <view v-if="registrationMode === 'individual'" class="individual-mode-shell">
        <view class="hero-black-card">
          <view class="hero-black-copy">
            <text class="hero-tone-badge">{{ eventToneLabel }}</text>
            <text class="hero-black-title">{{ match.name }}</text>
            <view class="hero-meta-row">
              <text class="hero-meta-icon">◷</text>
              <text class="hero-meta-text">{{ dateLine }}</text>
            </view>
            <view class="hero-meta-row">
              <text class="hero-meta-icon">⌖</text>
              <text class="hero-meta-text">{{ match.location }}</text>
            </view>
          </view>
          <view class="hero-visual-stage">
            <text class="hero-watermark">FOOTBALL</text>
            <view class="hero-net hero-net-left" />
            <view class="hero-net hero-net-right" />
            <view class="hero-card-ball hero-card-ball-main" />
          </view>
        </view>

        <view class="registration-card countdown-card">
          <view class="countdown-head">
            <view>
              <text class="section-title">报名截止</text>
              <text class="countdown-time">{{ countdownText }}</text>
            </view>
            <view class="countdown-total">
              已报
              <text class="countdown-total-strong">{{ joinedCount }}</text>
              /{{ requiredPlayers || "?" }}
            </view>
          </view>

          <view class="progress-track">
            <view class="progress-fill" :style="{ width: progressBaseWidth }" />
            <view class="progress-fill-extra" :style="{ left: progressSplitLeft, width: progressExtraWidth }" />
            <view class="progress-split" :style="{ left: progressSplitLeft }" />
          </view>

          <view class="countdown-avatars">
            <view class="avatar-stack">
              <view
                v-for="participant in participantPreview"
                :key="participant.id"
                class="mini-avatar"
                :style="{ background: participant.tone }"
              >
                <image
                  v-if="participant.avatarUrl"
                  class="mini-avatar-image"
                  :src="participant.avatarUrl"
                  mode="aspectFill"
                />
                <text v-else class="mini-avatar-text">{{ participant.name.slice(0, 1) }}</text>
              </view>
            </view>
            <text class="countdown-avatars-note">{{ remainingPlayersLabel }}</text>
          </view>

          <view class="individual-cta-button" @tap="handleSelectIndividualSignup">
            <text class="individual-cta-main">{{ submittingStatus ? "提交中..." : individualCtaLabel }}</text>
            <text class="individual-cta-side">免费</text>
          </view>
        </view>

        <view class="registration-card info-card">
          <view class="info-card-main">
            <text class="section-title">比赛说明</text>
            <view class="info-list">
              <view class="info-list-item">
                <text class="info-list-dot">◦</text>
                <text class="info-list-text">场地固定，爽约记录低</text>
              </view>
              <view class="info-list-item">
                <text class="info-list-dot">◦</text>
                <text class="info-list-text">迟到 10 分钟视为请假</text>
              </view>
              <view class="info-list-item">
                <text class="info-list-dot">◦</text>
                <text class="info-list-text">如遇雨天，提前 1 小时通知</text>
              </view>
            </view>
          </view>
          <view class="credit-box">
            <text class="credit-box-score">{{ currentTeam?.creditScore ?? 0 }} 分</text>
            <text class="credit-box-label">本场比赛信用</text>
          </view>
        </view>

        <view class="promo-banner">
          <view class="promo-copy">
            <text class="promo-kicker">闪动杯 FlashX Cup</text>
            <text class="promo-title">全民足球赛 火热报名中</text>
            <view class="promo-button">查看详情</view>
          </view>
          <view class="promo-cup" />
          <view class="promo-ball" />
        </view>

        <view class="interest-block">
          <view class="interest-head">
            <text class="section-title">你可能感兴趣</text>
            <text class="interest-more">更多 ›</text>
          </view>

          <view class="interest-grid">
            <view
              v-for="item in interestCards"
              :key="item.id"
              class="interest-card"
              @tap="openMatchDetail(item.id)"
            >
              <text class="interest-card-tag">报名中</text>
              <text class="interest-card-title">{{ item.title }}</text>
              <text class="interest-card-meta">{{ item.dateLine }}</text>
              <text class="interest-card-meta">{{ item.venue }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="registrationMode === 'team'" class="team-mode-shell">
        <view class="hero-black-card team-vs-card">
          <view class="hero-black-copy">
            <text class="hero-tone-badge">球队报名</text>
            <text class="hero-black-title">{{ match.name }}</text>
            <view class="hero-meta-row">
              <text class="hero-meta-icon">◷</text>
              <text class="hero-meta-text">{{ dateLine }}</text>
            </view>
            <view class="hero-meta-row">
              <text class="hero-meta-icon">⌖</text>
              <text class="hero-meta-text">{{ match.location }}</text>
            </view>
            <view class="hero-chip-row">
              <text v-for="chip in heroMetaChips" :key="chip" class="hero-meta-chip">{{ chip }}</text>
            </view>
          </view>

          <view class="vs-stage">
            <view class="vs-team-card">
              <view class="vs-logo">{{ currentTeam?.name?.slice(0, 1) || "队" }}</view>
              <text class="vs-team-name">{{ currentTeam?.name || "当前球队" }}</text>
              <text class="vs-team-credit">{{ currentTeam?.creditScore ?? 0 }} 分</text>
            </view>
            <text class="vs-mark">VS</text>
            <view class="vs-team-card">
              <view class="vs-logo vs-logo-muted">{{ opponentTeam?.name?.slice(0, 1) || "?" }}</view>
              <text class="vs-team-name">{{ opponentTeam?.name || match.opposing || "对手待定" }}</text>
              <text class="vs-team-credit vs-team-credit-muted">{{ opponentTeam?.credit_score ? `${opponentTeam.credit_score} 分` : "--" }}</text>
            </view>
          </view>
        </view>

        <view class="registration-card team-registration-form">
          <view class="team-form-head">
            <view>
              <text class="section-title">{{ teamFormTitle }}</text>
              <text class="team-form-copy">{{ teamSignupHint }}</text>
            </view>
            <view class="team-form-count-badge">{{ teamRegistrationCount }} 人</view>
          </view>

          <view class="team-readonly-list">
            <view class="team-readonly-field">
              <text class="team-readonly-label">比赛名称</text>
              <text class="team-readonly-value">{{ match.name }}</text>
            </view>
            <view class="team-readonly-field">
              <text class="team-readonly-label">对手</text>
              <text class="team-readonly-value">{{ match.opposing || opponentTeam?.name || "对手待定" }}</text>
            </view>
            <view class="team-readonly-field">
              <text class="team-readonly-label">比赛时间</text>
              <text class="team-readonly-value">{{ dateLine }}</text>
            </view>
            <view class="team-readonly-field">
              <text class="team-readonly-label">地点</text>
              <text class="team-readonly-value">{{ match.location }}</text>
            </view>
          </view>

          <view v-if="!existingTeamDerivedActivity" class="team-count-field">
            <text class="team-readonly-label">比赛人制</text>
            <wd-picker
              v-model="teamRegistrationCount"
              title="选择比赛人制"
              placeholder="请选择比赛人制"
              :columns="teamRegistrationCountOptions"
              value-key="value"
              label-key="label"
              confirm-button-text="确定"
              cancel-button-text="取消"
              custom-class="team-count-picker"
              custom-cell-class="team-count-picker-cell"
              custom-value-class="team-count-picker-value"
            />
          </view>
        </view>

        <view class="registration-card info-card">
          <view class="info-card-main">
            <text class="section-title">比赛说明</text>
            <view class="info-list">
              <view class="info-list-item">
                <text class="info-list-dot">•</text>
                <text class="info-list-text">名额满后可联系队长替补</text>
              </view>
              <view class="info-list-item">
                <text class="info-list-dot">•</text>
                <text class="info-list-text">如遇雨天，提前 1 小时通知</text>
              </view>
            </view>
          </view>
          <view class="credit-box">
            <text class="credit-box-score">{{ currentTeam?.creditScore ?? 0 }} 分</text>
            <text class="credit-box-label">球队信用</text>
          </view>
        </view>

        <view v-if="canShowCheckIn" class="checkin-card">
          <view>
            <text class="section-title">现场签到</text>
            <text class="checkin-copy">
              {{ hasCheckedIn ? "你已完成本场签到。" : "到达球场后使用当前位置完成签到。" }}
            </text>
          </view>
          <view :class="['checkin-button', hasCheckedIn ? 'checkin-button-disabled' : '']" @tap="handleCheckIn">
            {{ submittingStatus ? "提交中..." : hasCheckedIn ? "已签到" : "立即签到" }}
          </view>
        </view>

        <view v-if="canManageCurrentMatch" class="registration-card checkin-settings-card">
          <view class="checkin-settings-head">
            <view>
              <text class="section-title">签到设置</text>
              <text class="checkin-copy">可开启定位签到，保存后队员可在比赛详情页签到。</text>
            </view>
            <switch :checked="checkInForm.enabled" color="#c8ff00" @change="handleCheckInSwitchChange" />
          </view>
          <view v-if="checkInForm.enabled" class="checkin-config-grid">
            <view class="checkin-config-item">
              <text class="checkin-form-label">签到半径</text>
              <input v-model="checkInForm.radiusMeters" class="checkin-input" type="number" placeholder="200" />
            </view>
            <view class="checkin-config-item">
              <text class="checkin-form-label">提前开放</text>
              <input v-model="checkInForm.openMinutesBefore" class="checkin-input" type="number" placeholder="60" />
            </view>
            <view class="checkin-config-item">
              <text class="checkin-form-label">赛后关闭</text>
              <input v-model="checkInForm.closeMinutesAfter" class="checkin-input" type="number" placeholder="45" />
            </view>
            <view class="checkin-config-item">
              <text class="checkin-form-label">说明</text>
              <view class="checkin-input checkin-input-static">单位都是分钟 / 米</view>
            </view>
          </view>
          <view v-else class="checkin-disabled-note">本场不启用到场定位签到。</view>
          <view class="checkin-button checkin-settings-button" @tap="handleSaveCheckInConfig">
            {{ submittingStatus ? "保存中..." : "保存签到设置" }}
          </view>
        </view>

        <view v-if="canShowActivityReview" class="registration-card review-card">
          <view class="countdown-head">
            <view>
              <text class="section-title">赛后互评</text>
              <text class="checkin-copy">
                {{ reviewSubmitted ? "本场互评已提交。" : canSubmitActivityReview ? "给对手球队评分，信用分会同步更新。" : "比赛结束后由队长或领队提交。" }}
              </text>
            </view>
          </view>
          <picker :range="['1 分', '2 分', '3 分', '4 分', '5 分']" :value="reviewForm.rating - 1" @change="handleReviewRatingChange">
            <view class="checkin-input review-rating">评分 · {{ reviewForm.rating }} 分</view>
          </picker>
          <textarea v-model="reviewForm.comment" class="review-textarea" maxlength="120" placeholder="可选，记录对方到场、沟通和比赛体验" />
          <view :class="['checkin-button', !canSubmitActivityReview ? 'checkin-button-disabled' : '']" @tap="handleSubmitActivityReview">
            {{ reviewSubmitted ? "已提交互评" : submittingStatus ? "提交中..." : "提交赛后互评" }}
          </view>
        </view>
      </view>
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

.registration-top-hero {
  position: relative;
  min-height: 196rpx;
  padding: 12rpx 0 10rpx;
  overflow: hidden;
}

.registration-top-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding-right: 180rpx;
}

.registration-page-title {
  font-size: 62rpx;
  line-height: 1;
  font-weight: 900;
  color: #121212;
  letter-spacing: -2rpx;
}

.registration-page-subtitle {
  font-size: 28rpx;
  color: #4e4e4e;
  font-weight: 700;
}

.registration-top-art {
  position: absolute;
  right: -14rpx;
  bottom: -6rpx;
  width: 328rpx;
  height: 168rpx;
}

.hero-strike {
  position: absolute;
  right: 0;
  border-radius: 999rpx;
  transform: rotate(-18deg);
}

.hero-strike-one {
  top: 20rpx;
  width: 252rpx;
  height: 30rpx;
  background: #d9ff16;
  box-shadow: -40rpx 28rpx 0 rgba(217, 255, 22, 0.45);
}

.hero-strike-two {
  top: 72rpx;
  width: 220rpx;
  height: 18rpx;
  background: rgba(217, 255, 22, 0.8);
  box-shadow:
    -48rpx -22rpx 0 rgba(217, 255, 22, 0.55),
    -92rpx -32rpx 0 rgba(217, 255, 22, 0.3);
}

.hero-ball-shell {
  position: absolute;
  right: 28rpx;
  bottom: -18rpx;
  width: 156rpx;
  height: 156rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 32%, #ffffff 0%, #f7f7f7 42%, #d7d7d7 100%);
  box-shadow:
    inset -12rpx -18rpx 20rpx rgba(0, 0, 0, 0.1),
    0 18rpx 36rpx rgba(0, 0, 0, 0.18);
}

.hero-ball-core,
.hero-card-ball-main {
  position: relative;
  overflow: hidden;
}

.hero-ball-core::before,
.hero-ball-core::after,
.hero-card-ball-main::before,
.hero-card-ball-main::after {
  content: "";
  position: absolute;
  border-radius: 50%;
}

.hero-ball-core {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 38%, rgba(0, 0, 0, 0.96) 0 12%, transparent 13%),
    radial-gradient(circle at 27% 62%, rgba(0, 0, 0, 0.92) 0 9%, transparent 10%),
    radial-gradient(circle at 68% 65%, rgba(0, 0, 0, 0.92) 0 9%, transparent 10%),
    radial-gradient(circle at 50% 85%, rgba(0, 0, 0, 0.9) 0 9%, transparent 10%);
}

.hero-ball-core::before,
.hero-card-ball-main::before {
  inset: 20rpx;
  border: 4rpx solid rgba(0, 0, 0, 0.18);
}

.hero-ball-core::after,
.hero-card-ball-main::after {
  left: 44rpx;
  top: 18rpx;
  width: 28rpx;
  height: 16rpx;
  background: rgba(255, 255, 255, 0.92);
  filter: blur(2rpx);
}

.registration-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.registration-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.registration-skeleton-card,
.registration-skeleton-segment,
.registration-skeleton-line,
.registration-skeleton-pill,
.registration-skeleton-ball,
.registration-skeleton-progress,
.registration-skeleton-avatar {
  position: relative;
  overflow: hidden;
}

.registration-skeleton-card::after,
.registration-skeleton-segment::after,
.registration-skeleton-line::after,
.registration-skeleton-pill::after,
.registration-skeleton-ball::after,
.registration-skeleton-progress::after,
.registration-skeleton-avatar::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.72) 50%, transparent 100%);
  animation: registration-skeleton-shimmer 1.2s ease-in-out infinite;
}

.registration-skeleton-segment {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  padding: 10rpx;
  border-radius: 999rpx;
  background: #ececec;
}

.registration-skeleton-card {
  border-radius: 28rpx;
  background: #eef2e8;
}

.registration-skeleton-hero {
  min-height: 330rpx;
  padding: 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #202020;
}

.registration-skeleton-copy {
  width: 58%;
}

.registration-skeleton-countdown,
.registration-skeleton-info {
  padding: 28rpx;
}

.registration-skeleton-countdown {
  min-height: 270rpx;
}

.registration-skeleton-info {
  min-height: 190rpx;
}

.registration-skeleton-row,
.registration-skeleton-avatar-row {
  display: flex;
  align-items: center;
}

.registration-skeleton-row {
  justify-content: space-between;
  gap: 18rpx;
}

.registration-skeleton-avatar-row {
  gap: 10rpx;
  margin-top: 28rpx;
}

.registration-skeleton-line {
  height: 24rpx;
  border-radius: 999rpx;
  background: #dde4d5;
}

.registration-skeleton-line + .registration-skeleton-line {
  margin-top: 16rpx;
}

.registration-skeleton-line-chip {
  width: 132rpx;
  height: 42rpx;
  background: #d9ff16;
}

.registration-skeleton-line-title {
  width: 100%;
  height: 52rpx;
  background: #3a3a3a;
}

.registration-skeleton-line-body {
  width: 78%;
}

.registration-skeleton-hero .registration-skeleton-line-body {
  background: #3a3a3a;
}

.registration-skeleton-line-body.short {
  width: 56%;
}

.registration-skeleton-line-section {
  width: 220rpx;
  height: 34rpx;
}

.registration-skeleton-line-time {
  width: 300rpx;
  height: 54rpx;
  margin-top: 18rpx;
}

.registration-skeleton-line-body.avatar-note {
  width: 220rpx;
  margin-top: 0;
  margin-left: 10rpx;
}

.registration-skeleton-pill {
  height: 74rpx;
  border-radius: 999rpx;
  background: #dde4d5;
}

.registration-skeleton-pill.small {
  width: 124rpx;
  height: 58rpx;
  flex-shrink: 0;
}

.registration-skeleton-ball {
  width: 156rpx;
  height: 156rpx;
  border-radius: 999rpx;
  background: #3a3a3a;
  flex-shrink: 0;
}

.registration-skeleton-progress {
  width: 100%;
  height: 18rpx;
  margin-top: 28rpx;
  border-radius: 999rpx;
  background: #dde4d5;
}

.registration-skeleton-avatar {
  width: 58rpx;
  height: 58rpx;
  border-radius: 999rpx;
  background: #dde4d5;
}

@keyframes registration-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
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
  background: #d9ff16;
  color: #171717;
}

.individual-mode-shell,
.team-mode-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.hero-black-card,
.registration-card,
.promo-banner {
  position: relative;
  overflow: hidden;
  border-radius: 28rpx;
  box-sizing: border-box;
}

.hero-black-card {
  padding: 30rpx;
  background: linear-gradient(140deg, #222222 0%, #1c1c1c 54%, #2a2a2a 100%);
  min-height: 330rpx;
}

.hero-black-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  max-width: 56%;
}

.hero-tone-badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #d9ff16;
  color: #181818;
  font-size: 24rpx;
  font-weight: 900;
}

.hero-black-title {
  font-size: 50rpx;
  line-height: 1.15;
  color: #ffffff;
  font-weight: 900;
}

.hero-meta-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.hero-meta-icon {
  color: #f2f2f2;
  font-size: 24rpx;
}

.hero-meta-text {
  color: rgba(255, 255, 255, 0.86);
  font-size: 28rpx;
  line-height: 1.4;
}

.hero-visual-stage {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 48%;
}

.hero-watermark {
  position: absolute;
  right: 12rpx;
  top: 10rpx;
  color: rgba(217, 255, 22, 0.16);
  font-size: 82rpx;
  line-height: 1;
  font-weight: 900;
  transform: skew(-10deg);
}

.hero-net {
  position: absolute;
  right: 0;
  top: 24rpx;
  width: 180rpx;
  height: 246rpx;
  background-image:
    linear-gradient(115deg, transparent 46%, rgba(255, 255, 255, 0.34) 47%, rgba(255, 255, 255, 0.34) 49%, transparent 50%),
    linear-gradient(65deg, transparent 46%, rgba(255, 255, 255, 0.26) 47%, rgba(255, 255, 255, 0.26) 49%, transparent 50%);
  background-size: 36rpx 36rpx;
  opacity: 0.9;
}

.hero-net-left {
  right: 62rpx;
  top: 118rpx;
  width: 132rpx;
  height: 96rpx;
  transform: rotate(-16deg);
}

.hero-net-right {
  right: -14rpx;
  top: 36rpx;
  width: 190rpx;
  height: 252rpx;
}

.hero-card-ball-main {
  position: absolute;
  right: 54rpx;
  bottom: 26rpx;
  width: 148rpx;
  height: 148rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 32%, #ffffff 0%, #f6f6f6 44%, #cfcfcf 100%);
  box-shadow:
    inset -12rpx -16rpx 20rpx rgba(0, 0, 0, 0.16),
    0 20rpx 26rpx rgba(0, 0, 0, 0.3);
}

.countdown-card,
.info-card,
.team-registration-form,
.checkin-settings-card,
.review-card {
  padding: 26rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 36rpx rgba(10, 10, 10, 0.05);
}

.countdown-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.section-title {
  display: block;
  color: #171717;
  font-size: 38rpx;
  line-height: 1.25;
  font-weight: 900;
}

.countdown-time {
  display: block;
  margin-top: 12rpx;
  color: #131313;
  font-size: 62rpx;
  line-height: 1;
  font-weight: 900;
}

.countdown-total {
  color: #6b6b6b;
  font-size: 30rpx;
  line-height: 1.4;
  font-weight: 700;
}

.countdown-total-strong {
  color: #d0ea14;
  font-size: 52rpx;
  font-weight: 900;
  margin: 0 6rpx;
}

.progress-track {
  position: relative;
  height: 18rpx;
  margin-top: 24rpx;
  border-radius: 999rpx;
  background: #eceef3;
  overflow: hidden;
}

.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #d9ff16 0%, #b8ff00 100%);
}

.progress-fill-extra {
  position: absolute;
  top: 0;
  height: 100%;
  background: #ff4d3d;
}

.progress-split {
  position: absolute;
  top: -3rpx;
  width: 4rpx;
  height: 24rpx;
  border-radius: 999rpx;
  background: #ffffff;
  box-shadow: 0 0 0 2rpx rgba(17, 17, 17, 0.06);
  transform: translateX(-50%);
}

.countdown-avatars {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 24rpx;
}

.avatar-stack {
  display: flex;
  align-items: center;
}

.mini-avatar {
  position: relative;
  width: 58rpx;
  height: 58rpx;
  margin-left: -10rpx;
  border: 4rpx solid #ffffff;
  border-radius: 50%;
  overflow: hidden;
  box-sizing: border-box;
}

.mini-avatar:first-child {
  margin-left: 0;
}

.mini-avatar-image {
  width: 100%;
  height: 100%;
}

.mini-avatar-text {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
}

.countdown-avatars-note {
  color: #303030;
  font-size: 30rpx;
  font-weight: 700;
}

.individual-cta-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  height: 88rpx;
  margin-top: 26rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, #2f82ff 0%, #2b68f7 100%);
  box-shadow: 0 14rpx 28rpx rgba(43, 104, 247, 0.22);
}

.individual-cta-main,
.individual-cta-side {
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
}

.info-card {
  display: flex;
  align-items: stretch;
  gap: 20rpx;
}

.info-card-main {
  flex: 1;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}

.info-list-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.info-list-dot {
  color: #171717;
  font-size: 26rpx;
  font-weight: 900;
}

.info-list-text {
  color: #373737;
  font-size: 28rpx;
  line-height: 1.45;
}

.credit-box {
  flex-shrink: 0;
  width: 172rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10rpx;
  border-radius: 24rpx;
  background: linear-gradient(180deg, #f3ffd0 0%, #eff8b2 100%);
}

.credit-box-score {
  color: #1c1c1c;
  font-size: 42rpx;
  font-weight: 900;
}

.credit-box-label {
  color: #5f6d19;
  font-size: 26rpx;
  font-weight: 700;
  text-align: center;
}

.promo-banner {
  min-height: 190rpx;
  padding: 26rpx;
  background: linear-gradient(135deg, #1368ff 0%, #256cff 44%, #0f4ed2 100%);
}

.promo-banner::before {
  content: "";
  position: absolute;
  right: 110rpx;
  top: -40rpx;
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(217, 255, 22, 0.16) 0%, transparent 72%);
}

.promo-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  max-width: 52%;
}

.promo-kicker,
.promo-title {
  color: #ffffff;
  font-weight: 900;
}

.promo-kicker {
  font-size: 24rpx;
}

.promo-title {
  font-size: 40rpx;
  line-height: 1.2;
}

.promo-button {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  min-width: 156rpx;
  height: 56rpx;
  margin-top: 6rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: #d9ff16;
  color: #171717;
  font-size: 26rpx;
  font-weight: 900;
}

.promo-cup {
  position: absolute;
  right: 86rpx;
  bottom: -8rpx;
  width: 122rpx;
  height: 148rpx;
  border-radius: 24rpx 24rpx 34rpx 34rpx;
  background: linear-gradient(180deg, #ffba4b 0%, #c77807 100%);
  box-shadow:
    inset -10rpx -14rpx 18rpx rgba(0, 0, 0, 0.18),
    0 18rpx 28rpx rgba(0, 0, 0, 0.2);
  transform: rotate(12deg);
}

.promo-cup::before,
.promo-cup::after {
  content: "";
  position: absolute;
  top: 24rpx;
  width: 36rpx;
  height: 64rpx;
  border: 8rpx solid rgba(255, 196, 94, 0.85);
  border-radius: 50%;
}

.promo-cup::before {
  left: -24rpx;
}

.promo-cup::after {
  right: -24rpx;
}

.promo-ball {
  position: absolute;
  right: 26rpx;
  bottom: 22rpx;
  width: 74rpx;
  height: 74rpx;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 38%, rgba(0, 0, 0, 0.96) 0 12%, transparent 13%),
    radial-gradient(circle at 27% 62%, rgba(0, 0, 0, 0.92) 0 9%, transparent 10%),
    radial-gradient(circle at 68% 65%, rgba(0, 0, 0, 0.92) 0 9%, transparent 10%),
    radial-gradient(circle at 50% 85%, rgba(0, 0, 0, 0.9) 0 9%, transparent 10%),
    radial-gradient(circle at 35% 32%, #ffffff 0%, #f6f6f6 44%, #cfcfcf 100%);
  box-shadow: 0 12rpx 18rpx rgba(0, 0, 0, 0.16);
}

.interest-block {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.interest-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.interest-more {
  color: #444444;
  font-size: 28rpx;
  font-weight: 700;
}

.interest-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.interest-card {
  position: relative;
  min-height: 172rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background:
    linear-gradient(160deg, rgba(18, 18, 18, 0.94) 0%, rgba(33, 33, 33, 0.95) 100%),
    #1a1a1a;
  overflow: hidden;
  box-sizing: border-box;
}

.interest-card::before {
  content: "";
  position: absolute;
  right: -14rpx;
  top: 18rpx;
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(217, 255, 22, 0.18) 0%, transparent 74%);
}

.interest-card-tag {
  display: inline-flex;
  align-self: flex-start;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #d9ff16;
  color: #181818;
  font-size: 22rpx;
  font-weight: 900;
}

.interest-card-title {
  display: block;
  margin-top: 20rpx;
  color: #ffffff;
  font-size: 36rpx;
  line-height: 1.18;
  font-weight: 900;
}

.interest-card-meta {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.76);
  font-size: 24rpx;
  line-height: 1.4;
}

.hero-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 8rpx;
}

.hero-meta-chip {
  display: inline-flex;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.88);
  font-size: 24rpx;
  font-weight: 800;
}

.team-vs-card {
  display: flex;
  flex-direction: column;
}

.vs-stage {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12rpx;
  margin-top: 30rpx;
}

.vs-team-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  text-align: center;
}

.vs-logo {
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 6rpx solid #d9ff16;
  background: #0f0f0f;
  color: #ffffff;
  font-size: 50rpx;
  font-weight: 900;
}

.vs-logo-muted {
  border-color: rgba(255, 255, 255, 0.4);
  background: linear-gradient(180deg, #858585 0%, #5e5e5e 100%);
}

.vs-team-name {
  color: #ffffff;
  font-size: 28rpx;
  line-height: 1.28;
  font-weight: 800;
}

.vs-team-credit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 92rpx;
  height: 42rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: #d9ff16;
  color: #171717;
  font-size: 24rpx;
  font-weight: 900;
}

.vs-team-credit-muted {
  background: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.86);
}

.vs-mark {
  color: #d9ff16;
  font-size: 72rpx;
  line-height: 1;
  font-weight: 900;
  font-style: italic;
}

.team-form-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.team-form-copy {
  display: block;
  margin-top: 10rpx;
  color: #666666;
  font-size: 26rpx;
  line-height: 1.5;
  font-weight: 700;
}

.team-form-count-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 118rpx;
  height: 64rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: #d9ff16;
  color: #171717;
  font-size: 28rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.team-readonly-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 26rpx;
}

.team-readonly-field {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #f1f1f1;
}

.team-readonly-label {
  color: #777777;
  font-size: 27rpx;
  line-height: 1.45;
  font-weight: 800;
  flex-shrink: 0;
}

.team-readonly-value {
  min-width: 0;
  color: #171717;
  font-size: 29rpx;
  line-height: 1.45;
  font-weight: 900;
  text-align: right;
  word-break: break-word;
}

.team-count-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 20rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f7f8f3;
}

.team-count-field :deep(.team-count-picker-cell) {
  padding: 0;
  background: transparent;
}

.team-count-field :deep(.team-count-picker-value) {
  color: #171717;
  font-size: 30rpx;
  font-weight: 900;
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

.checkin-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 24rpx;
  padding: 26rpx;
  border-radius: 28rpx;
  background: #10110f;
  box-shadow: 0 18rpx 30rpx rgba(16, 17, 15, 0.12);
}

.checkin-settings-card,
.review-card {
  margin-top: 24rpx;
}

.checkin-settings-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.checkin-config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
}

.checkin-config-item {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-width: 0;
}

.checkin-form-label {
  color: #111310;
  font-size: 22rpx;
  line-height: 1.35;
  font-weight: 700;
}

.checkin-input,
.review-textarea {
  width: 100%;
  border-radius: 24rpx;
  border: 2rpx solid #d7ddd2;
  background: #f4f6f0;
  color: #111310;
  font-size: 28rpx;
  font-weight: 800;
  box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.74);
  box-sizing: border-box;
}

.checkin-input {
  min-height: 88rpx;
  padding: 0 22rpx;
  display: flex;
  align-items: center;
}

.checkin-input-static {
  color: #60655d;
}

.checkin-disabled-note {
  margin-top: 20rpx;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: #f4f6f0;
  color: #5f645c;
  font-size: 26rpx;
  line-height: 1.6;
  font-weight: 700;
}

.checkin-settings-button {
  width: 100%;
  margin-top: 20rpx;
}

.review-rating {
  margin-top: 18rpx;
}

.review-textarea {
  min-height: 132rpx;
  margin-top: 14rpx;
  padding: 18rpx;
}

.checkin-copy {
  display: block;
  margin-top: 8rpx;
  color: #747972;
  font-size: 24rpx;
  font-weight: 700;
}

.checkin-card .checkin-copy {
  color: rgba(255, 255, 255, 0.72);
}

.checkin-button {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 168rpx;
  height: 72rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #10110f;
  font-size: 26rpx;
  font-weight: 900;
}

.checkin-button-disabled {
  opacity: 0.5;
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
