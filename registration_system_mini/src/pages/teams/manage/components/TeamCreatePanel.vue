<script setup lang="ts">
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
  <view class="form-card">
    <text class="form-title">新球队资料</text>
    <view class="form-field">
      <text class="form-label">球队名称</text>
      <picker v-if="reviewMode" :range="reviewTeamNameOptions" :value="Math.max(reviewTeamNameOptions.indexOf(form.name), 0)" @change="form.name = reviewTeamNameOptions[Number($event.detail.value)] || reviewTeamNameOptions[0] || ''">
        <view class="form-input form-picker">{{ form.name || "请选择球队名称" }}</view>
      </picker>
      <input v-else v-model="form.name" class="form-input" placeholder="例如：周末野球 FC" />
    </view>
    <view v-if="!reviewMode" class="form-field">
      <text class="form-label">球队介绍</text>
      <textarea v-model="form.description" class="form-textarea" placeholder="一句话说明球队风格、城市或活动时间" />
    </view>
    <view class="form-field">
      <text class="form-label">入队密码</text>
      <input v-model="form.joinPassword" class="form-input" placeholder="可选，留空则无需密码" password />
    </view>
    <view :class="['primary-button', canCreate ? '' : 'primary-button-disabled']" @tap="handleSubmit">
      {{ submitting ? "创建中..." : "创建球队" }}
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

.form-picker {
  display: flex;
  align-items: center;
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
</style>
