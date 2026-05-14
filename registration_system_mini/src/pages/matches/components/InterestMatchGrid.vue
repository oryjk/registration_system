<script setup lang="ts">
defineProps<{
  interestCards: Array<{
    id: string;
    title: string;
    dateLine: string;
    venue: string;
  }>;
}>();

defineEmits<{
  openMatchDetail: [matchId: string];
}>();
</script>

<template>
  <view class="interest-block">
    <view class="interest-head">
      <text class="section-title">你可能感兴趣</text>
      <text class="interest-more">更多 ›</text>
    </view>

    <view class="interest-grid">
      <view
        v-for="item in interestCards"
        :key="item.id"
        class="interest-card"
        @tap="$emit('openMatchDetail', item.id)"
      >
        <text class="interest-card-tag">报名中</text>
        <text class="interest-card-title">{{ item.title }}</text>
        <text class="interest-card-meta">{{ item.dateLine }}</text>
        <text class="interest-card-meta">{{ item.venue }}</text>
      </view>
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

.interest-block {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.interest-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.interest-more {
  color: #444444;
  font-size: 28rpx;
  font-weight: 700;
}

.interest-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.interest-card {
  position: relative;
  min-height: 172rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background:
    linear-gradient(160deg, rgba(18, 18, 18, 0.94) 0%, rgba(33, 33, 33, 0.95) 100%),
    #1a1a1a;
  overflow: hidden;
  box-sizing: border-box;
}

.interest-card::before {
  content: "";
  position: absolute;
  right: -14rpx;
  top: 18rpx;
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(217, 255, 22, 0.18) 0%, transparent 74%);
}

.interest-card-tag {
  display: inline-flex;
  align-self: flex-start;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #d9ff16;
  color: #181818;
  font-size: 22rpx;
  font-weight: 900;
}

.interest-card-title {
  display: block;
  margin-top: 20rpx;
  color: #ffffff;
  font-size: 36rpx;
  line-height: 1.18;
  font-weight: 900;
}

.interest-card-meta {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.76);
  font-size: 24rpx;
  line-height: 1.4;
}
</style>
