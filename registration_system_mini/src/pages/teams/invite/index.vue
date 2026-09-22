<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import ProfileCompletionDialog from "@/components/ProfileCompletionDialog.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import { useTeamInvitePage } from "./useTeamInvitePage";

const { themePageStyle } = useAccentTheme();

const {
  pageStyle,
  team,
  resolving,
  errorMessage,
  joinPassword,
  requiresPassword,
  joining,
  joined,
  canSubmit,
  profileGateVisible,
  handleProfileGateCompleted,
  handleProfileGateCancel,
  handleJoin,
  goTeamDetail,
  goHome,
  resolveInvite,
} = useTeamInvitePage();
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope team-invite-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader title="球队邀请" showBack />

    <view class="team-invite-content">
      <view v-if="resolving" class="team-invite-state" @tap="resolveInvite">
        <text class="team-invite-state__text">正在打开邀请...</text>
      </view>

      <view v-else-if="errorMessage" class="team-invite-state" @tap="resolveInvite">
        <text class="team-invite-state__text">{{ errorMessage }}，点击重试</text>
        <AppButton class="team-invite-state__action" variant="outline" size="sm" @click="goHome">
          回到首页
        </AppButton>
      </view>

      <template v-else-if="team">
        <view class="team-invite-hero">
          <view class="team-invite-hero__row">
            <view class="team-invite-hero__badge">
              <image
                v-if="team.logo_url?.trim()"
                class="team-invite-hero__logo"
                :src="team.logo_url"
                mode="aspectFill"
              />
              <text v-else>{{ team.name.slice(0, 1) || "队" }}</text>
            </view>
            <view class="team-invite-hero__copy">
              <text class="team-invite-hero__eyebrow">球队邀请</text>
              <text class="team-invite-hero__name">{{ team.name }}</text>
            </view>
          </view>
          <text v-if="team.description" class="team-invite-hero__desc">{{ team.description }}</text>
        </view>

        <!-- 已是成员：不重复加入，引导去球队主页。 -->
        <AppSurface v-if="team.is_member || joined" variant="raised" custom-class="team-invite-card">
          <view class="team-invite-card__head">
            <text class="team-invite-card__title">{{ joined ? "加入成功" : "你已是球队成员" }}</text>
            <text class="team-invite-card__copy">
              {{ joined ? "快去球队主页看看吧。" : "无需重复加入，快去球队主页看看吧。" }}
            </text>
          </view>
          <AppButton block @click="goTeamDetail">进入球队主页</AppButton>
        </AppSurface>

        <AppSurface v-else variant="raised" custom-class="team-invite-card">
          <view class="team-invite-card__head">
            <text class="team-invite-card__title">申请加入</text>
            <text class="team-invite-card__copy">
              {{ requiresPassword
                ? "该球队设置了入队密码，输入密码即可加入。"
                : "加入后即可报名本球队的队内比赛。" }}
            </text>
          </view>
          <view v-if="requiresPassword" class="team-invite-field">
            <input
              v-model="joinPassword"
              class="team-invite-input"
              type="safe-password"
              password
              placeholder="输入入队密码"
              :disabled="joining"
            />
          </view>
          <AppButton block :loading="joining" :disabled="!canSubmit" @click="handleJoin">
            {{ joining ? "加入中..." : "加入球队" }}
          </AppButton>
        </AppSurface>
      </template>
    </view>

    <ProfileCompletionDialog
      :visible="profileGateVisible"
      @completed="handleProfileGateCompleted"
      @cancel="handleProfileGateCancel"
    />
  </view>
</template>

<style scoped>
.team-invite-page {
  min-height: 100vh;
  padding: 0 28rpx 112rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.team-invite-content {
  width: 100%;
  max-width: 900rpx;
  margin: 0 auto;
}

.team-invite-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  margin-top: 120rpx;
}

.team-invite-state__text {
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
  font-weight: 400;
}

.team-invite-hero {
  margin-top: 26rpx;
}

.team-invite-hero__row {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.team-invite-hero__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 96rpx;
  height: 96rpx;
  overflow: hidden;

  border: 0;
  border-radius: var(--ui-radius-button);

  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text);
  font-size: 40rpx;
  font-weight: 600;
  box-sizing: border-box;
}

.team-invite-hero__logo {
  width: 100%;
  height: 100%;
}

.team-invite-hero__copy {
  min-width: 0;
  flex: 1;
}

.team-invite-hero__eyebrow {
  display: block;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 400;
}

.team-invite-hero__name {
  display: block;
  margin-top: 4rpx;
  color: var(--ui-color-text);

  font-size: 32rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.25;
  word-break: break-word;
}

.team-invite-hero__desc {
  display: block;
  margin-top: 16rpx;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  line-height: 1.6;
  font-weight: 400;
}

:deep(.team-invite-card) {
  margin-top: 26rpx;
  padding: 28rpx;
}

.team-invite-card__head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 20rpx;
}

.team-invite-card__title {
  color: var(--ui-color-text);
  font-size: 32rpx;
  font-weight: var(--ui-font-weight-heading);
}

.team-invite-card__copy {
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 400;
}

.team-invite-field {
  margin-bottom: 20rpx;
}

.team-invite-input {
  box-sizing: border-box;
  width: 100%;
  height: 92rpx;
  padding: 0 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-page);
  font-size: 28rpx;
  color: var(--ui-color-text);
}
</style>
