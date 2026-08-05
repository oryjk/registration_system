<script setup lang="ts">
import { computed } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import { isUnauthorized } from "@/api/http";
import { useSession } from "@/stores/session";
import type { HomeActionMatch, HomeEndedMatch } from "@/types/api";
import ActionMatchCard from "@/pages/home/components/ActionMatchCard.vue";
import ActionMatchRow from "@/pages/home/components/ActionMatchRow.vue";
import EndedMatchList from "@/pages/home/components/EndedMatchList.vue";
import HomeBottomNav from "@/pages/home/components/HomeBottomNav.vue";
import HomeHeader from "@/pages/home/components/HomeHeader.vue";
import HomeHero from "@/pages/home/components/HomeHero.vue";
import { useHomeMatches } from "@/pages/home/useHomeMatches";

type HomeNavAction = "home" | "team" | "create" | "stats" | "profile";

const {
  currentUser,
  loading: sessionLoading,
  isLoggedIn,
  login,
  logout,
  refreshTeams,
} = useSession();
const { homeData, loading, errorMessage, load, reset } = useHomeMatches();

const primaryAction = computed(() => homeData.value?.action_items[0] || null);
const secondaryActions = computed(() => homeData.value?.action_items.slice(1, 3) || []);
const endedMatches = computed(() => homeData.value?.ended_items || []);

async function loadHome() {
  if (!isLoggedIn.value) {
    reset();
    return;
  }
  const error = await load();
  if (isUnauthorized(error)) {
    logout();
    reset();
    uni.showToast({ title: "登录已失效，请重新登录", icon: "none" });
  }
}

async function handleLogin() {
  try {
    await login();
    await loadHome();
    if (isLoggedIn.value) {
      uni.showToast({ title: "登录成功", icon: "success" });
    }
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "登录失败", icon: "none" });
  }
}

async function refreshPage() {
  if (isLoggedIn.value) {
    await refreshTeams();
    await loadHome();
  }
}

function showPlaceholder(title: string) {
  uni.showToast({ title, icon: "none", duration: 1800 });
}

function openMatch(_match: HomeActionMatch | HomeEndedMatch) {
  showPlaceholder("比赛详情页将在后续实现");
}

function handleNavigation(action: HomeNavAction) {
  const messages: Record<Exclude<HomeNavAction, "home">, string> = {
    team: "约队大厅将在后续实现",
    create: "创建比赛将在后续实现",
    stats: "统计页面将在后续实现",
    profile: "个人中心将在后续实现",
  };
  if (action === "home") {
    uni.pageScrollTo({ scrollTop: 0, duration: 180 });
    return;
  }
  showPlaceholder(messages[action]);
}

onShow(() => {
  void loadHome();
});

onPullDownRefresh(async () => {
  await refreshPage();
  uni.stopPullDownRefresh();
});
</script>

