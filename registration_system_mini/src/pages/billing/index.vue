<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { getTeamFundBalances, getTeamFundTransactions } from "@/api/teamFund";
import { cancelPaymentOrder, createRechargeOrder, listPaymentOrders, syncGoPaymentOrder } from "@/api/payment";
import { useTeamContext } from "@/stores/teamContext";
import type {
  BackendPaymentOrder,
  BackendTeamFundBalance,
  BackendTeamFundTransaction,
} from "@/types/backend";
import { getCustomNavMetrics } from "@/utils/customNav";
import { isMockWxPaymentParams, isPaymentCancelled, normalizeWxPaymentParams, requestWxPayment } from "@/utils/payment";
import { buildTeamFundBalanceSummary, teamFundCentsLabel, teamFundSourceLabel } from "@/utils/viewModels";

const { themePageStyle } = useAccentTheme();

const { ensureSessionReady } = useTeamContext();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const isPaying = ref(false);
const errorMessage = ref("");
const rechargeAmount = ref("30");
const balances = ref<BackendTeamFundBalance[]>([]);
const transactions = ref<BackendTeamFundTransaction[]>([]);
const orders = ref<BackendPaymentOrder[]>([]);

const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

const balanceSummary = computed(() => buildTeamFundBalanceSummary(balances.value));

async function loadPageData() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    await ensureSessionReady();
    const [teamFundBalances, teamFundTransactions, paymentOrders] = await Promise.all([
      getTeamFundBalances(),
      getTeamFundTransactions({ limit: 30 }),
      listPaymentOrders({ page: 1, pageSize: 10 }),
    ]);
    balances.value = teamFundBalances;
    transactions.value = teamFundTransactions;
    orders.value = paymentOrders.items;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "账单加载失败";
  } finally {
    isLoading.value = false;
  }
}

function amountClass(cents: number) {
  return cents >= 0 ? "billing-amount billing-amount-plus" : "billing-amount billing-amount-minus";
}

function amountLabel(cents: number) {
  return `${cents >= 0 ? "+" : "-"}¥${(Math.abs(cents) / 100).toFixed(2)}`;
}

function transactionMetaLabel(transaction: BackendTeamFundTransaction) {
  const scope = transaction.match_name || transaction.team_name;
  return `${teamFundSourceLabel(transaction.source)} · ${scope}`;
}

function orderStatusLabel(status: BackendPaymentOrder["status"]) {
  switch (status) {
    case "paid":
      return "已支付";
    case "cancelled":
      return "已取消";
    case "failed":
      return "支付失败";
    default:
      return "待支付";
  }
}

function orderTypeLabel(kind: BackendPaymentOrder["kind"]) {
  switch (kind) {
    case "team_membership":
      return "球队队费";
    case "match_registration":
      return "比赛报名费";
    case "tip":
      return "打赏";
    default:
      return "钱包充值";
  }
}

async function handleRecharge() {
  if (isPaying.value) return;
  const amount = Number(rechargeAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    uni.showToast({ title: "请输入充值金额", icon: "none" });
    return;
  }

  isPaying.value = true;
  try {
    const amountCents = Math.round(Number(rechargeAmount.value) * 100);
    const result = await createRechargeOrder({ amount_cents: amountCents });
    const paymentParams = normalizeWxPaymentParams(result.payment);
    if (paymentParams && !isMockWxPaymentParams(paymentParams)) {
      await requestWxPayment(paymentParams);
    }
    await syncGoPaymentOrder(result.order.order_no);
    await loadPageData();
    uni.showToast({ title: "充值订单已提交", icon: "none" });
  } catch (error) {
    uni.showToast({
      title: isPaymentCancelled(error) ? "已取消支付" : error instanceof Error ? error.message : "充值失败",
      icon: "none",
    });
  } finally {
    isPaying.value = false;
  }
}

async function handleSyncOrder(orderNo: string) {
  try {
    await syncGoPaymentOrder(orderNo);
    await loadPageData();
    uni.showToast({ title: "订单状态已同步", icon: "none" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "同步失败", icon: "none" });
  }
}

async function handleCancelOrder(orderNo: string) {
  try {
    await cancelPaymentOrder(orderNo);
    await loadPageData();
    uni.showToast({ title: "订单已取消", icon: "none" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "取消订单失败", icon: "none" });
  }
}

