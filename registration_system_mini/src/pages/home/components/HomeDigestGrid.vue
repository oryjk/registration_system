<script setup lang="ts">
defineProps<{
  digest: {
    attendanceRate: string;
    attended: number;
    leave: number;
    late: number;
  };
}>();
</script>

<template>
  <view class="digest-grid">
    <view class="digest-card">
      <text class="digest-value">{{ digest.attendanceRate }}</text>
      <text class="digest-label">出勤率</text>
    </view>
    <view class="digest-card">
      <text class="digest-value">{{ digest.attended }}</text>
      <text class="digest-label">参加</text>
    </view>
    <view class="digest-card">
      <text class="digest-value">{{ digest.leave }}</text>
      <text class="digest-label">请假</text>
    </view>
    <view class="digest-card">
      <text class="digest-value">{{ digest.late }}</text>
      <text class="digest-label">缺席</text>
    </view>
  </view>
</template>

<style scoped>
.digest-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
}

.digest-card {
  padding: 26rpx 18rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 36rpx rgba(17, 17, 17, 0.05);
}

.digest-value {
  display: block;
  font-size: 48rpx;
  color: #111111;
  font-weight: 900;
}

.digest-label {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #666b63;
  font-weight: 700;
}
</style>
