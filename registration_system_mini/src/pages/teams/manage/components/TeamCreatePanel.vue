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
  reviewMode: boolean;
  reviewTeamNameOptions: string[];
  canCreate: boolean;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "submit"): void;
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

:deep(.neo-button--block) {
  margin-top: 28rpx;
}
</style>
