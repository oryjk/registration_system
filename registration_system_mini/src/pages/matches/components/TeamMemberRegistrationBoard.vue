<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AvatarItem } from "@/components/ui/avatarTypes";
import ExpandableAvatarStack from "@/components/ui/ExpandableAvatarStack.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import AppSurface from "@/components/ui/AppSurface.vue";

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
  /**
   * 打开状态对话框的请求计数（父组件单一行动栏触发）：每次自增即打开一次。
   * 底部操作栏已上收到 MatchIndividualRegistration 统一渲染，本组件只保留名单与对话框。
   */
  statusDialogRequest?: number;
}>();

const emit = defineEmits<{
  (event: "avatarSelect", avatar: AvatarItem): void;
  (event: "selectStand", stand: 0 | 1 | 2): void;
  (event: "dialogVisibilityChange", visible: boolean): void;
}>();

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
    icon: "users",
    countLabel: `${props.groups.joined.length}`,
    members: props.groups.joined,
    emptyText: "还没有队员报名。",
  },
  {
    key: "leave" as const,
    statusLabel: "请假",
    icon: "clock",
    countLabel: `${props.groups.leave.length}`,
    members: props.groups.leave,
    emptyText: "暂无请假队员。",
  },
  {
    key: "pending" as const,
    statusLabel: "未报名",
    icon: "user-round",
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

// 父组件行动栏触发打开状态对话框。
watch(
  () => props.statusDialogRequest,
  (count) => {
    if (count) handleOpenStatusDialog();
  },
);

const statusDialogVisible = ref(false);

const statusDialogConfig = computed(() => {
  switch (statusDialogMode.value) {
    case "joined":
      return {
        title: "取消报名",
        message: "取消后会把你的状态改为请假。",
        secondaryText: "再想想",
        primaryText: "取消报名",
        primaryIcon: "close",
        secondaryIcon: "undo",
        primaryTone: "danger" as const,
      };
    case "leave":
      return {
        title: "改为报名",
        message: "确认报名参加这场比赛？",
        secondaryText: "再想想",
        primaryText: "报名",
        primaryIcon: "check",
        secondaryIcon: "undo",
        primaryTone: "accent" as const,
      };
    case "pending":
      return {
        title: "选择报名状态",
        message: "你要参加这场比赛，还是请假？",
        secondaryText: "请假",
        primaryText: "报名",
        primaryIcon: "check",
        secondaryIcon: "clock-circle",
        primaryTone: "accent" as const,
      };
    default:
      return null;
  }
});

function openStatusDialog(mode: MemberGroupKey) {
  statusDialogMode.value = mode;
  statusDialogVisible.value = true;
  emit("dialogVisibilityChange", true);
}

function closeStatusDialog() {
  statusDialogVisible.value = false;
  emit("dialogVisibilityChange", false);
}

function handleSelectStand(stand: 0 | 1 | 2) {
  closeStatusDialog();
  emit("selectStand", stand);
}

function handleOpenStatusDialog() {
  if (props.submittingStatus) return;
  openStatusDialog(currentMemberStatus.value);
}

function handleDialogPrimaryAction() {
  if (props.submittingStatus || !statusDialogVisible.value || !statusDialogMode.value) return;

  if (statusDialogMode.value === "joined") {
    handleSelectStand(2);
    return;
  }

  handleSelectStand(1);
}

function handleDialogSecondaryAction() {
  if (props.submittingStatus || !statusDialogVisible.value || !statusDialogMode.value) return;

  if (statusDialogMode.value === "pending") {
    handleSelectStand(2);
    return;
  }

  closeStatusDialog();
}

function handleSelectGroup(group: MemberGroupKey) {
  selectedGroup.value = group;
}

const activeMemberAvatars = computed(() => activeSection.value.members.map(member => ({
  id: member.userId,
  name: member.name,
  avatarUrl: member.avatarUrl,
  tone: member.tone,
})));
function selectMemberAvatar(id: string | number) {
  const avatar = activeMemberAvatars.value.find(item => item.id === id);
  if (avatar) emit("avatarSelect", avatar);
}
</script>

<template>
  <AppSurface variant="outlined">
    <view class="member-board-head">
      <view>
        <text class="section-title">参赛名单</text>
      </view>
      <view class="member-total">{{ memberSummaryLabel }}</view>
    </view>

    <view class="member-segment">
      <view
        v-for="section in memberSections"
        :key="section.key"
        :class="['member-segment-item', `member-segment-item--${section.key}`, selectedGroup === section.key ? 'member-segment-item-active' : '']"
        hover-class="member-segment-item-pressed"
        @tap="handleSelectGroup(section.key)"
      >
        <view class="member-segment-icon-wrap">
          <image class="member-segment-icon" :src="`/static/icons/lucide/${section.icon}.png`" mode="aspectFit" aria-hidden="true" />
        </view>
        <view class="member-segment-copy">
          <text class="member-segment-label">{{ section.statusLabel }}</text>
          <text class="member-segment-count">{{ section.countLabel }}</text>
        </view>
      </view>
    </view>

    <view class="member-panel">
      <view v-if="activeSection.members.length" class="member-avatar-row">
        <ExpandableAvatarStack
          :key="activeSection.key"
          :items="activeMemberAvatars"
          @select="selectMemberAvatar"
        />
      </view>
      <view v-else class="member-empty">{{ activeSection.emptyText }}</view>

    </view>

    <slot />

    <ConfirmDialog
      v-if="statusDialogConfig"
      :visible="statusDialogVisible"
      v-bind="statusDialogConfig"
      :loading="props.submittingStatus"
      @primary="handleDialogPrimaryAction"
      @secondary="handleDialogSecondaryAction"
      @close="closeStatusDialog"
    />
  </AppSurface>
</template>

<style scoped>
.member-board-head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.section-title { color: var(--ui-color-text); font-size: 30rpx; line-height: 1.4; font-weight: 600; }
.member-total { color: var(--ui-color-text-muted); font-size: 24rpx; }
.member-segment { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; margin-top: 22rpx; }
.member-segment-item {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
  padding: 22rpx 16rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text);
  transition: background-color var(--ui-motion-switch-duration) var(--ui-motion-ease-out);
}
.member-segment-item--joined { --member-icon-bg: var(--ui-color-accent); background: var(--ui-color-accent-soft); }
.member-segment-item--leave { --member-icon-bg: var(--ui-color-warning-soft); background: var(--ui-color-warning-bg); }
.member-segment-item--joined.member-segment-item-active { background: var(--ui-color-accent); }
.member-segment-item--leave.member-segment-item-active { background: var(--ui-color-warning-soft); }
.member-segment-item--pending.member-segment-item-active { background: var(--ui-color-line-strong); }
.member-segment-item-pressed { opacity: 0.7; }
.member-segment-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--ui-radius-round);
  flex-shrink: 0;
}
.member-segment-icon-wrap::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--member-icon-bg, var(--ui-color-line-strong));
  opacity: 0.3;
}
.member-segment-item-active .member-segment-icon-wrap::before {
  background: var(--ui-color-surface);
}
.member-segment-icon { position: relative; width: 40rpx; height: 40rpx; }
.member-segment-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 8rpx; flex: 1; min-width: 0; }
.member-segment-label { font-size: 22rpx; line-height: 1.2; white-space: nowrap; }
.member-segment-count { font-variant-numeric: tabular-nums; font-size: 36rpx; line-height: 1.1; font-weight: 600; }
.member-panel { margin-top: 24rpx; }

.member-empty {
  margin-top: 16rpx;
  padding: 18rpx 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 500;
}

</style>
