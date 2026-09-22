<script setup lang="ts">
import { computed } from "vue";
import RegistrationProgressSummary from "@/components/ui/RegistrationProgressSummary.vue";
import type { AvatarItem } from "@/components/ui/avatarTypes";
import AppSurface from "@/components/ui/AppSurface.vue";
import type { MatchTeamProgressItem } from "@/types/viewModels";

const props = defineProps<{
  joinedCount: number;
  participants?: AvatarItem[];
  requiredPlayers: number;
  maxPlayers: number;
  countdownText: string;
  remainingPlayersLabel: string;
  /** 球队约队双边进度（主/客队）；非空时替代单条进度与“已报”计数。 */
  teamProgress?: MatchTeamProgressItem[];
  /** 待支付报名费标签（如 ¥25.00，按人数合计的总应付）；非空时提示待支付。 */
  pendingPaymentFeeLabel?: string;
  /** 待支付面板标题（如「已报 3 人 · 报名费待支付」）；缺省为「报名费待支付」。 */
  pendingPaymentTitle?: string;
}>();

const emit = defineEmits<{ (event: "avatarSelect", avatar: AvatarItem): void }>();

const hasTeamProgress = computed(() => !!props.teamProgress && props.teamProgress.length > 0);
const hasPendingPayment = computed(() => !!props.pendingPaymentFeeLabel);
function selectAvatar(id: string | number) {
  const participant = props.participants?.find(item => item.id === id);
  if (participant) emit("avatarSelect", participant);
}
</script>

<template>
  <view class="registration-status-wrap">
    <AppSurface variant="outlined">
      <view v-if="hasTeamProgress" class="status-head">
        <view class="status-heading">
          <text class="status-title">报名进度</text>
          <text v-if="countdownText && countdownText !== '报名进行中'" class="status-countdown">{{ countdownText }}</text>
        </view>
      </view>

      <template v-if="hasTeamProgress">
        <view v-for="team in teamProgress" :key="team.id" class="status-team-progress">
          <RegistrationProgressSummary
            :title="team.label"
            :joined="team.attending"
            :minimum="team.required"
            :maximum="team.max"
          />
        </view>
      </template>
      <RegistrationProgressSummary
        v-else
        :joined="joinedCount"
        :subtitle="countdownText !== '报名进行中' ? countdownText : ''"
        :minimum="requiredPlayers"
        :maximum="maxPlayers"
        :avatars="participants"
        @avatar-select="selectAvatar"
      />

      <!-- 待支付仅提示信息，支付动作统一到页面底部单一行动栏。 -->
      <view v-if="hasPendingPayment" class="payment-panel">
        <view class="payment-panel-copy">
          <text class="payment-panel-title">{{ pendingPaymentTitle || "报名费待支付" }}</text>
          <text class="payment-panel-fee">合计 {{ pendingPaymentFeeLabel }}</text>
        </view>
      </view>
    </AppSurface>
  </view>
</template>

<style scoped>
.registration-status-wrap {
  position: relative;
}

.status-title {
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.status-head {
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 20rpx;
}

.status-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10rpx;
  min-width: 0;
}

.status-countdown {
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.3;
  font-weight: 400;
}

.status-team-progress + .status-team-progress { margin-top: 24rpx; }
.payment-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-warning-soft);
}

.payment-panel-copy {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.payment-panel-title {
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 600;
}

.payment-panel-fee {
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 500;
}
</style>
