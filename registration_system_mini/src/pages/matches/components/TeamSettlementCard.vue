<script setup lang="ts">
import type { BackendMatchSettlementSummary } from "@/types/backend";
import { centsToYuanText, type SettlementFormState, type SettlementParticipantViewModel } from "../settlementState";

defineProps<{
  summary: BackendMatchSettlementSummary | null;
  form: SettlementFormState;
  participants: SettlementParticipantViewModel[];
  totalLabel: string;
  submittingStatus: boolean;
}>();

const emit = defineEmits<{
  (event: "chargeAmountInput", userId: number, value: string): void;
  (event: "submitSettlement"): void;
}>();

function updateChargeAmount(userId: number, event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  emit("chargeAmountInput", userId, detail.detail?.value ?? "");
}

function batchTypeLabel(operationType: string) {
  return operationType === "reverse" ? "冲正" : "结算";
}
</script>

<template>
  <view class="settlement-card">
    <view class="settlement-head">
      <view>
        <text class="section-title">赛后结算</text>
        <text class="settlement-copy">按出场名单扣队费，每人金额可调整（0 表示免付），余额不足将记为欠款。</text>
      </view>
      <view :class="['settlement-status', summary?.settled ? 'settlement-status-done' : '']">
        {{ summary?.settled ? "已结算" : "未结算" }}
      </view>
    </view>

    <view class="settlement-metrics">
      <view class="metric-item">
        <text class="metric-label">扣费人数</text>
        <text class="metric-value">{{ summary?.settled ? summary.history[0]?.user_count ?? 0 : participants.length }}</text>
      </view>
      <view class="metric-item">
        <text class="metric-label">总额</text>
        <text class="metric-value">{{ summary?.settled ? centsToYuanText(summary.total_amount_cents) : totalLabel || "—" }}</text>
      </view>
    </view>

    <view v-if="summary?.settled" class="settlement-note">
      已结算 · 第 {{ summary.batch_no }} 批<text v-if="summary.description"> · {{ summary.description }}</text>
    </view>

    <view class="field-block field-wide">
      <text class="field-label">说明</text>
      <input v-model="form.description" class="form-input" placeholder="例如：场地费 + 水费" />
    </view>

    <view class="participant-box">
      <view class="participant-head">
        <text class="participant-title">扣费明细</text>
        <text class="participant-count">{{ participants.length }} 人</text>
      </view>
      <view v-if="participants.length" class="participant-list">
        <view v-for="person in participants" :key="person.userId" class="participant-row">
          <view class="participant-avatar participant-avatar-fallback">{{ person.name.slice(0, 1) }}</view>
          <text class="participant-name">{{ person.name }}</text>
          <input
            :value="person.amount"
            class="amount-input"
            type="digit"
            placeholder="金额"
            @input="updateChargeAmount(person.userId, $event)"
          />
        </view>
      </view>
      <view v-else class="empty-box">
        当前没有可扣费的出场队员（散人与已付报名费者不参与队费扣款）。
      </view>
    </view>

    <view v-if="summary?.settled && summary.items.length" class="settled-list">
      <text class="participant-title">当前批次记录</text>
      <view v-for="item in summary.items" :key="item.user_id" class="settled-row">
        <text class="settled-name">{{ item.user_name || `用户 ${item.user_id}` }}</text>
        <text :class="['settled-amount', item.balance_after_cents < 0 ? 'settled-amount-debt' : '']">
          ¥{{ centsToYuanText(item.amount_cents) }}<text v-if="item.balance_after_cents < 0"> · 欠款</text>
        </text>
      </view>
    </view>

    <view v-if="summary?.history?.length" class="history-box">
      <text class="participant-title">批次历史</text>
      <view v-for="batch in summary.history" :key="batch.batch_no" class="history-row">
        <text class="history-label">第 {{ batch.batch_no }} 批 · {{ batchTypeLabel(batch.operation_type) }}</text>
        <text class="history-amount">¥{{ centsToYuanText(Math.abs(batch.total_amount_cents)) }} · {{ batch.user_count }} 人</text>
      </view>
    </view>

    <view :class="['settlement-button', submittingStatus ? 'settlement-button-disabled' : '']" @tap="$emit('submitSettlement')">
      {{ summary?.settled ? "重新结算" : submittingStatus ? "结算中..." : "执行结算" }}
    </view>
  </view>
