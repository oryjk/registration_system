<script setup lang="ts">
defineProps<{
  checkInForm: {
    enabled: boolean;
    radiusMeters: number;
    openMinutesBefore: number;
    closeMinutesAfter: number;
  };
  submittingStatus: boolean;
}>();

defineEmits<{
  checkInSwitchChange: [value: Event];
  saveCheckInConfig: [];
}>();
</script>

<template>
  <view class="registration-card checkin-settings-card">
    <view class="checkin-settings-head">
      <view>
        <text class="section-title">签到设置</text>
        <text class="checkin-copy">可开启定位签到，保存后队员可在比赛详情页签到。</text>
      </view>
      <switch :checked="checkInForm.enabled" color="#c8ff00" @change="$emit('checkInSwitchChange', $event)" />
    </view>
    <view v-if="checkInForm.enabled" class="checkin-config-grid">
      <view class="checkin-config-item">
        <text class="checkin-form-label">签到半径</text>
        <input v-model="checkInForm.radiusMeters" class="checkin-input" type="number" placeholder="200" />
      </view>
      <view class="checkin-config-item">
        <text class="checkin-form-label">提前开放</text>
        <input v-model="checkInForm.openMinutesBefore" class="checkin-input" type="number" placeholder="60" />
      </view>
      <view class="checkin-config-item">
        <text class="checkin-form-label">赛后关闭</text>
        <input v-model="checkInForm.closeMinutesAfter" class="checkin-input" type="number" placeholder="45" />
      </view>
      <view class="checkin-config-item">
        <text class="checkin-form-label">说明</text>
        <view class="checkin-input checkin-input-static">单位都是分钟 / 米</view>
      </view>
    </view>
    <view v-else class="checkin-disabled-note">本场不启用到场定位签到。</view>
    <view class="checkin-button checkin-settings-button" @tap="$emit('saveCheckInConfig')">
      {{ submittingStatus ? "保存中..." : "保存签到设置" }}
    </view>
  </view>
</template>

<style scoped>
.registration-card {
  position: relative;
  overflow: hidden;
  border-radius: 28rpx;
  box-sizing: border-box;
}

.checkin-settings-card {
  margin-top: 24rpx;
  padding: 26rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 36rpx rgba(10, 10, 10, 0.05);
}

.section-title {
  display: block;
  color: #171717;
  font-size: 38rpx;
  line-height: 1.25;
  font-weight: 900;
}

.checkin-settings-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.checkin-config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
}

.checkin-config-item {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-width: 0;
}

.checkin-form-label {
  color: #111310;
  font-size: 22rpx;
  line-height: 1.35;
  font-weight: 700;
}

.checkin-input {
  width: 100%;
  min-height: 88rpx;
  padding: 0 22rpx;
  display: flex;
  align-items: center;
  border-radius: 24rpx;
  border: 2rpx solid #d7ddd2;
  background: #f4f6f0;
  color: #111310;
  font-size: 28rpx;
  font-weight: 800;
  box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.74);
  box-sizing: border-box;
}

.checkin-input-static {
  color: #60655d;
}

.checkin-disabled-note {
  margin-top: 20rpx;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: #f4f6f0;
  color: #5f645c;
  font-size: 26rpx;
  line-height: 1.6;
  font-weight: 700;
}

.checkin-settings-button {
  width: 100%;
  margin-top: 20rpx;
}

.checkin-copy {
  display: block;
  margin-top: 8rpx;
  color: #747972;
  font-size: 24rpx;
  font-weight: 700;
}

.checkin-button {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 168rpx;
  height: 72rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #10110f;
  font-size: 26rpx;
  font-weight: 900;
}
</style>
