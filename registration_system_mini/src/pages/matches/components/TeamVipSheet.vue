<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
// #endif
import { computed, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";
import { createTeamVipOrder, syncPaymentOrderStatus } from "@/api/payment";
import type { BackendTeamVipPlanSpec, BackendTeamVipStatus, TeamVipPlanCode } from "@/types/backend";
import { beijingDateKey } from "@/utils/datetime";
import { isMockWxPaymentParams, isPaymentCancelled, normalizeWxPaymentParams, requestWxPayment } from "@/utils/payment";
import { prefersReducedMotion } from "@/utils/reducedMotion";

interface DisplayVipPlan {
  code: TeamVipPlanCode;
  name: string;
  priceText: string;
  unitText: string;
  badge: string;
  description: string;
}

const DEFAULT_FREE_TIER_NOTE =
  "免费版也可正常使用比赛分享功能（默认热血海报底）；开通球队会员可自定义上传分享背景图，并解锁未来更多球队专属权益";

const DEFAULT_PLANS: DisplayVipPlan[] = [
  {
    code: "once",
    name: "单次体验",
    priceText: "¥9",
    unitText: "/次",
    badge: "",
    description: "增加 1 次球队专属权益，可用于解锁单场自定义背景",
  },
  {
    code: "monthly",
    name: "月度会员",
    priceText: "¥19",
    unitText: "/月",
    badge: "",
    description: "30 天内球队不限次使用全部会员权益",
  },
  {
    code: "yearly",
    name: "年度会员",
    priceText: "¥99",
    unitText: "/年",
    badge: "推荐",
    description: "365 天畅享全部权益，最划算",
  },
];

const props = withDefaults(
  defineProps<{
    visible: boolean;
    teamId: number;
    teamName?: string;
    vipStatus?: BackendTeamVipStatus | null;
    isVip?: boolean;
    vipUntil?: string | null;
    vipCredits?: number;
  }>(),
  {
    teamName: "",
    vipStatus: null,
    isVip: false,
    vipUntil: "",
    vipCredits: 0,
  },
);

const emit = defineEmits<{
  (event: "close"): void;
  (event: "purchased", plan: TeamVipPlanCode): void;
}>();

const { rendered, leaving } = useOverlayPresence(
  computed(() => props.visible),
  { leaveDurationMs: () => (prefersReducedMotion() ? 0 : 210) },
);

const selectedPlan = ref<TeamVipPlanCode>("yearly");
const submitting = ref(false);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      selectedPlan.value = "yearly";
    }
  },
);

function formatPlanPrice(cents: number): string {
  const yuan = cents / 100;
  return Number.isInteger(yuan) ? `¥${yuan}` : `¥${yuan.toFixed(2)}`;
}

function planUnit(spec: BackendTeamVipPlanSpec): string {
  if (spec.code === "monthly") return "/月";
  if (spec.code === "yearly") return "/年";
  return "/次";
}

const displayPlans = computed<DisplayVipPlan[]>(() => {
  const backendPlans = props.vipStatus?.plans;
  if (!backendPlans || backendPlans.length === 0) return DEFAULT_PLANS;
  const byCode = new Map<TeamVipPlanCode, BackendTeamVipPlanSpec>(
    backendPlans.map((item) => [item.code, item]),
  );
  return DEFAULT_PLANS.map((fallback) => {
    const spec = byCode.get(fallback.code);
    if (!spec) return fallback;
    return {
      code: spec.code,
      name: spec.name || fallback.name,
      priceText: formatPlanPrice(spec.price_cents),
      unitText: planUnit(spec),
      badge: spec.badge ?? fallback.badge,
      description: spec.description || fallback.description,
    };
  });
});

const selectedPlanDetail = computed(
  () => displayPlans.value.find((item) => item.code === selectedPlan.value) ?? displayPlans.value[2],
);

const effectiveIsVip = computed(() => props.vipStatus?.is_vip ?? props.isVip);
const effectiveVipUntil = computed(() => props.vipStatus?.vip_until ?? props.vipUntil ?? "");
const effectiveVipCredits = computed(() => props.vipStatus?.vip_credits ?? props.vipCredits ?? 0);

