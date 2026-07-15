<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import { getHealth } from "@/api/system";
import type { TeamMembership, TeamRole } from "@/types/api";
import { useSession } from "@/stores/session";

type ServiceState = "checking" | "online" | "offline";

const { currentUser, teams, loading, errorMessage, isLoggedIn, login, logout, refreshTeams } = useSession();
const serviceState = ref<ServiceState>("checking");
const selectedTeamId = ref<number | null>(null);

const selectedTeam = computed(() => teams.value.find((team) => team.id === selectedTeamId.value) || teams.value[0] || null);
const displayName = computed(() => currentUser.value?.nickname.trim() || "球员");
const avatarLetter = computed(() => Array.from(displayName.value)[0] || "球");
const serviceLabel = computed(() => ({ checking: "连接中", online: "服务在线", offline: "服务离线" })[serviceState.value]);

const roleLabels: Record<TeamRole, string> = {
  captain: "队长",
  leader: "领队",
  vice_captain: "副队长",
  member: "队员",
};

function roleLabel(role: TeamRole) {
  return roleLabels[role];
}

function joinedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function checkHealth() {
  serviceState.value = "checking";
  try {
    await getHealth();
    serviceState.value = "online";
  } catch (_error) {
    serviceState.value = "offline";
  }
}

async function handleLogin() {
  try {
    await login();
    uni.showToast({ title: "登录成功", icon: "success" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "登录失败", icon: "none" });
  }
}

function handleLogout() {
  uni.showModal({
    title: "退出登录",
    content: "退出后将清除当前设备上的登录状态。",
    success: ({ confirm }) => {
      if (confirm) logout();
    },
  });
}

async function refreshPage() {
  await Promise.all([checkHealth(), refreshTeams()]);
}

onMounted(checkHealth);
onShow(() => {
  if (isLoggedIn.value) void refreshTeams();
});
onPullDownRefresh(async () => {
  await refreshPage();
  uni.stopPullDownRefresh();
});
</script>

<template>
  <view class="page">
    <view class="desktop-frame">
      <view class="hero">
        <image class="hero-image" src="/static/football-field.jpg" mode="aspectFill" />
        <view class="hero-shade" />

        <view class="topbar">
          <view class="brand">
            <view class="brand-mark"><text>KT</text></view>
            <text class="brand-name">开踢</text>
          </view>
          <button class="service-pill" :class="`service-${serviceState}`" @click="checkHealth">
            <view class="service-dot" />
            <text>{{ serviceLabel }}</text>
          </button>
        </view>

        <view class="hero-content">
          <text class="hero-kicker">MATCH DAY</text>
          <text class="hero-title">把下一场球，安排明白。</text>
          <text class="hero-meta">球队 · 对手 · 报名</text>
        </view>
      </view>

      <view class="content">
        <view v-if="!isLoggedIn" class="session-panel">
          <view class="session-copy">
            <text class="section-eyebrow">PLAYER ACCESS</text>
            <text class="section-title">进入你的球队空间</text>
            <text class="section-note">你的身份与球队，将在这里汇合。</text>
          </view>
          <button class="primary-button" :loading="loading" :disabled="loading" @click="handleLogin">
            微信登录
          </button>
        </view>

        <template v-else>
          <view class="profile-row">
            <view class="avatar">
              <image v-if="currentUser?.avatar_url" :src="currentUser.avatar_url" mode="aspectFill" />
              <text v-else>{{ avatarLetter }}</text>
            </view>
            <view class="profile-copy">
              <text class="welcome">晚上好，{{ displayName }}</text>
              <text class="profile-meta">{{ teams.length }} 支球队</text>
            </view>
            <button class="text-button" @click="handleLogout">退出</button>
          </view>

          <view class="section-head">
            <view>
              <text class="section-eyebrow">MY TEAMS</text>
              <text class="section-title">我的球队</text>
            </view>
            <button class="refresh-button" :loading="loading" :disabled="loading" @click="refreshTeams">刷新</button>
          </view>

          <scroll-view v-if="teams.length" class="team-strip" scroll-x enhanced :show-scrollbar="false">
            <view class="team-row">
              <button
                v-for="team in teams"
                :key="team.id"
                class="team-card"
                :class="{ selected: selectedTeam?.id === team.id }"
                @click="selectedTeamId = team.id"
              >
                <view class="team-logo">
                  <image v-if="team.logo_url" :src="team.logo_url" mode="aspectFill" />
                  <text v-else>{{ Array.from(team.name)[0] || "队" }}</text>
                </view>
                <view class="team-copy">
                  <text class="team-name">{{ team.name }}</text>
                  <text class="team-role">{{ roleLabel(team.role) }} · {{ joinedDate(team.joined_at) }} 加入</text>
                </view>
              </button>
            </view>
          </scroll-view>

          <view v-else class="empty-state">
            <view class="empty-number">00</view>
            <view>
              <text class="empty-title">还没有加入球队</text>
              <text class="empty-note">暂未查询到所属球队。</text>
            </view>
          </view>

          <view v-if="selectedTeam" class="team-detail">
            <view class="detail-index">{{ String(teams.findIndex((team) => team.id === selectedTeam?.id) + 1).padStart(2, "0") }}</view>
            <view class="detail-main">
              <text class="detail-label">当前球队</text>
              <text class="detail-title">{{ selectedTeam.name }}</text>
              <text class="detail-description">{{ selectedTeam.description || "保持训练，等待下一场比赛。" }}</text>
            </view>
            <view class="role-badge">{{ roleLabel(selectedTeam.role) }}</view>
          </view>
        </template>

        <view v-if="errorMessage" class="error-banner">
          <text>{{ errorMessage }}</text>
        </view>

        <view class="footer-line">
          <text>GO SERVICE</text>
          <view />
          <text>2026</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #e8ece6;
}

