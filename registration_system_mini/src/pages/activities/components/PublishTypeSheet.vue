<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "publishTeam"): void;
  (event: "publishIndividual"): void;
}>();

function handleClose() {
  emit("close");
}

function handlePublishTeam() {
  emit("publishTeam");
}

function handlePublishIndividual() {
  emit("publishIndividual");
}
</script>

<template>
  <view v-if="visible" class="publish-sheet-overlay" @tap="handleClose">
    <view class="publish-sheet" @tap.stop>
      <view class="publish-sheet-header">
        <view class="publish-sheet-title">发布约队</view>
        <view class="publish-sheet-close" @tap="handleClose">×</view>
      </view>

      <view class="publish-sheet-options">
        <view class="publish-sheet-option" @tap="handlePublishTeam">
          <view class="publish-sheet-option-mark">赛</view>
          <view class="publish-sheet-option-copy">
            <view class="publish-sheet-option-title">球队约队</view>
            <view class="publish-sheet-option-text">用当前身份发布球队约队</view>
          </view>
        </view>

        <view class="publish-sheet-option" @tap="handlePublishIndividual">
          <view class="publish-sheet-option-mark publish-sheet-option-mark-light">人</view>
          <view class="publish-sheet-option-copy">
            <view class="publish-sheet-option-title">散人约队</view>
            <view class="publish-sheet-option-text">创建面向球员个人报名的约队</view>
          </view>
        </view>
      </view>

      <view class="publish-sheet-cancel" @tap="handleClose">取消</view>
    </view>
  </view>
</template>

<style scoped>
.publish-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(17, 19, 16, 0.62);
}

.publish-sheet {
  width: calc(100% - 48rpx);
  margin: 0 24rpx calc(env(safe-area-inset-bottom) + 22rpx);
  padding: 38rpx 44rpx 40rpx;
  border-radius: 32rpx;
  background: #ffffff;
  box-sizing: border-box;
  box-shadow: 0 -18rpx 54rpx rgba(17, 19, 16, 0.14);
}

.publish-sheet-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52rpx;
}

.publish-sheet-title {
  color: #111310;
  font-size: 32rpx;
  font-weight: 900;
  line-height: 1.3;
}

.publish-sheet-close {
  position: absolute;
  right: -12rpx;
  top: 50%;
  width: 56rpx;
  height: 56rpx;
  margin-top: -28rpx;
  color: #5f625b;
  font-size: 44rpx;
  line-height: 52rpx;
  text-align: center;
}

.publish-sheet-options {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 48rpx;
}

.publish-sheet-option {
  display: flex;
  align-items: center;
  gap: 22rpx;
  min-height: 112rpx;
  padding: 20rpx 22rpx;
  border-radius: 28rpx;
  background: #f7f8f4;
  box-sizing: border-box;
}

.publish-sheet-option:active {
  background: #eef1e8;
}

.publish-sheet-option-mark {
  flex: 0 0 64rpx;
  width: 64rpx;
  height: 64rpx;
  border-radius: 22rpx;
  background: #c8ff00;
  color: #111310;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 64rpx;
  text-align: center;
}

.publish-sheet-option-mark-light {
  background: #111310;
  color: #ffffff;
}

.publish-sheet-option-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.publish-sheet-option-title {
  flex: 0 0 auto;
  color: #111310;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.35;
}

.publish-sheet-option-text {
  flex: 1;
  min-width: 0;
  color: #747970;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.45;
}

.publish-sheet-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 82rpx;
  margin-top: 34rpx;
  border-radius: 999rpx;
  background: #eef0ed;
  color: #111310;
  font-size: 30rpx;
  font-weight: 900;
}
</style>