<template>
  <view class="page">
    <view class="desktop-frame">
      <HomeHeader @select-location="showPlaceholder('位置选择将在后续实现')" />

      <view class="page-content">
        <HomeHero @open-team-hall="showPlaceholder('约队大厅将在后续实现')" />

        <view v-if="!isLoggedIn" class="login-state">
          <view class="login-copy">
            <text class="state-kicker">PLAYER ACCESS</text>
            <text class="state-title">登录后查看你的比赛</text>
            <text class="state-note">待报名、进行中和最近结束的比赛会集中显示在这里。</text>
          </view>
          <button class="primary-button" :loading="sessionLoading" :disabled="sessionLoading" @click="handleLogin">
            微信登录
          </button>
        </view>

        <template v-else>
          <view class="account-strip">
            <view class="avatar">
              <image v-if="currentUser?.avatar_url" :src="currentUser.avatar_url" mode="aspectFill" />
              <text v-else>{{ Array.from(currentUser?.nickname || "球")[0] }}</text>
            </view>
            <view class="account-copy">
              <text class="account-greeting">{{ currentUser?.nickname || "球员" }}，准备开踢</text>
              <text class="account-note">球队赛程与报名状态</text>
            </view>
          </view>

          <view v-if="loading && !homeData" class="loading-state" aria-label="正在加载比赛">
            <view class="skeleton skeleton-head" />
            <view class="skeleton skeleton-card" />
            <view class="skeleton skeleton-row" />
            <view class="skeleton skeleton-row short" />
          </view>

          <view v-else-if="errorMessage && !homeData" class="error-state">
            <view class="error-mark">!</view>
            <text class="state-title">比赛暂时没有加载出来</text>
            <text class="state-note">{{ errorMessage }}</text>
            <button class="retry-button" :loading="loading" :disabled="loading" @click="loadHome">重新加载</button>
          </view>

          <template v-else-if="homeData">
            <view class="section-head first-section">
              <view>
                <view class="section-title-line">
                  <text class="section-title">最近要处理的比赛</text>
                  <text class="section-count">{{ homeData.action_items.length }}</text>
                </view>
                <text class="section-note">按紧迫程度展示与你相关的比赛</text>
              </view>
              <button class="section-link" @click="showPlaceholder('比赛列表将在后续实现')">全部比赛</button>
            </view>

            <view v-if="primaryAction" class="action-stack">
              <ActionMatchCard :match="primaryAction" @open="openMatch" />
              <ActionMatchRow v-for="match in secondaryActions" :key="match.id" :match="match" @open="openMatch" />
            </view>
            <view v-else class="compact-empty">
              <view class="empty-check" aria-hidden="true">✓</view>
              <view>
                <text class="empty-title">暂时没有待处理比赛</text>
                <text class="empty-note">新的报名或比赛安排会优先出现在这里。</text>
              </view>
            </view>

            <view class="section-head ended-section">
              <view>
                <text class="section-title">已结束的比赛</text>
                <text class="section-note">最近完成的比赛记录</text>
              </view>
              <button
                v-if="homeData.ended_has_more"
                class="section-link"
                @click="showPlaceholder('更多比赛页面将在后续实现')"
              >
                查看更多
              </button>
            </view>

            <EndedMatchList v-if="endedMatches.length" :matches="endedMatches" @open="openMatch" />
            <view v-else class="compact-empty ended-empty">
              <view class="empty-ring" aria-hidden="true" />
              <view>
                <text class="empty-title">还没有已结束比赛</text>
                <text class="empty-note">完成比赛后，记录会保留在这里。</text>
              </view>
            </view>

            <view v-if="errorMessage" class="inline-error">
              <text>{{ errorMessage }}</text>
              <button :disabled="loading" @click="loadHome">重试</button>
            </view>
          </template>
        </template>
      </view>
    </view>

    <HomeBottomNav @activate="handleNavigation" />
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #e8ece7;
}

.desktop-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--canvas);
}

.page-content {
  padding: 0 32rpx calc(154rpx + env(safe-area-inset-bottom));
}

.login-state,
.error-state {
  margin-top: 32rpx;
  padding: 34rpx;
  border: 2rpx solid var(--line);
  border-radius: 20rpx;
  background: var(--surface);
}

.login-copy {
  display: flex;
  flex-direction: column;
}

.state-kicker {
  color: #718076;
  font-size: 20rpx;
  font-weight: 850;
}

.state-title {
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.25;
}

.state-kicker + .state-title {
  margin-top: 8rpx;
}

.state-note {
  margin-top: 12rpx;
  color: var(--muted);
  font-size: 24rpx;
  line-height: 1.55;
}

.primary-button,
.retry-button {
  display: flex;
  width: 100%;
  min-height: 96rpx;
  align-items: center;
  justify-content: center;
  margin-top: 28rpx;
  border-radius: 12rpx;
  background: var(--ink);
  color: #fff;
  font-size: 26rpx;
  font-weight: 850;
  line-height: 96rpx;
}

.account-strip {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 28rpx;
  padding: 0 2rpx 24rpx;
  border-bottom: 2rpx solid var(--line);
}

