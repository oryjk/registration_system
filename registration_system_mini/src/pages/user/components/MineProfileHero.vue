<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { BackendUser } from "@/types/backend";
import AppButton from "@/components/ui/AppButton.vue";
import { needsProfileCompletion } from "@/utils/profileCompletion";

const props = defineProps<{
  currentUser: BackendUser | null;
  displayName: string;
  teamJoinedDaysLabel?: string;
}>();

const avatarLoadFailed = ref(false);

watch(() => props.currentUser?.avatar_url, () => {
  avatarLoadFailed.value = false;
});

const showProfileCompletionHint = computed(() => needsProfileCompletion(props.currentUser));

const emit = defineEmits<{
  (event: "editProfile"): void;
  (event: "completeProfile"): void;
  (event: "login"): void;
  (event: "logout"): void;
}>();
</script>

<template>
  <view class="mine-profile-hero">
    <view class="profile-row">
      <view class="profile-avatar">
        <image v-if="currentUser?.avatar_url && !avatarLoadFailed" :src="currentUser.avatar_url" mode="aspectFill" @error="avatarLoadFailed = true" />
        <wd-icon v-else name="user" size="48rpx" color="var(--ui-color-text-muted)" />
      </view>
      <view class="profile-copy">
        <text class="profile-name">{{ currentUser ? displayName : '欢迎来到约球开踢' }}</text>
        <text class="profile-meta">{{ currentUser ? (teamJoinedDaysLabel ? '加入球队 ' + teamJoinedDaysLabel : '记录每一次上场') : '登录后查看比赛与球队' }}</text>
      </view>
      <button v-if="currentUser" class="profile-edit" @tap="emit('editProfile')" aria-label="编辑资料">
        <wd-icon name="edit" size="28rpx" /><text>编辑</text>
      </button>
      <AppButton v-else size="sm" @click="emit('login')">登录</AppButton>
    </view>
    <button v-if="currentUser && showProfileCompletionHint" class="profile-complete" @tap="emit('completeProfile')">
      <text>完善头像和昵称</text><wd-icon name="arrow-right" size="24rpx" />
    </button>
  </view>
</template>
<style scoped>

.mine-profile-hero { padding: 28rpx; border: var(--ui-border-default); border-radius: var(--ui-radius-card); background: var(--ui-color-surface); }
.profile-row { display:flex; align-items:center; gap:20rpx; }
.profile-avatar { width:100rpx; height:100rpx; flex-shrink:0; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:var(--ui-color-neutral-bg); }
.profile-avatar image { width:100%; height:100%; }
.profile-copy { flex:1; min-width:0; }
.profile-name { display:block; color:var(--ui-color-text); font-size:34rpx; font-weight:600; overflow-wrap:anywhere; }
.profile-meta { display:block; margin-top:10rpx; color:var(--ui-color-text-muted); font-size:22rpx; line-height:1.5; }
.profile-edit { display:flex; align-items:center; gap:6rpx; padding:12rpx 16rpx; margin:0; background:var(--ui-color-accent-soft); color:var(--ui-color-accent-deep); border:0; border-radius:var(--ui-radius-round); font-size:22rpx; line-height:1.4; flex-shrink:0; }
.profile-edit::after,.profile-complete::after { border:0; }
.profile-complete { margin:20rpx 0 0; padding:16rpx 0 0; display:flex; align-items:center; justify-content:space-between; border:0; border-top:var(--ui-border-default); border-radius:0; background:transparent; color:var(--ui-color-accent-deep); font-size:24rpx; line-height:1.5; }

</style>