</template>

<style scoped>
.settlement-card {
  margin-top: 24rpx;
  padding: 26rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 36rpx rgba(10, 10, 10, 0.05);
  box-sizing: border-box;
}

.settlement-head {
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

.settlement-copy {
  display: block;
  margin-top: 8rpx;
  color: #747972;
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 700;
}

.settlement-status {
  flex-shrink: 0;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #f1f2ed;
  color: #535850;
  font-size: 22rpx;
  font-weight: 900;
}

.settlement-status-done {
  background: var(--neo-color-accent);
  color: #111310;
}

.settlement-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 22rpx;
}

.metric-item {
  min-width: 0;
  padding: 16rpx 10rpx;
  border-radius: 20rpx;
  background: #f4f6f0;
}

.metric-label,
.metric-value {
  display: block;
  text-align: center;
}

.metric-label {
  color: #6a7165;
  font-size: 20rpx;
  font-weight: 700;
}

.metric-value {
  margin-top: 6rpx;
  color: #111310;
  font-size: 24rpx;
  font-weight: 900;
}

.settlement-note {
  margin-top: 16rpx;
  padding: 16rpx 18rpx;
  border-radius: 20rpx;
  background: #fbfff0;
  color: #3f4a08;
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 800;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
  margin-top: 22rpx;
}

.field-wide {
  width: 100%;
}

.field-label {
  color: #111310;
  font-size: 22rpx;
  font-weight: 800;
}

.form-input {
  width: 100%;
  height: 84rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  border-radius: 22rpx;
  background: #f4f6f0;
  color: #111310;
  font-size: 27rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.participant-box,
.settled-list,
.history-box {
  margin-top: 20rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: #f7f8f4;
}

.participant-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 14rpx;
}

.participant-row,
.settled-row,
.history-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 14rpx;
  border-radius: 20rpx;
  background: #ffffff;
}

.participant-avatar {
  flex-shrink: 0;
  width: 62rpx;
  height: 62rpx;
  border-radius: 18rpx;
  overflow: hidden;
}

.participant-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111310;
  color: var(--neo-color-accent);
  font-size: 26rpx;
  font-weight: 900;
}

.participant-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.participant-title {
  color: #111310;
  font-size: 28rpx;
  font-weight: 900;
}

.participant-count {
  color: #6a7165;
  font-size: 22rpx;
  font-weight: 800;
}

.participant-name {
  flex: 1;
  min-width: 0;
  color: #111310;
  font-size: 27rpx;
  font-weight: 900;
}

.amount-input {
  width: 148rpx;
  height: 64rpx;
  padding: 0 14rpx;
  border-radius: 16rpx;
  background: #f4f6f0;
  color: #111310;
  font-size: 24rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.empty-box {
  margin-top: 12rpx;
  padding: 20rpx;
  border-radius: 20rpx;
  background: #ffffff;
  color: #747972;
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 700;
}

.settled-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.settled-row {
  justify-content: space-between;
}

.settled-name {
  color: #111310;
  font-size: 27rpx;
  font-weight: 900;
}

.settled-amount {
  color: #111310;
  font-size: 24rpx;
  font-weight: 900;
}

.settled-amount-debt {
  color: #d04860;
}

.history-box {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.history-row {
  justify-content: space-between;
}

.history-label {
  color: #535850;
  font-size: 24rpx;
  font-weight: 800;
}

.history-amount {
  color: #6a7165;
  font-size: 22rpx;
  font-weight: 800;
}

.settlement-button {
  height: 82rpx;
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: var(--neo-color-accent);
  color: #10110f;
  font-size: 28rpx;
  font-weight: 900;
}

.settlement-button-disabled {
  opacity: 0.55;
}
</style>
