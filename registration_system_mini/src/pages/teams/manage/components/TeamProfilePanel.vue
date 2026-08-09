<script setup lang="ts">
import { NeoButton, NeoSectionHeader, NeoSurface } from "@/components/neo";
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
  <NeoSurface custom-class="form-card">
    <NeoSectionHeader title="当前球队资料" marker="01" caption="更新球队在报名和成员列表中的公开信息" />
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
            <NeoButton variant="outline" size="sm" :loading="logoUploading" @click="handleChooseLogo">
              {{ logoUploading ? "上传中..." : "选择图片上传" }}
            </NeoButton>
            <text class="team-logo-note">支持 jpg/png/webp，超过 1MB 会先尝试压缩。</text>
          </view>
        </view>
      </view>
      <view class="form-field">
        <text class="form-label">球队介绍</text>
        <textarea v-model="form.description" class="form-textarea" placeholder="球队风格、城市或比赛时间" />
      </view>
      <NeoButton block :disabled="!canUpdate" :loading="submitting" @click="handleSubmit">
        {{ submitting ? "保存中..." : "保存球队资料" }}
      </NeoButton>
    </view>
  </NeoSurface>
</template>

<style scoped>
.form-card {
  padding: 6rpx 24rpx 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-text);
}

.form-field {
  margin-top: 26rpx;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
}

.form-input,
.form-textarea {
  width: 100%;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.form-input {
  height: 84rpx;
  padding: 0 20rpx;
}

.form-textarea {
  min-height: 150rpx;
  padding: 20rpx;
}

.empty-box {
  margin-top: 26rpx;
  padding: 22rpx 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-warning-soft);
  color: var(--neo-color-text-muted);
  font-size: 26rpx;
  font-weight: 700;
}

:deep(.neo-button--block) {
  margin-top: 28rpx;
}

.team-logo-field {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-info-soft);
}

.team-logo-preview {
  width: 104rpx;
  height: 104rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  flex-shrink: 0;
  overflow: hidden;
  background: var(--neo-color-text);
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
  color: var(--neo-color-accent);
  font-size: 38rpx;
  font-weight: 900;
}

.team-logo-main {
  flex: 1;
  min-width: 0;
}

.team-logo-note {
  display: block;
  margin-top: 10rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.35;
}
</style>
