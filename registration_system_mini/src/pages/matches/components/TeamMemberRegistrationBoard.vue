<script setup lang="ts">
import { computed, ref } from "vue";

type TeamMemberCard = {
  userId: number;
  name: string;
  avatarUrl: string;
  tone: string;
  isCurrentUser: boolean;
};

const props = defineProps<{
  groups: {
    joined: TeamMemberCard[];
    leave: TeamMemberCard[];
    pending: TeamMemberCard[];
  };
  submittingStatus: boolean;
}>();

const emit = defineEmits<{
  (event: "selectStand", stand: 0 | 1 | 2): void;
}>();

type MemberGroupKey = "joined" | "leave" | "pending";

const selectedMember = ref<{
  group: MemberGroupKey;
  userId: number;
  name: string;
  isCurrentUser: boolean;
} | null>(null);

const memberSections = computed(() => [
  {
    key: "joined" as const,
    className: "member-section-join",
    title: "报名区域",
    statusLabel: "已报名",
    emptyText: "还没有队员报名。",
    members: props.groups.joined,
  },
  {
    key: "leave" as const,
    className: "member-section-leave",
    title: "请假区域",
    statusLabel: "已请假",
    emptyText: "暂无请假队员。",
    members: props.groups.leave,
  },
  {
    key: "pending" as const,
    className: "member-section-pending",
    title: "未报名区域",
    statusLabel: "未报名",
    emptyText: "所有活跃队员都已选择状态。",
    members: props.groups.pending,
  },
]);

function handleSelectStand(stand: 0 | 1 | 2) {
  selectedMember.value = null;
  emit("selectStand", stand);
}

function handleSelectMember(group: MemberGroupKey, member: TeamMemberCard) {
  const current = selectedMember.value;
  if (current?.group === group && current.userId === member.userId) {
    selectedMember.value = null;
    return;
  }

  selectedMember.value = {
    group,
    userId: member.userId,
    name: member.name,
    isCurrentUser: member.isCurrentUser,
  };
}
</script>

<template>
  <view class="member-board registration-card">
    <view class="member-board-head">
      <view>
        <text class="section-title">队员报名状态</text>
        <text class="section-copy">选择报名或请假后，你的头像会移动到对应区域。</text>
      </view>
      <view class="member-total">{{ groups.joined.length }}/{{ groups.joined.length + groups.leave.length + groups.pending.length }}</view>
    </view>

    <view class="member-action-row">
      <view class="member-action member-action-join" @tap="handleSelectStand(1)">{{ submittingStatus ? "提交中..." : "我要报名" }}</view>
      <view class="member-action member-action-leave" @tap="handleSelectStand(2)">我要请假</view>
      <view class="member-action member-action-pending" @tap="handleSelectStand(0)">未报名</view>
    </view>

    <view v-for="section in memberSections" :key="section.key" :class="['member-section', section.className]">
      <view class="member-section-head">
        <text class="member-section-title">{{ section.title }}</text>
        <text class="member-section-count">{{ section.members.length }} 人</text>
      </view>
      <view v-if="section.members.length" class="member-avatar-row">
        <view
          v-for="member in section.members"
          :key="member.userId"
          :class="[
            'member-avatar-item',
            member.isCurrentUser ? 'member-avatar-current' : '',
            selectedMember?.group === section.key && selectedMember.userId === member.userId ? 'member-avatar-selected' : '',
          ]"
          @tap="handleSelectMember(section.key, member)"
        >
          <view class="member-avatar" :style="{ backgroundColor: member.tone }">
            <image v-if="member.avatarUrl" class="member-avatar-image" :src="member.avatarUrl" mode="aspectFill" />
            <text v-else class="member-avatar-text">{{ member.name.slice(0, 1) }}</text>
          </view>
          <text v-if="member.isCurrentUser" class="member-current-tag">我</text>
        </view>
      </view>
      <view v-else class="member-empty">{{ section.emptyText }}</view>
      <view v-if="selectedMember?.group === section.key" class="member-name-panel">
        <text class="member-name-text">{{ selectedMember.name }}</text>
        <text v-if="selectedMember.isCurrentUser" class="member-name-self">我</text>
        <text class="member-name-status">{{ section.statusLabel }}</text>
      </view>
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

.member-board {
  padding: 26rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 36rpx rgba(10, 10, 10, 0.05);
}

.member-board-head,
.member-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.section-title {
  display: block;
  color: #171717;
  font-size: 38rpx;
  line-height: 1.25;
  font-weight: 900;
}

.section-copy {
  display: block;
  margin-top: 10rpx;
  color: #666666;
  font-size: 26rpx;
  line-height: 1.5;
  font-weight: 700;
}

.member-total,
.member-section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 86rpx;
  height: 54rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: #d9ff16;
  color: #171717;
  font-size: 26rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.member-action-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 24rpx;
}

.member-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 900;
}

.member-action-join {
  background: #171717;
  color: #ffffff;
}

.member-action-leave {
  background: #fff1df;
  color: #9a5b00;
}

.member-action-pending {
  background: #eef0ed;
  color: #474c45;
}

.member-section {
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 26rpx;
}

.member-section-join {
  background: #f2f8e5;
}

.member-section-leave {
  background: #fff7ec;
}

.member-section-pending {
  background: #f4f5f2;
}

.member-section-title {
  color: #171717;
  font-size: 30rpx;
  line-height: 1.35;
  font-weight: 900;
}

.member-avatar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  row-gap: 18rpx;
  margin-top: 22rpx;
  padding-left: 14rpx;
}

.member-avatar-item {
  position: relative;
  margin-left: -14rpx;
  transition: transform 180ms ease;
  transform-origin: center center;
}

.member-avatar-item:first-child {
  margin-left: 0;
}

.member-avatar-current {
  z-index: 2;
}

.member-avatar-selected {
  z-index: 3;
  transform: translateY(-4rpx) scale(1.18);
}

.member-avatar {
  width: 80rpx;
  height: 80rpx;
  overflow: hidden;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4rpx solid #ffffff;
  box-sizing: border-box;
  transition: box-shadow 180ms ease, border-color 180ms ease;
}

.member-avatar-current .member-avatar {
  border-color: #171717;
  box-shadow: 0 8rpx 18rpx rgba(17, 17, 17, 0.14);
}

.member-avatar-selected .member-avatar {
  box-shadow: 0 10rpx 20rpx rgba(17, 17, 17, 0.18);
}

.member-avatar-image {
  width: 100%;
  height: 100%;
}

.member-avatar-text {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 900;
}

.member-current-tag {
  position: absolute;
  right: -5rpx;
  bottom: -6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 8rpx;
  border: 3rpx solid #ffffff;
  border-radius: 999rpx;
  background: #171717;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1;
  box-sizing: border-box;
}

.member-name-panel {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  max-width: 100%;
  margin-top: 18rpx;
  padding: 12rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.78);
  border: 2rpx solid rgba(255, 255, 255, 0.78);
  box-sizing: border-box;
}

.member-name-text {
  max-width: 320rpx;
  color: #171717;
  font-size: 26rpx;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-name-self,
.member-name-status {
  flex-shrink: 0;
  color: #60685d;
  font-size: 22rpx;
  font-weight: 800;
}

.member-name-self {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: #171717;
  color: #ffffff;
  font-size: 20rpx;
}

.member-empty {
  margin-top: 16rpx;
  padding: 18rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.64);
  color: #6a7065;
  font-size: 24rpx;
  font-weight: 800;
}
</style>
