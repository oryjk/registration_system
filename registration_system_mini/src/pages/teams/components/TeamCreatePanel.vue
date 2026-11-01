<script setup lang="ts">
import TeamLogoField from "./TeamLogoField.vue";
import AppButton from "@/components/ui/AppButton.vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import AppSurface from "@/components/ui/AppSurface.vue";

defineProps<{
  form: {
    name: string;
    description: string;
    joinPassword: string;
  };
  /** 可选 Logo 的本地临时路径（预览用，提交时由页面层上传）。 */
  logoLocalPath: string;
  reviewMode: boolean;
  reviewTeamNameOptions: string[];
  canCreate: boolean;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "submit"): void;
  (event: "pickLogo"): void;
  (event: "removeLogo"): void;
}>();

function handleSubmit() {
  emit("submit");
}
</script>

<template>
  <AppSurface custom-class="form-card">
    <SectionHeader title="球队资料" />
    <view class="form-field">
      <text class="form-label">球队名称</text>
      <picker v-if="reviewMode" :range="reviewTeamNameOptions" :value="Math.max(reviewTeamNameOptions.indexOf(form.name), 0)" @change="form.name = reviewTeamNameOptions[Number($event.detail.value)] || reviewTeamNameOptions[0] || ''">
        <view class="form-input form-picker">{{ form.name || "请选择球队名称" }}</view>
      </picker>
      <input v-else v-model="form.name" class="form-input" placeholder="例如：周末野球 FC" />
    </view>
    <view v-if="!reviewMode" class="form-field">
      <text class="form-label">球队 Logo（可选）</text>
      <TeamLogoField :src="logoLocalPath" :name="form.name" hint="jpg/png/webp，1MB 以内；创建球队时随表单一起上传。" :action-label="logoLocalPath ? '重新选择' : '选择 Logo'" :disabled="submitting" removable @pick="emit('pickLogo')" @remove="emit('removeLogo')" />
    </view>
    <view v-if="!reviewMode" class="form-field">
      <text class="form-label">球队介绍</text>
      <textarea v-model="form.description" class="form-textarea" placeholder="一句话说明球队风格、城市或比赛时间" />
    </view>
    <view class="form-field">
      <text class="form-label">入队密码</text>
      <input v-model="form.joinPassword" class="form-input" placeholder="可选，留空则无需密码" password />
    </view>
    <!-- #ifdef MP-WEIXIN -->
    <view class="team-create-submit">
    <!-- #endif -->
      <AppButton icon="plus" block :disabled="!canCreate" :loading="submitting" @click="handleSubmit">
        {{ submitting ? "创建中..." : "创建球队" }}
      </AppButton>
    <!-- #ifdef MP-WEIXIN -->
    </view>
    <!-- #endif -->
  </AppSurface>
</template>

<style scoped>
@import "@/styles/form-controls.css";
.form-card {
  padding: 6rpx 24rpx 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  box-shadow: var(--ui-shadow-card);
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

.form-picker {
  display: flex;
  align-items: center;
}

/* #ifndef MP-WEIXIN */
:deep(.ui-button--block) {
  margin-top: 28rpx;
}
/* #endif */

/* #ifdef MP-WEIXIN */
/* 间距由当前组件的 view 承担，不跨过 AppButton 的小程序样式隔离边界。 */
.team-create-submit { padding-top: 32rpx; }
/* #endif */

/* #ifdef MP-WEIXIN */
/* 微信端复用统一排版尺度；H5 保留原有样式。 */
.form-field { margin-top: var(--ui-space-6); }
.form-label { margin-bottom: var(--ui-space-2); font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-heading); }
.team-create-submit { padding-top: var(--ui-section-gap); }
/* #endif */
</style>