const statusSummaryText = computed(() => {
  const parts: string[] = [];
  if (effectiveIsVip.value) {
    const dateText = effectiveVipUntil.value ? beijingDateKey(effectiveVipUntil.value) : "";
    parts.push(dateText ? `会员有效至 ${dateText}` : "球队会员生效中");
  }
  if (effectiveVipCredits.value > 0) {
    parts.push(`剩余 ${effectiveVipCredits.value} 次单次权益`);
  }
  return parts.length > 0 ? parts.join(" · ") : "当前为免费版";
});

const ctaLabel = computed(() => {
  if (submitting.value) return "正在拉起支付...";
  const plan = selectedPlanDetail.value;
  return plan ? `立即开通 · ${plan.priceText}` : "立即开通";
});

function handleClose() {
  if (!rendered.value || leaving.value || submitting.value) return;
  emit("close");
}

function selectPlan(code: TeamVipPlanCode) {
  if (submitting.value) return;
  selectedPlan.value = code;
}

async function handlePurchase() {
  if (!props.visible || !rendered.value || leaving.value || submitting.value || !props.teamId) return;
  submitting.value = true;
  try {
    const orderResult = await createTeamVipOrder({
      team_id: props.teamId,
      plan: selectedPlan.value,
    });
    const paymentParams = orderResult.payment ? normalizeWxPaymentParams(orderResult.payment) : null;
    if (paymentParams && !isMockWxPaymentParams(paymentParams)) {
      await requestWxPayment(paymentParams);
    }
    const synced = await syncPaymentOrderStatus(orderResult.order.order_no);
    if (synced.order.status === "paid") {
      uni.$emit("home:data-may-changed");
      uni.showToast({ title: "球队会员已开通", icon: "none" });
      emit("purchased", selectedPlan.value);
      return;
    }
    uni.showToast({ title: "支付已提交，权益稍后自动到账", icon: "none", duration: 2600 });
    emit("purchased", selectedPlan.value);
  } catch (error) {
    if (isPaymentCancelled(error)) {
      uni.showToast({ title: "已取消支付", icon: "none" });
      return;
    }
    uni.showToast({
      title: error instanceof Error ? error.message : "开通失败，请稍后重试",
      icon: "none",
      duration: 2600,
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <view
    v-if="rendered"
    :class="[
      'vip-sheet-overlay',
      rendered && !leaving ? 'vip-sheet-overlay-open' : '',
      leaving ? 'vip-sheet-overlay-closing' : '',
    ]"
    @tap="handleClose"
  >
    <view class="vip-sheet-backdrop" />
    <view class="vip-sheet-panel" @tap.stop>
      <view class="vip-sheet-head">
        <view class="vip-sheet-heading">
          <view class="vip-sheet-title-row">
            <text class="vip-sheet-title">球队会员</text>
            <text v-if="teamName" class="vip-sheet-team-pill">{{ teamName }}</text>
          </view>
          <text class="vip-sheet-status">{{ statusSummaryText }}</text>
        </view>
        <button class="vip-sheet-close" aria-label="关闭球队会员弹层" @tap="handleClose">
          <!-- #ifdef MP-WEIXIN -->
          <AppIcon name="x" tone="muted" />
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          ×
          <!-- #endif -->
        </button>
      </view>

      <!-- 免费版明确提示条 -->
      <view class="vip-free-banner">
        <!-- #ifdef MP-WEIXIN -->
        <AppIcon name="info" size="var(--ui-icon-sm)" color="var(--ui-color-success-fg)" />
        <!-- #endif -->
        <text class="vip-free-banner__text">{{ DEFAULT_FREE_TIER_NOTE }}</text>
      </view>

      <!-- 3 档套餐卡片 -->
      <view class="vip-plan-list">
        <view
          v-for="plan in displayPlans"
          :key="plan.code"
          :class="['vip-plan-card', selectedPlan === plan.code ? 'vip-plan-card--active' : '']"
          hover-class="vip-plan-card--pressed"
          @tap="selectPlan(plan.code)"
        >
          <view v-if="plan.badge" class="vip-plan-badge">
            <text>{{ plan.badge }}</text>
          </view>
          <view class="vip-plan-main">
            <view class="vip-plan-info">
              <text class="vip-plan-name">{{ plan.name }}</text>
              <text class="vip-plan-desc">{{ plan.description }}</text>
            </view>
            <view class="vip-plan-price-wrap">
              <text class="vip-plan-price">{{ plan.priceText }}</text>
              <text class="vip-plan-unit">{{ plan.unitText }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="vip-sheet-footer">
        <view class="vip-sheet-cta">
          <AppButton
            block
            variant="lime"
            :loading="submitting"
            :disabled="submitting"
            @click="handlePurchase"
          >
            {{ ctaLabel }}
          </AppButton>
        </view>
        <text class="vip-sheet-note">开通后权益归属当前球队，全队管理员均可使用</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.vip-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 150;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ui-motion-overlay-duration) ease;
}

.vip-sheet-overlay-open {
  opacity: 1;
  pointer-events: auto;
}

.vip-sheet-overlay-closing {
  opacity: 0;
  pointer-events: auto;
}

.vip-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: var(--ui-color-overlay);
}

.vip-sheet-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  box-sizing: border-box;
  max-height: 88vh;
  overflow-y: auto;
  padding: var(--ui-space-7) var(--ui-page-padding-inline, 28rpx) calc(var(--ui-space-7) + env(safe-area-inset-bottom));
  border-top-left-radius: var(--ui-card-radius, 36rpx);
  border-top-right-radius: var(--ui-card-radius, 36rpx);
  background: var(--ui-color-surface);
  transform: translateY(100%);
  transition: transform var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
}

