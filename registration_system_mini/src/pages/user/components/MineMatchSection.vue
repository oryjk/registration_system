<script setup lang="ts">
export interface MineMatchSummary {
  id: string;
  title: string;
  dateLabel: string;
  venue: string;
  myStatus: string;
}

defineProps<{
  matches: MineMatchSummary[];
  statusClass: (status: string) => string;
}>();

const emit = defineEmits<{
  (event: "openAll"): void;
  (event: "openMatch", matchId: string): void;
}>();

function handleOpenAll() {
  emit("openAll");
}

function handleOpenMatch(matchId: string) {
  emit("openMatch", matchId);
}
</script>

<template>
  <view class="section-card">
    <view class="section-row">
      <view class="section-row-title">我的比赛</view>
      <view class="section-row-link" @tap="handleOpenAll">全部比赛</view>
    </view>
    <view v-if="matches.length">
      <view
        v-for="match in matches"
        :key="match.id"
        class="compact-record-card"
        @tap="handleOpenMatch(match.id)"
      >
        <view class="compact-record-cover" />
        <view class="compact-record-copy">
          <text :class="statusClass(match.myStatus)">{{ match.myStatus }}</text>
          <text class="compact-record-title">{{ match.title }}</text>
          <text class="compact-record-meta">{{ match.dateLabel }} · {{ match.venue }}</text>
        </view>
        <view class="compact-record-action">去报名</view>
      </view>
    </view>
    <view v-else class="compact-empty">当前球队下还没有可展示的比赛记录。</view>
  </view>
</template>

<style scoped>
.section-card {
  margin-top: 18rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 2rpx solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 18rpx 40rpx rgba(17, 17, 17, 0.06);
}

.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.section-row-title {
  font-size: 30rpx;
  color: #141512;
  font-weight: 900;
}

.section-row-link {
  color: #6a7067;
  font-size: 22rpx;
  font-weight: 800;
}

.compact-record-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: rgba(253, 254, 252, 0.94);
  box-shadow: inset 0 0 0 2rpx rgba(17, 17, 17, 0.04);
}

.compact-record-cover {
  width: 108rpx;
  height: 84rpx;
  border-radius: 20rpx;
  background:
    radial-gradient(circle at 24% 24%, rgba(200, 255, 0, 0.3), transparent 24%),
    linear-gradient(135deg, rgba(37, 41, 31, 0.98) 0%, rgba(59, 66, 48, 0.98) 100%);
  flex-shrink: 0;
}

.compact-record-copy {
  min-width: 0;
  flex: 1;
}

.compact-record-title {
  display: block;
  margin-top: 8rpx;
  font-size: 30rpx;
  color: #141512;
  font-weight: 900;
  line-height: 1.3;
}

.compact-record-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #6a7067;
  line-height: 1.5;
}

.compact-record-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 138rpx;
  height: 68rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: #d6ff1f;
  color: #151611;
  font-size: 28rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.user-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96rpx;
  height: 44rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 800;
}

.user-status-join {
  background: #eef8d6;
  color: #456100;
}

.user-status-leave {
  background: #f1f3ef;
  color: #5d625a;
}

.user-status-late {
  background: #fff1df;
  color: #ad6900;
}

.user-status-pending {
  background: #eceef3;
  color: #5d6475;
}

.compact-empty {
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #72776e;
  line-height: 1.6;
}
</style>