.desktop-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--canvas);
}

.hero {
  position: relative;
  height: 600rpx;
  min-height: 360px;
  overflow: hidden;
  color: #fff;
}

.hero-image,
.hero-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hero-shade {
  background: rgba(10, 17, 11, 0.42);
}

.topbar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--status-bar-height, 0px) + 28rpx) 30rpx 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.brand-mark {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid rgba(255, 255, 255, 0.78);
  background: rgba(20, 28, 21, 0.36);
  font-size: 20rpx;
  font-weight: 900;
}

.brand-name {
  font-size: 34rpx;
  font-weight: 900;
}

.service-pill {
  display: flex;
  min-height: 58rpx;
  align-items: center;
  gap: 10rpx;
  padding: 0 18rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.38);
  border-radius: 8rpx;
  background: rgba(20, 28, 21, 0.42);
  color: #fff;
  font-size: 22rpx;
  line-height: 1;
  backdrop-filter: blur(14px);
}

.service-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #f5b83d;
}

.service-online .service-dot {
  background: var(--accent);
}

.service-offline .service-dot {
  background: #ff775f;
}

.hero-content {
  position: absolute;
  z-index: 1;
  right: 30rpx;
  bottom: 54rpx;
  left: 30rpx;
  display: flex;
  flex-direction: column;
}

.hero-kicker,
.section-eyebrow,
.detail-label,
.footer-line {
  letter-spacing: 0;
  font-size: 20rpx;
  font-weight: 800;
}

.hero-kicker {
  color: var(--accent);
}

.hero-title {
  max-width: 620rpx;
  margin-top: 14rpx;
  font-size: 58rpx;
  font-weight: 900;
  line-height: 1.15;
}

.hero-meta {
  margin-top: 22rpx;
  color: rgba(255, 255, 255, 0.78);
  font-size: 24rpx;
}

.content {
  padding: 36rpx 28rpx calc(50rpx + env(safe-area-inset-bottom));
}

.session-panel {
  display: grid;
  gap: 30rpx;
  padding-bottom: 36rpx;
  border-bottom: 2rpx solid var(--line);
}

.session-copy {
  display: flex;
  flex-direction: column;
}

.section-eyebrow {
  color: #75806f;
}

.section-title {
  display: block;
  margin-top: 8rpx;
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.2;
}

.section-note {
  margin-top: 12rpx;
  color: var(--muted);
  font-size: 25rpx;
  line-height: 1.6;
}

.primary-button {
  display: flex;
  width: 100%;
  height: 94rpx;
  align-items: center;
  justify-content: center;
  border-radius: 6rpx;
  background: var(--ink);
  color: #fff;
  font-size: 28rpx;
  font-weight: 800;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding-bottom: 34rpx;
  border-bottom: 2rpx solid var(--line);
}

