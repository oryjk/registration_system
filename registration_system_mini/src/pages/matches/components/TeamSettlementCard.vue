<script setup lang="ts">
import type { BackendActivitySettlementSummary, BackendUser } from "@/types/backend";
import { resolveUserDisplayName } from "@/utils/viewModels";
import {
  currencyLabel,
  settlementModeLabel,
  settlementScopeLabel,
  type SettlementFormState,
  type SettlementParticipantViewModel,
} from "../settlementState";

const props = defineProps<{
  summary: BackendActivitySettlementSummary | null;
  form: SettlementFormState;
  participants: SettlementParticipantViewModel[];
  attendeeCount: number;
  searchKeyword: string;
  searchResults: BackendUser[];
  searching: boolean;
  submittingStatus: boolean;
}>();

const emit = defineEmits<{
  (event: "update:searchKeyword", value: string): void;
  (event: "modeChange", value: Event): void;
  (event: "scopeChange", value: Event): void;
  (event: "chargeAmountInput", userId: number, value: string): void;
  (event: "removeCustomUser", userId: number): void;
  (event: "searchUsers"): void;
  (event: "addCustomUser", user: BackendUser): void;
  (event: "submitSettlement"): void;
}>();

function updateSearchKeyword(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  emit("update:searchKeyword", detail.detail?.value ?? "");
}

function updateChargeAmount(userId: number, event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  emit("chargeAmountInput", userId, detail.detail?.value ?? "");
}
</script>

<template>
  <view class="settlement-card">
    <view class="settlement-head">
      <view>
        <text class="section-title">赛后结算</text>
        <text class="settlement-copy">队长或领队可按参加名单 AA，也可以指定人员和金额扣费。</text>
      </view>
      <view :class="['settlement-status', summary?.settled ? 'settlement-status-done' : '']">
        {{ summary?.settled ? "已结算" : "未结算" }}
      </view>
    </view>

    <view class="settlement-metrics">
      <view class="metric-item">
        <text class="metric-label">参加</text>
        <text class="metric-value">{{ attendeeCount }}</text>
      </view>
      <view class="metric-item">
        <text class="metric-label">扣费</text>
        <text class="metric-value">{{ summary?.settled_user_count ?? 0 }}</text>
      </view>
      <view class="metric-item">
        <text class="metric-label">总额</text>
        <text class="metric-value">{{ currencyLabel(summary?.total_amount) }}</text>
      </view>
      <view class="metric-item">
        <text class="metric-label">人均</text>
        <text class="metric-value">{{ summary?.aa_fee ? currencyLabel(summary.aa_fee) : "—" }}</text>
      </view>
    </view>

    <view v-if="summary?.settled" class="settlement-note">
      {{ settlementModeLabel(summary.mode) }} · {{ settlementScopeLabel(summary.participant_scope) }}
      <text v-if="summary.current_batch_no"> · 第 {{ summary.current_batch_no }} 批</text>
    </view>

    <view class="form-grid">
      <view class="field-block field-wide">
        <text class="field-label">总金额</text>
        <input v-model="form.totalAmount" class="form-input" type="digit" placeholder="例如 240" />
      </view>
      <view class="field-block">
        <text class="field-label">扣费方式</text>
        <picker :range="['AA 平摊', '手动金额']" :value="form.mode === 'manual' ? 1 : 0" @change="$emit('modeChange', $event)">
          <view class="picker-input">{{ form.mode === "manual" ? "手动金额" : "AA 平摊" }}</view>
        </picker>
      </view>
      <view class="field-block">
        <text class="field-label">扣费人员</text>
        <picker :range="['参加名单', '自定义人员']" :value="form.participantScope === 'custom_users' ? 1 : 0" @change="$emit('scopeChange', $event)">
          <view class="picker-input">{{ form.participantScope === "custom_users" ? "自定义人员" : "参加名单" }}</view>
        </picker>
      </view>
      <view class="field-block field-wide">
        <text class="field-label">说明</text>
        <input v-model="form.description" class="form-input" placeholder="例如：场地费 + 水费" />
      </view>
    </view>

    <view v-if="form.participantScope === 'custom_users'" class="custom-search">
      <view class="search-row">
        <input
          :value="searchKeyword"
          class="form-input search-input"
          placeholder="搜索姓名、昵称或用户名"
          confirm-type="search"
          @input="updateSearchKeyword"
          @confirm="$emit('searchUsers')"
        />
        <view class="search-button" @tap="$emit('searchUsers')">{{ searching ? "搜索中" : "搜索" }}</view>
      </view>
      <view v-if="searchResults.length" class="candidate-list">
        <view v-for="user in searchResults" :key="user.id" class="candidate-card" @tap="$emit('addCustomUser', user)">
          <image v-if="user.avatar_url" class="candidate-avatar" :src="user.avatar_url" mode="aspectFill" />
          <view v-else class="candidate-avatar candidate-avatar-fallback">{{ resolveUserDisplayName(user).slice(0, 1) }}</view>
          <view class="candidate-main">
            <text class="candidate-title">{{ resolveUserDisplayName(user) }}</text>
            <text class="candidate-meta">{{ user.username || "未命名用户" }}</text>
          </view>
          <text class="candidate-action">加入</text>
        </view>
      </view>
    </view>

    <view class="participant-box">
      <view class="participant-head">
        <text class="participant-title">扣费明细</text>
        <text class="participant-count">{{ participants.length }} 人</text>
      </view>
      <view v-if="participants.length" class="participant-list">
        <view v-for="person in participants" :key="person.userId" class="participant-row">
          <image v-if="person.avatarUrl" class="participant-avatar" :src="person.avatarUrl" mode="aspectFill" />
          <view v-else class="participant-avatar participant-avatar-fallback">{{ person.name.slice(0, 1) }}</view>
          <text class="participant-name">{{ person.name }}</text>
          <input
            v-if="form.mode === 'manual'"
            :value="person.amount"
            class="amount-input"
            type="digit"
            placeholder="金额"
            @input="updateChargeAmount(person.userId, $event)"
          />
          <text v-else class="amount-label">{{ person.amount ? currencyLabel(person.amount) : "提交后计算" }}</text>
          <text v-if="form.participantScope === 'custom_users'" class="remove-link" @tap="$emit('removeCustomUser', person.userId)">移除</text>
        </view>
      </view>
      <view v-else class="empty-box">
        {{ form.participantScope === "custom_users" ? "请先搜索并选择扣费人员。" : "当前还没有参加人员。" }}
      </view>
    </view>

    <view v-if="summary?.settled && summary.items.length" class="settled-list">
      <text class="participant-title">已结算记录</text>
      <view v-for="item in summary.items" :key="item.user_id" class="settled-row">
        <text class="settled-name">{{ item.user_name || `用户 ${item.user_id}` }}</text>
        <text class="settled-amount">{{ currencyLabel(item.fee) }}</text>
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
  background: #d9ff16;
  color: #111310;
}

