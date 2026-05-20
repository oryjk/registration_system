<script setup lang="ts">
import { computed, ref, watch } from "vue";

type TeamMemberCard = {
  userId: number;
  name: string;
  avatarUrl: string;
  tone: string;
  isCurrentUser: boolean;
};

type MemberGroupKey = "joined" | "leave" | "pending";
type StatusDialogMode = MemberGroupKey | null;

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
  (event: "dialogVisibilityChange", visible: boolean): void;
}>();

const selectedMember = ref<{
  group: MemberGroupKey;
  userId: number;
  name: string;
  isCurrentUser: boolean;
} | null>(null);
const selectedGroup = ref<MemberGroupKey>("joined");
const statusDialogMode = ref<StatusDialogMode>(null);

const currentMemberStatus = computed<MemberGroupKey>(() => {
  if (props.groups.joined.some((member) => member.isCurrentUser)) return "joined";
  if (props.groups.leave.some((member) => member.isCurrentUser)) return "leave";
  return "pending";
});

watch(
  currentMemberStatus,
  (value) => {
    selectedGroup.value = value;
  },
  { immediate: true },
);

const memberSections = computed(() => [
  {
    key: "joined" as const,
    statusLabel: "已报名",
    countLabel: `${props.groups.joined.length}`,
    members: props.groups.joined,
    emptyText: "还没有队员报名。",
  },
  {
    key: "leave" as const,
    statusLabel: "请假",
    countLabel: `${props.groups.leave.length}`,
    members: props.groups.leave,
    emptyText: "暂无请假队员。",
  },
  {
    key: "pending" as const,
    statusLabel: "未报名",
    countLabel: `${props.groups.pending.length}`,
    members: props.groups.pending,
    emptyText: "所有活跃队员都已选择状态。",
  },
]);

const activeSection = computed(() => memberSections.value.find((section) => section.key === selectedGroup.value) ?? memberSections.value[0]);

const memberSummaryLabel = computed(() => {
  const total = props.groups.joined.length + props.groups.leave.length + props.groups.pending.length;
  return `${total}人`;
});

const floatingActionLabel = computed(() => {
  if (props.submittingStatus) return "提交中...";
  if (currentMemberStatus.value === "joined") return "已报名 · 修改状态";
  if (currentMemberStatus.value === "leave") return "已请假 · 修改状态";
  return "选择报名状态";
});

const statusDialogVisible = computed(() => statusDialogMode.value !== null);

const statusDialogConfig = computed(() => {
  switch (statusDialogMode.value) {
    case "joined":
      return {
        title: "取消报名",
        message: "取消后会把你的状态改为请假。",
        secondaryText: "再想想",
        primaryText: "取消报名",
        primaryTone: "danger" as const,
      };
    case "leave":
      return {
        title: "改为报名",
        message: "确认报名参加这场比赛？",
        secondaryText: "再想想",
        primaryText: "报名",
        primaryTone: "accent" as const,
      };
    case "pending":
      return {
        title: "选择报名状态",
        message: "你要参加这场比赛，还是请假？",
        secondaryText: "请假",
        primaryText: "报名",
        primaryTone: "accent" as const,
      };
    default:
      return null;
  }
});

function openStatusDialog(mode: MemberGroupKey) {
  statusDialogMode.value = mode;
  emit("dialogVisibilityChange", true);
}

function closeStatusDialog() {
  statusDialogMode.value = null;
  emit("dialogVisibilityChange", false);
}

function handleSelectStand(stand: 0 | 1 | 2) {
  selectedMember.value = null;
  closeStatusDialog();
  emit("selectStand", stand);
}

function handleOpenStatusDialog() {
  if (props.submittingStatus) return;
  openStatusDialog(currentMemberStatus.value);
}

function handleDialogPrimaryAction() {
  if (props.submittingStatus || !statusDialogMode.value) return;

  if (statusDialogMode.value === "joined") {
    handleSelectStand(2);
    return;
  }

  handleSelectStand(1);
}

function handleDialogSecondaryAction() {
  if (props.submittingStatus || !statusDialogMode.value) return;

  if (statusDialogMode.value === "pending") {
    handleSelectStand(2);
    return;
  }

  closeStatusDialog();
}

