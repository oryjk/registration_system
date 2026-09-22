<script setup lang="ts">
import TeamLogoField from "../../components/TeamLogoField.vue";
import AppButton from "@/components/ui/AppButton.vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import type { TeamProfileViewModel } from "@/types/viewModels";

defineProps<{
  currentTeam: TeamProfileViewModel | null;
  canManageMembers: boolean;
  form: {
    name: string;
    description: string;
    logoUrl: string;
  };
  canUpdate: boolean;
  submitting: boolean;
  uploadingLogo: boolean;
}>();

const emit = defineEmits<{
  (event: "submit"): void;
  (event: "uploadLogo"): void;
}>();

function handleSubmit() {
  emit("submit");
}
</script>

<template>
  <AppSurface custom-class="form-card">
    <SectionHeader title="当前球队资料" caption="更新球队在报名和成员列表中的公开信息" />
    <view v-if="!currentTeam" class="empty-box">请先创建或加入球队。</view>
    <view v-else-if="!canManageMembers" class="empty-box">只有队长或领队可以修改球队资料。</view>
    <view v-else>
      <view class="form-field">
        <text class="form-label">球队名称</text>
        <input v-model="form.name" class="form-input" placeholder="输入球队名称" />
      </view>
      <view class="form-field">
        <text class="form-label">球队 Logo</text>
        <TeamLogoField :src="form.logoUrl" :name="currentTeam?.name || ''" hint="jpg/png/webp，1MB 以内；上传后立即生效。" action-label="上传 Logo" :loading="uploadingLogo" :disabled="submitting" @pick="emit('uploadLogo')" />
      </view>
      <view class="form-field">
        <text class="form-label">球队介绍</text>
        <textarea v-model="form.description" class="form-textarea" placeholder="球队风格、城市或比赛时间" />
      </view>
      <AppButton icon="check" block :disabled="!canUpdate" :loading="submitting" @click="handleSubmit">
        {{ submitting ? "保存中..." : "保存球队资料" }}
      </AppButton>
    </view>
  </AppSurface>
</template>

<style scoped>
@import "@/styles/form-controls.css";
.form-card {
  padding: 6rpx 24rpx 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  box-shadow: none;
}

.form-field {
  margin-top: 26rpx;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 600;
}

.empty-box {
  margin-top: 26rpx;
  padding: 20rpx 0;
  border: none;
  border-radius: var(--ui-radius-button);
  background: transparent;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
}

:deep(.ui-button--block) {
  margin-top: 28rpx;
}

</style>