.settlement-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 22rpx;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}

.field-wide {
  grid-column: 1 / -1;
}

.field-label {
  color: #111310;
  font-size: 22rpx;
  font-weight: 800;
}

.form-input,
.picker-input {
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

.custom-search,
.participant-box,
.settled-list {
  margin-top: 20rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: #f7f8f4;
}

.search-row {
  display: flex;
  gap: 12rpx;
}

.search-input {
  flex: 1;
}

.search-button {
  width: 128rpx;
  height: 84rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  background: #111310;
  color: #d9ff16;
  font-size: 26rpx;
  font-weight: 900;
}

.candidate-list,
.participant-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 14rpx;
}

.candidate-card,
.participant-row,
.settled-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 14rpx;
  border-radius: 20rpx;
  background: #ffffff;
}

.candidate-avatar,
.participant-avatar {
  flex-shrink: 0;
  width: 62rpx;
  height: 62rpx;
  border-radius: 18rpx;
  overflow: hidden;
}

.candidate-avatar-fallback,
.participant-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111310;
  color: #d9ff16;
  font-size: 26rpx;
  font-weight: 900;
}

.candidate-main {
  flex: 1;
  min-width: 0;
}

.candidate-title,
.participant-name,
.settled-name {
  color: #111310;
  font-size: 27rpx;
  font-weight: 900;
}

.candidate-meta {
  display: block;
  margin-top: 4rpx;
  color: #6a7165;
  font-size: 22rpx;
  font-weight: 700;
}

.candidate-action,
.remove-link {
  color: #2b68f7;
  font-size: 24rpx;
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

.amount-label,
.settled-amount {
  color: #111310;
  font-size: 24rpx;
  font-weight: 900;
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

.settlement-button {
  height: 82rpx;
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #10110f;
  font-size: 28rpx;
  font-weight: 900;
}

.settlement-button-disabled {
  opacity: 0.55;
}
</style>
