<script setup lang="ts">
defineProps<{
  hasCheckedIn: boolean;
  submittingStatus: boolean;
}>();

defineEmits<{
  checkIn: [];
}>();
</script>

<template>
  <view class="checkin-card">
    <view>
      <text class="section-title section-title-inverse">现场签到</text>
      <text class="checkin-copy">
        {{ hasCheckedIn ? "你已完成本场签到。" : "到达球场后使用当前位置完成签到。" }}
      </text>
    </view>
    <view :class="['checkin-button', hasCheckedIn ? 'checkin-button-disabled' : '']" @tap="$emit('checkIn')">
      {{ submittingStatus ? "提交中..." : hasCheckedIn ? "已签到" : "立即签到" }}
    </view>
  </view>
</template>

<style scoped>
.section-title {
  display: block;
  color: #171717;
  font-size: 38rpx;
  line-height: 1.25;
  font-weight: 900;
}

.section-title-inverse {
  color: #ffffff;
}

.checkin-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 24rpx;
  padding: 26rpx;
  border-radius: 28rpx;
  background: #10110f;
  box-shadow: 0 18rpx 30rpx rgba(16, 17, 15, 0.12);
}

.checkin-copy {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.72);
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
  background: var(--neo-color-accent);
  color: #10110f;
  font-size: 26rpx;
  font-weight: 900;
}

.checkin-button-disabled {
  opacity: 0.5;
}
</style>
