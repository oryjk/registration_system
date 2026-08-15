<script setup lang="ts">
import { computed, ref } from "vue";
import { NeoAvatarStack, NeoButton, NeoProgress, NeoStickyActionBar, NeoSurface, NeoTag } from "@/components/neo";

type Participant = {
  id: number;
  name: string;
  avatarUrl: string;
  tone: string;
};

const props = defineProps<{
  joinedCount: number;
  requiredPlayers: number;
  maxPlayers: number;
  countdownText: string;
  participantPreview: Participant[];
  remainingPlayersLabel: string;
  submittingStatus: boolean;
  individualCtaLabel: string;
  isGuestMode: boolean;
  ctaDisabled: boolean;
  showCta?: boolean;
}>();

const emit = defineEmits<{
  selectIndividualSignup: [];
  selectParticipant: [id: number];
}>();

const selectedParticipantId = ref<number | null>(null);
const selectedParticipant = computed(() => (
  props.participantPreview.find((participant) => participant.id === selectedParticipantId.value) ?? null
));

function handleSelectParticipant(id: string | number) {
  const participantId = Number(id);
  selectedParticipantId.value = selectedParticipantId.value === participantId ? null : participantId;
  emit("selectParticipant", participantId);
}

function handleSignup() {
  if (!props.ctaDisabled && !props.submittingStatus) emit("selectIndividualSignup");
}
</script>

<template>
  <view class="registration-status-wrap">
    <NeoSurface custom-class="registration-status-surface">
      <view class="status-head">
        <view class="status-heading">
          <NeoTag tone="dark">报名进度</NeoTag>
          <text class="status-countdown">{{ countdownText }}</text>
        </view>
        <view class="status-total">
          <text class="status-total-label">已报</text>
          <text class="status-total-value">{{ joinedCount }}</text>
          <text class="status-total-target">/{{ requiredPlayers || "?" }}</text>
        </view>
      </view>

      <NeoProgress
        :value="joinedCount"
        :target="requiredPlayers"
        :max="maxPlayers"
        label="成行 / 满员"
        :value-text="`${joinedCount}/${requiredPlayers || '?'}`"
      />

      <view class="status-meta">
        <text class="status-meta-label">{{ remainingPlayersLabel }}</text>
        <NeoTag v-if="maxPlayers > requiredPlayers" tone="red">满员 {{ maxPlayers }} 人</NeoTag>
      </view>

      <view class="participants-section">
        <view class="participants-heading">
          <text class="participants-title">已报名队员</text>
          <text class="participants-count">{{ joinedCount }} 人</text>
        </view>
        <NeoAvatarStack
          :items="participantPreview"
          :selected-id="selectedParticipantId"
          :max-visible="0"
          interactive
          size="md"
          @select="handleSelectParticipant"
        />
        <view v-if="selectedParticipant" class="selected-participant">
          <text>{{ selectedParticipant.name }}</text>
          <text class="selected-participant-hint">已选中</text>
        </view>
      </view>
    </NeoSurface>

    <NeoStickyActionBar v-if="showCta !== false">
      <NeoButton
        :variant="ctaDisabled ? 'muted' : 'dark'"
        block
        :loading="submittingStatus"
        :disabled="ctaDisabled"
        @click="handleSignup"
      >
        {{ submittingStatus ? "提交中..." : individualCtaLabel }}
        <text v-if="!isGuestMode && !submittingStatus" class="action-free-label">免费</text>
      </NeoButton>
    </NeoStickyActionBar>
  </view>
</template>

<style scoped>
.registration-status-wrap {
  position: relative;
}

.status-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.status-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18rpx;
  min-width: 0;
}

.status-countdown {
  color: var(--neo-color-text);
  font-size: 46rpx;
  line-height: 1;
  font-weight: 900;
}

.status-total {
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
  gap: 4rpx;
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 800;
}

.status-total-value {
  color: var(--neo-color-text);
  font-size: 54rpx;
  line-height: 0.9;
  font-weight: 900;
}

.status-total-target {
  font-size: 28rpx;
}

.status-meta,
.participants-heading,
.selected-participant {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.status-meta {
  margin-top: 18rpx;
}

.status-meta-label,
.participants-count,
.selected-participant-hint {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  line-height: 1.35;
  font-weight: 800;
}

.participants-section {
  margin-top: 26rpx;
  padding-top: 22rpx;
  border-top: var(--neo-border-default);
}

.participants-title {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

.participants-section :deep(.neo-avatar-stack) {
  margin-top: 18rpx;
}

.selected-participant {
  justify-content: flex-start;
  margin-top: 16rpx;
  padding: 10rpx 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-warning-soft);
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
}

.action-free-label {
  margin-left: 12rpx;
  font-size: 22rpx;
  opacity: 0.7;
}
</style>