.avatar,
.team-logo {
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  background: var(--ink);
  color: #fff;
  font-weight: 900;
}

.avatar,
.avatar image {
  width: 82rpx;
  height: 82rpx;
}

.profile-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.welcome {
  overflow: hidden;
  font-size: 30rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-meta {
  margin-top: 6rpx;
  color: var(--muted);
  font-size: 22rpx;
}

.text-button,
.refresh-button {
  min-height: 58rpx;
  padding: 0 18rpx;
  border: 2rpx solid var(--line);
  border-radius: 6rpx;
  background: transparent;
  color: var(--ink);
  font-size: 22rpx;
  line-height: 54rpx;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 40rpx;
}

.team-strip {
  width: calc(100% + 28rpx);
  margin-top: 24rpx;
}

.team-row {
  display: flex;
  gap: 18rpx;
  padding-right: 28rpx;
}

.team-card {
  display: flex;
  width: 520rpx;
  min-width: 520rpx;
  min-height: 142rpx;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx;
  border: 2rpx solid var(--line);
  border-radius: 8rpx;
  background: var(--surface);
  text-align: left;
}

.team-card.selected {
  border-color: var(--ink);
  box-shadow: inset 8rpx 0 0 var(--accent);
}

.team-logo,
.team-logo image {
  width: 80rpx;
  height: 80rpx;
}

.team-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.team-name {
  overflow: hidden;
  font-size: 28rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-role {
  margin-top: 9rpx;
  color: var(--muted);
  font-size: 22rpx;
}

.empty-state {
  display: flex;
  align-items: center;
  gap: 28rpx;
  margin-top: 24rpx;
  padding: 32rpx 0;
  border-top: 2rpx solid var(--line);
  border-bottom: 2rpx solid var(--line);
}

.empty-number {
  color: #bec5bc;
  font-size: 68rpx;
  font-weight: 900;
}

.empty-title {
  display: block;
  font-size: 28rpx;
  font-weight: 800;
}

.empty-note {
  display: block;
  margin-top: 8rpx;
  color: var(--muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.team-detail {
  display: grid;
  grid-template-columns: 92rpx 1fr auto;
  gap: 24rpx;
  align-items: start;
  margin-top: 30rpx;
  padding: 28rpx;
  border-radius: 8rpx;
  background: var(--ink);
  color: #fff;
}

.detail-index {
  color: var(--accent);
  font-size: 48rpx;
  font-weight: 900;
}

.detail-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.detail-label {
  color: rgba(255, 255, 255, 0.55);
}

.detail-title {
  margin-top: 10rpx;
  font-size: 34rpx;
  font-weight: 900;
}

.detail-description {
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.72);
  font-size: 22rpx;
  line-height: 1.6;
}

.role-badge {
  padding: 8rpx 12rpx;
  border-radius: 4rpx;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 20rpx;
  font-weight: 900;
}

.error-banner {
  margin-top: 24rpx;
  padding: 20rpx;
  border-left: 6rpx solid #e7573e;
  background: #fff0ec;
  color: #9d2f1d;
  font-size: 23rpx;
  line-height: 1.5;
}

.footer-line {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 18rpx;
  margin-top: 48rpx;
  color: #8a938b;
}

.footer-line view {
  height: 2rpx;
  background: var(--line);
}

@media (min-width: 768px) {
  .page {
    padding: 32px;
  }

  .desktop-frame {
    max-width: 1120px;
    min-height: calc(100vh - 64px);
    margin: 0 auto;
    overflow: hidden;
    border: 1px solid #d8ded6;
    box-shadow: 0 24px 70px rgba(25, 36, 27, 0.13);
  }

  .hero {
    height: 500px;
  }

  .hero-content,
  .topbar {
    right: 52px;
    left: 52px;
  }

  .topbar {
    padding: 36px 0 0;
  }

  .hero-title {
    max-width: 680px;
    font-size: 54px;
  }

  .content {
    padding: 44px 52px 52px;
  }

  .session-panel {
    grid-template-columns: 1fr 240px;
    align-items: end;
  }

  .primary-button {
    height: 52px;
  }

  .team-card {
    width: 360px;
    min-width: 360px;
  }
}
</style>
