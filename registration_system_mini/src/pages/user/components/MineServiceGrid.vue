<script setup lang="ts">
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import NeoTag from "@/components/neo/NeoTag.vue";
import type { TeamProfileViewModel } from "@/types/viewModels";

defineProps<{
  currentTeam: TeamProfileViewModel | null;
  messageSummary: string;
  creditCardSummary: string;
  isPayingMembership: boolean;
}>();

const emit = defineEmits<{
  (event: "openNotifications"): void;
  (event: "renewMembership"): void;
}>();
</script>

<template>
  <view class="mine-service-section">
    <NeoSectionHeader title="账户与服务" marker="服" caption="消息、信用和球队会员" />

    <view class="mine-service-grid">
      <NeoSurface interactive custom-class="mine-service-card" @tap="emit('openNotifications')">
        <view class="mine-service-card__head">
          <text class="mine-service-card__index">01</text>
          <NeoTag tone="blue" size="sm">消息</NeoTag>
        </view>
        <text class="mine-service-card__title">消息中心</text>
        <text class="mine-service-card__copy">{{ messageSummary }}</text>
        <text class="mine-service-card__link">进入 →</text>
      </NeoSurface>

      <NeoSurface custom-class="mine-service-card">
        <view class="mine-service-card__head">
          <text class="mine-service-card__index">02</text>
          <NeoTag tone="green" size="sm">{{ currentTeam?.trustLabel || "待积累" }}</NeoTag>
        </view>
        <text class="mine-service-card__title">球队信用</text>
        <text class="mine-service-card__score">{{ currentTeam?.creditScore ?? 0 }} 分</text>
        <text class="mine-service-card__copy">{{ creditCardSummary }}</text>
      </NeoSurface>

      <NeoSurface
        v-if="currentTeam?.canManageTeam"
        custom-class="mine-service-card mine-service-card--membership"
      >
        <view class="mine-service-card__membership-copy">
          <view class="mine-service-card__head">
            <text class="mine-service-card__index">03</text>
            <NeoTag :tone="currentTeam.isVip ? 'lime' : 'amber'" size="sm">
              {{ currentTeam.isVip ? "会员有效" : "待续费" }}
            </NeoTag>
          </view>
          <text class="mine-service-card__title">球队会员</text>
          <text class="mine-service-card__copy">
            {{ currentTeam.isVip && currentTeam.vipUntil ? `有效期至 ${currentTeam.vipUntil}` : "续费后继续使用球队管理服务" }}
          </text>
        </view>
        <NeoButton
          variant="lime"
          size="sm"
          :loading="isPayingMembership"
          :disabled="isPayingMembership"
          @click="emit('renewMembership')"
        >
          {{ isPayingMembership ? "续费中" : "续费会员" }}
        </NeoButton>
      </NeoSurface>
    </view>
  </view>
</template>

<style scoped>
.mine-service-section {
  margin-top: 34rpx;
}

.mine-service-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.mine-service-card {
  display: flex;
  min-height: 230rpx;
  padding: 20rpx;
  flex-direction: column;
}

.mine-service-card--membership {
  grid-column: 1 / -1;
  min-height: 156rpx;
  align-items: center;
  gap: 20rpx;
  background: var(--neo-color-text);
  color: var(--neo-color-text-inverse);
  flex-direction: row;
}

.mine-service-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}

.mine-service-card__index {
  color: var(--neo-color-text-muted);
  font-size: 20rpx;
  font-weight: 900;
}

.mine-service-card__title,
.mine-service-card__copy,
.mine-service-card__score,
.mine-service-card__link {
  display: block;
}

.mine-service-card__title {
  margin-top: 16rpx;
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.25;
}

.mine-service-card__score {
  margin-top: 8rpx;
  color: var(--neo-color-text);
  font-size: 36rpx;
  font-weight: 900;
  line-height: 1.15;
}

.mine-service-card__copy {
  margin-top: 10rpx;
  color: var(--neo-color-text-muted);
  font-size: 21rpx;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
}

.mine-service-card__link {
  margin-top: auto;
  padding-top: 16rpx;
  color: var(--neo-color-text);
  font-size: 22rpx;
  font-weight: 900;
}

.mine-service-card__membership-copy {
  min-width: 0;
  flex: 1;
}

.mine-service-card--membership .mine-service-card__index,
.mine-service-card--membership .mine-service-card__copy {
  color: var(--neo-color-text-inverse);
  opacity: 0.72;
}

.mine-service-card--membership .mine-service-card__title {
  color: var(--neo-color-text-inverse);
}
</style>