function handleSelectGroup(group: MemberGroupKey) {
  selectedGroup.value = group;
  selectedMember.value = null;
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
        <text class="section-title">队员状态</text>
      </view>
      <view class="member-total">{{ memberSummaryLabel }}</view>
    </view>

    <view class="member-segment">
      <view
        v-for="section in memberSections"
        :key="section.key"
        :class="['member-segment-item', selectedGroup === section.key ? 'member-segment-item-active' : '']"
        @tap="handleSelectGroup(section.key)"
      >
        <text class="member-segment-label">{{ section.statusLabel }}</text>
        <text class="member-segment-count">{{ section.countLabel }}</text>
      </view>
    </view>

    <view class="member-panel">
      <view class="member-panel-head">
        <text class="member-panel-title">{{ activeSection.statusLabel }}</text>
        <text class="member-panel-count">{{ activeSection.members.length }} 人</text>
      </view>

      <view v-if="activeSection.members.length" class="member-avatar-row">
        <view
          v-for="member in activeSection.members"
          :key="member.userId"
          :class="[
            'member-avatar-item',
            member.isCurrentUser ? 'member-avatar-current' : '',
            selectedMember?.group === activeSection.key && selectedMember.userId === member.userId ? 'member-avatar-selected' : '',
          ]"
          @tap="handleSelectMember(activeSection.key, member)"
        >
          <view class="member-avatar" :style="{ backgroundColor: member.tone }">
            <image v-if="member.avatarUrl" class="member-avatar-image" :src="member.avatarUrl" mode="aspectFill" />
            <text v-else class="member-avatar-text">{{ member.name.slice(0, 1) }}</text>
          </view>
          <text v-if="member.isCurrentUser" class="member-current-tag">我</text>
        </view>
      </view>
      <view v-else class="member-empty">{{ activeSection.emptyText }}</view>

      <view v-if="selectedMember?.group === activeSection.key" class="member-name-panel">
        <text class="member-name-text">{{ selectedMember.name }}</text>
        <text v-if="selectedMember.isCurrentUser" class="member-name-self">我</text>
      </view>
    </view>

    <view class="member-floating-action-wrap">
      <view
        :class="[
          'member-floating-action',
          currentMemberStatus === 'joined' ? 'member-floating-action-joined' :
          currentMemberStatus === 'leave' ? 'member-floating-action-leave' : 'member-floating-action-pending',
          submittingStatus ? 'member-floating-action-disabled' : '',
        ]"
        @tap="handleOpenStatusDialog"
      >
        <text>{{ floatingActionLabel }}</text>
      </view>
    </view>

    <view v-if="statusDialogVisible && statusDialogConfig" class="team-member-dialog-mask">
      <view class="team-member-dialog" @tap.stop>
        <view class="team-member-dialog-head">
          <view>
            <text class="team-member-dialog-title">{{ statusDialogConfig.title }}</text>
            <text class="team-member-dialog-message">{{ statusDialogConfig.message }}</text>
          </view>
          <view class="team-member-dialog-close" @tap="closeStatusDialog">×</view>
        </view>
        <view class="team-member-dialog-actions">
          <view
            class="team-member-dialog-action team-member-dialog-action-secondary"
            :class="props.submittingStatus ? 'team-member-dialog-action-disabled' : ''"
            @tap="handleDialogSecondaryAction"
          >
            {{ statusDialogConfig.secondaryText }}
          </view>
          <view
            class="team-member-dialog-action"
            :class="[
              statusDialogConfig.primaryTone === 'danger' ? 'team-member-dialog-action-danger' : 'team-member-dialog-action-accent',
              props.submittingStatus ? 'team-member-dialog-action-disabled' : '',
            ]"
            @tap="handleDialogPrimaryAction"
          >
            {{ props.submittingStatus ? "提交中..." : statusDialogConfig.primaryText }}
          </view>
        </view>
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