.avatar {
  display: flex;
  overflow: hidden;
  width: 64rpx;
  height: 64rpx;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 50%;
  background: var(--ink);
  color: var(--accent);
  font-size: 25rpx;
  font-weight: 900;
}

.avatar image {
  width: 100%;
  height: 100%;
}

.account-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.account-greeting {
  overflow: hidden;
  font-size: 26rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-note {
  margin-top: 4rpx;
  color: var(--muted);
  font-size: 20rpx;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
}

.first-section {
  margin-top: 30rpx;
}

.ended-section {
  margin-top: 46rpx;
}

.section-title-line {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.section-title {
  font-size: 35rpx;
  font-weight: 900;
  line-height: 1.25;
}

.section-count {
  display: flex;
  min-width: 34rpx;
  height: 34rpx;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 19rpx;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.section-note {
  display: block;
  margin-top: 7rpx;
  color: var(--muted);
  font-size: 21rpx;
  line-height: 1.4;
}

.section-link {
  display: flex;
  min-width: 132rpx;
  min-height: 96rpx;
  align-items: center;
  justify-content: flex-end;
  padding: 0 4rpx;
  background: transparent;
  color: var(--ink);
  font-size: 23rpx;
  font-weight: 850;
  line-height: 96rpx;
}

.action-stack {
  display: grid;
  gap: 16rpx;
  margin-top: 21rpx;
}

.compact-empty {
  display: flex;
  min-height: 146rpx;
  align-items: center;
  gap: 22rpx;
  margin-top: 21rpx;
  padding: 25rpx;
  border: 2rpx dashed #cfd6cf;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.55);
}

.empty-check,
.empty-ring {
  display: flex;
  width: 62rpx;
  height: 62rpx;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 50%;
  background: #e6f4c9;
  color: #365300;
  font-size: 30rpx;
  font-weight: 900;
}

.empty-ring {
  border: 6rpx solid #c8d0c9;
  background: transparent;
}

.empty-title,
.empty-note {
  display: block;
}

.empty-title {
  font-size: 25rpx;
  font-weight: 850;
}

.empty-note {
  margin-top: 7rpx;
  color: var(--muted);
  font-size: 21rpx;
  line-height: 1.45;
}

.ended-empty {
  margin-top: 20rpx;
}

.loading-state {
  display: grid;
  gap: 16rpx;
  margin-top: 32rpx;
}

.skeleton {
  border-radius: 12rpx;
  background: #e5eae4;
  animation: pulse 1.2s ease-in-out infinite alternate;
}

.skeleton-head { width: 58%; height: 44rpx; }
.skeleton-card { height: 390rpx; }
.skeleton-row { height: 108rpx; }
.skeleton-row.short { width: 88%; }

.error-state {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
}

.error-mark {
  display: flex;
  width: 60rpx;
  height: 60rpx;
  align-items: center;
  justify-content: center;
  margin-bottom: 18rpx;
  border-radius: 50%;
  background: #fce4e0;
  color: #a9332c;
  font-size: 30rpx;
  font-weight: 900;
}

.inline-error {
  display: flex;
  min-height: 72rpx;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 22rpx;
  padding: 14rpx 18rpx;
  border-left: 6rpx solid #c53b34;
  background: #fff0ed;
  color: #812b26;
  font-size: 21rpx;
}

.inline-error button {
  min-width: 96rpx;
  min-height: 96rpx;
  background: transparent;
  color: #812b26;
  font-size: 21rpx;
  font-weight: 850;
  line-height: 96rpx;
}

@keyframes pulse {
  from { opacity: 0.58; }
  to { opacity: 1; }
}

@media (min-width: 768px) {
  .page {
    padding: 28px 0;
  }

  .desktop-frame {
    max-width: 420px;
    min-height: calc(100vh - 56px);
    margin: 0 auto;
    overflow: hidden;
    border: 1px solid #d8ded7;
    box-shadow: 0 22px 64px rgba(19, 37, 26, 0.13);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}
</style>