onShow(() => {
  void loadPageData();
});
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="billing-page" :style="pageStyle">
    <AppTabHeader title="账单明细" showBack />

    <view class="billing-header">
      <view>
        <text class="billing-title">账单明细</text>
        <text class="billing-subtitle">队费余额、充值、扣费流水以真实账单接口为准。</text>
      </view>
      <view class="billing-header-badge">{{ transactions.length }} 条</view>
    </view>

    <view v-if="errorMessage" class="billing-empty">{{ errorMessage }}</view>
    <view v-else-if="isLoading" class="billing-skeleton-stack">
      <view class="billing-skeleton-card billing-skeleton-hero">
        <view class="billing-skeleton-line billing-skeleton-line-label" />
        <view class="billing-skeleton-line billing-skeleton-line-value" />
        <view class="billing-skeleton-line billing-skeleton-line-body" />
      </view>
      <view class="billing-skeleton-grid">
        <view class="billing-skeleton-card" />
        <view class="billing-skeleton-card" />
        <view class="billing-skeleton-card" />
      </view>
      <view class="billing-skeleton-card billing-skeleton-list" />
    </view>

    <template v-else>
    <view class="billing-hero">
      <view>
        <text class="billing-hero-label">队费余额合计</text>
        <text class="billing-hero-value">{{ teamFundCentsLabel(balanceSummary.totalCents) }}</text>
        <text class="billing-hero-copy">
          {{ balanceSummary.teamCount }} 支球队<text v-if="balanceSummary.debtTeamCount"> · {{ balanceSummary.debtTeamCount }} 支有欠款</text>
        </text>
      </view>
      <view class="billing-recharge-box">
        <input v-model="rechargeAmount" class="billing-recharge-input" type="digit" placeholder="金额" />
        <view class="billing-hero-pill" @tap="handleRecharge">{{ isPaying ? "处理中" : "充值" }}</view>
      </view>
    </view>

    <view v-if="balances.length" class="billing-metric-grid">
      <view
        v-for="balance in balances"
        :key="balance.team_id"
        :class="['billing-metric-card', balance.balance_cents < 0 ? 'billing-metric-card-debt' : '']"
      >
        <text class="billing-metric-label">{{ balance.team_name }}</text>
        <text class="billing-metric-value">{{ teamFundCentsLabel(balance.balance_cents) }}</text>
      </view>
    </view>

    <view class="billing-card">
      <view class="billing-card-head">
        <view>
          <text class="billing-card-title">支付订单</text>
          <text class="billing-card-caption">充值、队费等微信支付订单可同步或取消。</text>
        </view>
      </view>

      <view v-if="orders.length" class="billing-list">
        <view v-for="order in orders" :key="order.order_no" class="billing-item billing-order-item">
          <view class="billing-item-copy">
            <text class="billing-item-title">{{ orderTypeLabel(order.kind) }} · {{ orderStatusLabel(order.status) }}</text>
            <text class="billing-item-meta">{{ order.order_no }}</text>
          </view>
          <view class="billing-item-side">
            <text class="billing-amount">¥{{ (order.amount_cents / 100).toFixed(2) }}</text>
            <view class="order-action-row">
              <text class="order-action" @tap="handleSyncOrder(order.order_no)">同步</text>
              <text v-if="order.status === 'pending'" class="order-action order-action-danger" @tap="handleCancelOrder(order.order_no)">取消</text>
            </view>
          </view>
        </view>
      </view>
      <view v-else class="billing-empty">当前还没有支付订单。</view>
    </view>

    <view class="billing-card">
      <view class="billing-card-head">
        <view>
          <text class="billing-card-title">队费流水</text>
          <text class="billing-card-caption">充值、比赛扣费与结算冲正，按时间倒序。</text>
        </view>
      </view>

      <view v-if="transactions.length" class="billing-list">
        <view v-for="item in transactions" :key="item.id" class="billing-item">
          <view class="billing-item-copy">
            <text class="billing-item-title">{{ transactionMetaLabel(item) }}</text>
            <text class="billing-item-meta">{{ item.description || (item.created_at || "").slice(0, 16).replace("T", " ") }}</text>
          </view>
          <view class="billing-item-side">
            <text :class="amountClass(item.amount_cents)">{{ amountLabel(item.amount_cents) }}</text>
            <text class="billing-item-balance">余额 {{ teamFundCentsLabel(item.balance_after_cents) }}</text>
          </view>
        </view>
      </view>
      <view v-else class="billing-empty">当前还没有队费流水。交队费或比赛结算后会在这里展示。</view>
    </view>
    </template>
  </view>
</template>

