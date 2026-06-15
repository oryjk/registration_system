<script setup lang="ts">
import type { TeamProfileViewModel } from "@/types/viewModels";

defineProps<{
  currentTeam: TeamProfileViewModel | null;
  canManageMembers: boolean;
  form: {
    name: string;
    description: string;
    logoUrl: string;
  };
  logoUploading: boolean;
  canUpdate: boolean;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "chooseLogo"): void;
  (event: "submit"): void;
}>();

function handleChooseLogo() {
  emit("chooseLogo");
}

function handleSubmit() {
  emit("submit");
}
</script>

<template>
  <view class="form-card">
    <text class="form-title">当前球队资料</text>
    <view v-if="!currentTeam" class="empty-box">请先创建或加入球队。</view>
    <view v-else-if="!canManageMembers" class="empty-box">只有队长或领队可以修改球队资料。</view>
    <view v-else>
      <view class="form-field">
        <text class="form-label">球队名称</text>
        <input v-model="form.name" class="form-input" placeholder="输入球队名称" />
      </view>
      <view class="form-field">
        <text class="form-label">球队 Logo</text>
        <view class="team-logo-field">
          <view class="team-logo-preview">
            <image v-if="form.logoUrl" class="team-logo-image" :src="form.logoUrl" mode="aspectFill" />
            <text v-else class="team-logo-fallback">{{ currentTeam?.name?.slice(0, 1) || "队" }}</text>
          </view>
          <view class="team-logo-main">
            <view class="team-logo-button" @tap="handleChooseLogo">
              {{ logoUploading ? "上传中..." : "选择图片上传" }}
            </view>
            <text class="team-logo-note">支持 jpg/png/webp，超过 1MB 会先尝试压缩。</text>
          </view>
        </view>
      </view>
      <view class="form-field">
        <text class="form-label">球队介绍</text>
        <textarea v-model="form.description" class="form-textarea" placeholder="球队风格、城市或比赛时间" />
      </view>
      <view :class="['primary-button', canUpdate ? '' : 'primary-button-disabled']" @tap="handleSubmit">
        {{ submitting ? "保存中..." : "保存球队资料" }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.form-card {
  padding: 30rpx;
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 36rpx rgba(16, 17, 15, 0.06);
}

.form-title {
  display: block;
  margin-bottom: 24rpx;
  color: #10110f;
  font-size: 34rpx;
  font-weight: 900;
}

.form-field {
  margin-top: 20rpx;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: #6a7165;
  font-size: 24rpx;
  font-weight: 700;
}

.form-input,
.form-textarea {
  width: 100%;
  border-radius: 22rpx;
  background: #f3f5ef;
  color: #111310;
  font-size: 28rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.form-input {
  height: 86rpx;
  padding: 0 22rpx;
}

.form-textarea {
  min-height: 150rpx;
  padding: 22rpx;
}

.primary-button {
  height: 88rpx;
  margin-top: 28rpx;
  border-radius: 24rpx;
  background: #c8ff00;
  color: #10110f;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 900;
}

.primary-button-disabled {
  opacity: 0.45;
}

.empty-box {
  margin-top: 22rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f3f5ef;
  color: #6b7166;
  font-size: 26rpx;
  font-weight: 700;
}

.team-logo-field {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  background: #f3f5ef;
}

.team-logo-preview {
  width: 104rpx;
  height: 104rpx;
  border-radius: 28rpx;
  flex-shrink: 0;
  overflow: hidden;
  background: #10110f;
}

.team-logo-image,
.team-logo-fallback {
  width: 100%;
  height: 100%;
}

.team-logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c8ff00;
  font-size: 38rpx;
  font-weight: 900;
}

.team-logo-main {
  flex: 1;
  min-width: 0;
}

.team-logo-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 190rpx;
  height: 66rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #10110f;
  color: #c8ff00;
  font-size: 24rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.team-logo-note {
  display: block;
  margin-top: 10rpx;
  color: #6a7165;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.35;
}
</style>
