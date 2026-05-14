<script setup lang="ts">
defineProps<{
  canSubmitActivityReview: boolean;
  reviewSubmitted: boolean;
  reviewForm: {
    rating: number;
    comment: string;
  };
  submittingStatus: boolean;
}>();

defineEmits<{
  reviewRatingChange: [value: Event];
  submitActivityReview: [];
}>();
</script>

<template>
  <view class="registration-card review-card">
    <view class="countdown-head">
      <view>
        <text class="section-title">赛后互评</text>
        <text class="checkin-copy">
          {{ reviewSubmitted ? "本场互评已提交。" : canSubmitActivityReview ? "给对手球队评分，信用分会同步更新。" : "比赛结束后由队长或领队提交。" }}
        </text>
      </view>
    </view>
    <picker :range="['1 分', '2 分', '3 分', '4 分', '5 分']" :value="reviewForm.rating - 1" @change="$emit('reviewRatingChange', $event)">
      <view class="checkin-input review-rating">评分 · {{ reviewForm.rating }} 分</view>
    </picker>
    <textarea v-model="reviewForm.comment" class="review-textarea" maxlength="120" placeholder="可选，记录对方到场、沟通和比赛体验" />
    <view :class="['checkin-button', !canSubmitActivityReview ? 'checkin-button-disabled' : '']" @tap="$emit('submitActivityReview')">
      {{ reviewSubmitted ? "已提交互评" : submittingStatus ? "提交中..." : "提交赛后互评" }}
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

.review-card {
  margin-top: 24rpx;
  padding: 26rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 36rpx rgba(10, 10, 10, 0.05);
}

.countdown-head {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.section-title {
  display: block;
  color: #171717;
  font-size: 38rpx;
  line-height: 1.25;
  font-weight: 900;
}

.checkin-input,
.review-textarea {
  width: 100%;
  border-radius: 24rpx;
  border: 2rpx solid #d7ddd2;
  background: #f4f6f0;
  color: #111310;
  font-size: 28rpx;
  font-weight: 800;
  box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.74);
  box-sizing: border-box;
}

.checkin-input {
  min-height: 88rpx;
  padding: 0 22rpx;
  display: flex;
  align-items: center;
}

.review-rating {
  margin-top: 18rpx;
}

.review-textarea {
  min-height: 132rpx;
  margin-top: 14rpx;
  padding: 18rpx;
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

.checkin-button-disabled {
  opacity: 0.5;
}
</style>