<style scoped>
.billing-page {
  min-height: 100vh;
  padding: 30rpx 28rpx 100rpx;
  background:
    radial-gradient(circle at top left, rgba(200, 255, 0, 0.12), transparent 24%),
    linear-gradient(180deg, #fbfcf7 0%, #f2f4ed 100%);
  box-sizing: border-box;
}

.billing-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.billing-title {
  display: block;
  font-size: 64rpx;
  color: #131410;
  font-weight: 900;
}

.billing-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6d7269;
  font-weight: 700;
}

.billing-header-badge {
  padding: 14rpx 22rpx;
  border-radius: 999rpx;
  background: #151613;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
}

.billing-hero,
.billing-card,
.billing-metric-card {
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.billing-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 22rpx;
  padding: 30rpx 28rpx;
  border-radius: 34rpx;
}

.billing-hero-label {
  display: block;
  font-size: 24rpx;
  color: #72776f;
  font-weight: 700;
}

.billing-hero-value {
  display: block;
  margin-top: 10rpx;
  font-size: 64rpx;
  color: #131410;
  font-weight: 900;
}

.billing-hero-copy {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #6c7168;
}

.billing-hero-pill {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: var(--neo-color-accent-soft);
  color: var(--neo-color-accent-deep);
  font-size: 22rpx;
  font-weight: 900;
}

.billing-recharge-box {
  width: 178rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.billing-recharge-input {
  width: 100%;
  height: 66rpx;
  padding: 0 14rpx;
  border-radius: 18rpx;
  background: #f3f5ef;
  color: #141512;
  font-size: 26rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.billing-metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 20rpx;
}

.billing-metric-card {
  padding: 24rpx;
  border-radius: 28rpx;
}

.billing-metric-card-debt .billing-metric-value {
  color: #d04860;
}

.billing-metric-card-wide {
  grid-column: 1 / -1;
}

.billing-metric-label {
  display: block;
  font-size: 24rpx;
  color: #71766f;
  font-weight: 700;
}

.billing-metric-value {
  display: block;
  margin-top: 10rpx;
  font-size: 42rpx;
  color: #141512;
  font-weight: 900;
}

.billing-card {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 30rpx;
}

.billing-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.billing-card-title {
  display: block;
  font-size: 30rpx;
  color: #171814;
  font-weight: 900;
}

.billing-card-caption {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #747972;
}

.billing-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 22rpx;
}

.billing-order-item {
  align-items: flex-start;
}

.order-action-row {
  display: flex;
  justify-content: flex-end;
  gap: 14rpx;
  margin-top: 8rpx;
}

.order-action {
  color: #111310;
  font-size: 23rpx;
  font-weight: 900;
}

.order-action-danger {
  color: #b42318;
}

.billing-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.billing-item-copy {
  min-width: 0;
  flex: 1;
}

.billing-item-title {
  display: block;
  font-size: 28rpx;
  color: #171814;
  font-weight: 800;
}

.billing-item-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #787d75;
  line-height: 1.5;
}

.billing-item-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.billing-amount {
  font-size: 28rpx;
  font-weight: 900;
}

.billing-amount-plus {
  color: #4f9d00;
}

.billing-amount-minus {
  color: #d04860;
}

.billing-item-balance {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #737870;
}

.billing-empty {
  margin-top: 20rpx;
  padding: 26rpx;
  border-radius: 28rpx;
  background: #ffffff;
  color: #6c7168;
  font-size: 28rpx;
  line-height: 1.6;
}

.billing-skeleton-stack,
.billing-skeleton-card,
.billing-skeleton-line {
  position: relative;
  overflow: hidden;
}

.billing-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 20rpx;
}

.billing-skeleton-card {
  min-height: 132rpx;
  border-radius: 28rpx;
  background: #eef2e8;
}

.billing-skeleton-hero {
  min-height: 196rpx;
  padding: 28rpx;
  background: #ffffff;
}

.billing-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.billing-skeleton-list {
  min-height: 260rpx;
  background: #ffffff;
}

.billing-skeleton-line {
  height: 24rpx;
  border-radius: 999rpx;
  background: #dfe6d8;
}

.billing-skeleton-line + .billing-skeleton-line {
  margin-top: 18rpx;
}

.billing-skeleton-line-label {
  width: 140rpx;
}

.billing-skeleton-line-value {
  width: 260rpx;
  height: 54rpx;
}

.billing-skeleton-line-body {
  width: 64%;
}

.billing-skeleton-card::after,
.billing-skeleton-line::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.78) 50%, transparent 100%);
  animation: billing-skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes billing-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