.member-board-head {
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

.member-total {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 86rpx;
  height: 54rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: #f0f2ed;
  color: #5f665b;
  font-size: 24rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.member-segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 22rpx;
}

.member-segment-item {
  min-width: 0;
  padding: 16rpx 12rpx;
  border-radius: 22rpx;
  background: #f3f5ef;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  box-sizing: border-box;
}

.member-segment-item-active {
  background: #d9ff16;
}

.member-segment-label {
  color: #171717;
  font-size: 24rpx;
  line-height: 1.2;
  font-weight: 800;
}

.member-segment-count {
  color: #171717;
  font-size: 30rpx;
  line-height: 1;
  font-weight: 900;
}

.member-panel {
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 26rpx;
  background: #f4f5f2;
}

.member-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.member-panel-title {
  color: #171717;
  font-size: 30rpx;
  line-height: 1.35;
  font-weight: 900;
}

.member-panel-count {
  color: #60685d;
  font-size: 24rpx;
  line-height: 1;
  font-weight: 800;
}

.member-avatar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  row-gap: 18rpx;
  margin-top: 22rpx;
}

.member-avatar-item {
  position: relative;
  margin-right: 10rpx;
  transition: transform 180ms ease;
  transform-origin: center center;
}

.member-avatar-current {
  z-index: 2;
}

.member-avatar-selected {
  z-index: 3;
  transform: translateY(-4rpx) scale(1.18);
}

.member-avatar {
  width: 92rpx;
  height: 92rpx;
  overflow: hidden;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
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

.member-name-self {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: #171717;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 800;
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

.member-floating-action-wrap {
  position: fixed;
  left: 32rpx;
  right: 32rpx;
  bottom: calc(env(safe-area-inset-bottom) + 24rpx);
  z-index: 80;
}

.member-floating-action {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  border-radius: 999rpx;
  font-size: 32rpx;
  line-height: 1;
  font-weight: 900;
  box-shadow: 0 18rpx 36rpx rgba(17, 17, 17, 0.2);
}

.member-floating-action-pending {
  background: #171717;
  color: #ffffff;
}

.member-floating-action-leave {
  background: #4a4d48;
  color: #ffffff;
  box-shadow: 0 18rpx 36rpx rgba(74, 77, 72, 0.28);
}

.member-floating-action-joined {
  background: #c8ff00;
  color: #171717;
  box-shadow: 0 18rpx 36rpx rgba(169, 224, 0, 0.28);
}

.member-floating-action-disabled {
  opacity: 0.7;
}

.team-member-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background: rgba(11, 14, 10, 0.34);
  box-sizing: border-box;
  animation: team-member-dialog-mask-fade-in 220ms ease;
}

.team-member-dialog {
  width: 100%;
  max-width: 620rpx;
  padding: 34rpx 32rpx 32rpx;
  border-radius: 24rpx;
  background: #f8faf2;
  border: 2rpx solid rgba(255, 255, 255, 0.78);
  box-shadow: 0 32rpx 84rpx rgba(8, 10, 7, 0.24);
  box-sizing: border-box;
  animation: team-member-dialog-enter 240ms cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: center center;
}

.team-member-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.team-member-dialog-title {
  display: block;
  color: #171717;
  font-size: 36rpx;
  line-height: 46rpx;
  font-weight: 900;
}

.team-member-dialog-message {
  display: block;
  margin-top: 14rpx;
  color: #596052;
  font-size: 28rpx;
  line-height: 42rpx;
  font-weight: 700;
}

.team-member-dialog-close {
  width: 56rpx;
  height: 56rpx;
  border-radius: 999rpx;
  background: rgba(93, 100, 88, 0.12);
  color: #5f6758;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  line-height: 1;
  flex-shrink: 0;
}

.team-member-dialog-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 30rpx;
}

.team-member-dialog-action {
  height: 84rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.team-member-dialog-action-secondary {
  background: #eef1e8;
  border: 2rpx solid #d5dbca;
  color: #2d332c;
}

.team-member-dialog-action-accent {
  background: #c8ff00;
  color: #171717;
  box-shadow: 0 12rpx 24rpx rgba(152, 204, 0, 0.22);
}

.team-member-dialog-action-danger {
  background: #171717;
  color: #ffffff;
  box-shadow: 0 12rpx 24rpx rgba(17, 17, 17, 0.22);
}

.team-member-dialog-action-disabled {
  opacity: 0.68;
}

@keyframes team-member-dialog-mask-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes team-member-dialog-enter {
  from {
    opacity: 0;
    transform: translateY(26rpx) scale(0.94);
  }

  70% {
    opacity: 1;
    transform: translateY(-4rpx) scale(1.01);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
