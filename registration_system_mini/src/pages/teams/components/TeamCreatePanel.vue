<script setup lang="ts">
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";

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
  <NeoSurface custom-class="form-card">
    <NeoSectionHeader title="新球队资料" marker="01" caption="创建后你会成为球队队长，并可以继续邀请队员" />
    <view class="form-field">
      <text class="form-label">球队名称</text>
      <picker v-if="reviewMode" :range="reviewTeamNameOptions" :value="Math.max(reviewTeamNameOptions.indexOf(form.name), 0)" @change="form.name = reviewTeamNameOptions[Number($event.detail.value)] || reviewTeamNameOptions[0] || ''">
        <view class="form-input form-picker">{{ form.name || "请选择球队名称" }}</view>
      </picker>
      <input v-else v-model="form.name" class="form-input" placeholder="例如：周末野球 FC" />
    </view>
    <view v-if="!reviewMode" class="form-field">
      <text class="form-label">球队 Logo（可选）</text>
      <view class="team-logo-field">
        <view class="team-logo-preview">
          <image v-if="logoLocalPath" class="team-logo-image" :src="logoLocalPath" mode="aspectFill" />
          <text v-else class="team-logo-fallback">{{ form.name?.trim()?.slice(0, 1) || "队" }}</text>
        </view>
        <view class="team-logo-main">
          <text class="team-logo-note">jpg/png/webp，1MB 以内；创建球队时随表单一起上传。</text>
          <view class="team-logo-actions">
            <NeoButton size="sm" variant="outline" :disabled="submitting" @click="emit('pickLogo')">
              {{ logoLocalPath ? "重新选择" : "选择 Logo" }}
            </NeoButton>
            <NeoButton v-if="logoLocalPath" size="sm" variant="outline" :disabled="submitting" @click="emit('removeLogo')">
              移除
            </NeoButton>
          </view>
        </view>
      </view>
    </view>
    <view v-if="!reviewMode" class="form-field">
      <text class="form-label">球队介绍</text>
      <textarea v-model="form.description" class="form-textarea" placeholder="一句话说明球队风格、城市或比赛时间" />
    </view>
    <view class="form-field">
      <text class="form-label">入队密码</text>
      <input v-model="form.joinPassword" class="form-input" placeholder="可选，留空则无需密码" password />
    </view>
    <NeoButton block :disabled="!canCreate" :loading="submitting" @click="handleSubmit">
      {{ submitting ? "创建中..." : "创建球队" }}
    </NeoButton>
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

.form-picker {
  display: flex;
  align-items: center;
}

.form-input {
  height: 84rpx;
  padding: 0 20rpx;
}

.form-textarea {
  min-height: 150rpx;
  padding: 20rpx;
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

/* 两个操作按钮并排，各占内容宽（mp-weixin flex 行内子组件宿主按内容收缩，此处为期望行为） */
.team-logo-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 14rpx;
  margin-top: 12rpx;
}

:deep(.neo-button--block) {
  margin-top: 28rpx;
}
</style>