.vip-sheet-overlay-open .vip-sheet-panel {
  transform: translateY(0);
}

.vip-sheet-overlay-closing .vip-sheet-panel {
  pointer-events: none;
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .vip-sheet-overlay,
  .vip-sheet-panel {
    transition: none;
  }
}

.vip-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.vip-sheet-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
  flex: 1;
}

.vip-sheet-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}

.vip-sheet-title {
  color: var(--ui-color-text);
  font-size: var(--ui-text-title, 34rpx);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.3;
}

.vip-sheet-team-pill {
  padding: 4rpx 14rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 500;
  line-height: 1.35;
}

.vip-sheet-status {
  color: var(--ui-color-text-secondary, var(--ui-color-text-muted));
  font-size: 24rpx;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
}

.vip-sheet-close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--ui-control-min-height, 72rpx);
  height: var(--ui-control-min-height, 72rpx);
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ui-color-text-muted);
  font-size: 40rpx;
  line-height: 1;
}

.vip-sheet-close::after { border: 0; }

.vip-free-banner {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-success-bg);
}

.vip-free-banner__text {
  flex: 1;
  min-width: 0;
  color: var(--ui-color-success-fg);
  font-size: 23rpx;
  line-height: 1.5;
}

.vip-plan-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}

.vip-plan-card {
  position: relative;
  padding: 24rpx 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-sizing: border-box;
  transition:
    border-color var(--ui-motion-press-duration) var(--ui-motion-ease-out),
    background-color var(--ui-motion-press-duration) var(--ui-motion-ease-out),
    transform var(--ui-motion-press-duration) var(--ui-motion-ease-out);
}

.vip-plan-card--active {
  border-color: var(--ui-color-accent);
  background: var(--ui-color-accent-subtle);
}

.vip-plan-card--pressed {
  transform: scale(0.99);
}

.vip-plan-badge {
  position: absolute;
  top: -2rpx;
  right: 20rpx;
  padding: 4rpx 14rpx;
  border-bottom-left-radius: 12rpx;
  border-bottom-right-radius: 12rpx;
  background: var(--ui-color-accent);
  color: var(--ui-color-accent-fg);
  font-size: 20rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.3;
}

.vip-plan-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.vip-plan-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
  flex: 1;
}

.vip-plan-name {
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.35;
}

.vip-plan-desc {
  color: var(--ui-color-text-secondary, var(--ui-color-text-muted));
  font-size: 22rpx;
  line-height: 1.45;
}

.vip-plan-price-wrap {
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.vip-plan-price {
  color: var(--ui-color-text);
  font-size: 38rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.1;
}

.vip-plan-unit {
  color: var(--ui-color-text-secondary, var(--ui-color-text-muted));
  font-size: 22rpx;
  margin-left: 2rpx;
}

.vip-sheet-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  margin-top: 28rpx;
}

.vip-sheet-cta {
  width: 100%;
}

.vip-sheet-note {
  color: var(--ui-color-text-secondary, var(--ui-color-text-muted));
  font-size: 22rpx;
  text-align: center;
  line-height: 1.4;
}
</style>
