<script setup lang="ts">
import { ref, watch } from "vue";
import type { BackendUser } from "@/types/backend";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import defaultAvatarUrl from "@/static/tab-png/user-active.png";

const props = defineProps<{
  currentUser: BackendUser | null;
  displayName: string;
  teamJoinedDaysLabel?: string;
}>();

const avatarLoadFailed = ref(false);

watch(() => props.currentUser?.avatar_url, () => {
  avatarLoadFailed.value = false;
});

const emit = defineEmits<{
  (event: "editProfile"): void;
  (event: "login"): void;
  (event: "logout"): void;
}>();
</script>

<template>
  <NeoSurface variant="dark" custom-class="mine-profile-hero">
    <view v-if="currentUser" class="mine-profile-hero__content">
      <view class="mine-profile-hero__identity">
        <view class="mine-profile-hero__avatar">
          <image
            v-if="currentUser.avatar_url && !avatarLoadFailed"
            class="mine-profile-hero__avatar-image"
            :src="currentUser.avatar_url"
            mode="aspectFill"
            @error="avatarLoadFailed = true"
          />
          <image v-else class="mine-profile-hero__avatar-default" :src="defaultAvatarUrl" mode="aspectFit" />
        </view>

        <view class="mine-profile-hero__copy">
          <text class="mine-profile-hero__name">{{ displayName }}</text>
          <text v-if="teamJoinedDaysLabel" class="mine-profile-hero__meta">
            加入球队 {{ teamJoinedDaysLabel }}
          </text>
        </view>
      </view>

      <view class="mine-profile-hero__actions">
        <NeoButton variant="lime" size="sm" @click="emit('editProfile')">编辑资料</NeoButton>
        <NeoButton variant="outline" size="sm" @click="emit('logout')">退出登录</NeoButton>
      </view>
    </view>

    <view v-else class="mine-profile-hero__content mine-profile-hero__content--guest">
      <view class="mine-profile-hero__identity">
        <view class="mine-profile-hero__avatar mine-profile-hero__avatar--guest">
          <image class="mine-profile-hero__avatar-default" :src="defaultAvatarUrl" mode="aspectFit" />
        </view>

        <view class="mine-profile-hero__copy">
          <text class="mine-profile-hero__eyebrow">PERSONAL HUB</text>
          <text class="mine-profile-hero__name">登录后开启你的比赛旅程</text>
          <view class="mine-profile-hero__guest-preview-list">
            <text class="mine-profile-hero__guest-preview">比赛记录</text>
            <text class="mine-profile-hero__guest-preview">球队身份</text>
            <text class="mine-profile-hero__guest-preview">钱包通知</text>
          </view>
        </view>
      </view>

      <view class="mine-profile-hero__actions">
        <NeoButton variant="lime" size="sm" @click="emit('login')">立即登录</NeoButton>
      </view>
    </view>
  </NeoSurface>
</template>

<style scoped>
.mine-profile-hero {
  display: flex;
  min-height: 264rpx;
  padding: 24rpx;
  border: 2rpx solid var(--neo-color-text);
  border-radius: 16rpx;
  box-shadow: 8rpx 8rpx 0 var(--neo-color-accent);
}

.mine-profile-hero__content {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  min-width: 0;
}

.mine-profile-hero__identity {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
  flex: 1;
}

.mine-profile-hero__avatar {
  display: flex;
  width: 112rpx;
  height: 112rpx;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2rpx solid var(--neo-color-text);
  border-radius: 16rpx;
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  flex-shrink: 0;
  box-sizing: border-box;
}

.mine-profile-hero__avatar--guest {
  background: var(--neo-color-surface);
}

.mine-profile-hero__avatar-image {
  width: 100%;
  height: 100%;
}

.mine-profile-hero__avatar-default {
  width: 66rpx;
  height: 66rpx;
}

.mine-profile-hero__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.mine-profile-hero__name {
  color: var(--neo-color-text-inverse);
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.22;
  word-break: break-word;
}

.mine-profile-hero__meta {
  display: inline-flex;
  width: fit-content;
  margin-top: 10rpx;
  padding: 4rpx 10rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.46);
  border-radius: 8rpx;
  color: var(--neo-color-text-inverse);
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.35;
}

.mine-profile-hero__eyebrow {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  min-height: 34rpx;
  padding: 2rpx 10rpx;
  border: 2rpx solid var(--neo-color-accent);
  border-radius: 8rpx;
  color: var(--neo-color-accent);
  font-size: 20rpx;
  font-weight: 900;
  line-height: 1.3;
  word-break: break-word;
  box-sizing: border-box;
}

.mine-profile-hero__eyebrow {
  margin-bottom: 8rpx;
}

.mine-profile-hero__guest-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 10rpx;
}

.mine-profile-hero__guest-preview {
  padding: 4rpx 8rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.26);
  border-radius: 8rpx;
  color: var(--neo-color-text-inverse);
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.3;
}

.mine-profile-hero__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12rpx;
  min-width: 136rpx;
}

@media (max-width: 560rpx) {
  .mine-profile-hero__content {
    align-items: flex-start;
    flex-direction: column;
  }

  .mine-profile-hero__actions {
    justify-content: flex-start;
  }
}
</style>
