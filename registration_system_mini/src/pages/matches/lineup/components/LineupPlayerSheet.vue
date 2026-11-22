<script setup lang="ts">
import { computed, ref, watch } from "vue";
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
// #endif
import AppButton from "@/components/ui/AppButton.vue";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";
import type { LineupCandidate, PitchSlotView } from "@/types/lineup";
import { prefersReducedMotion } from "@/utils/reducedMotion";
import { avatarInitial, describePlayerAssignment } from "../helpers";
import type { PlayerSheetTab } from "../useMatchLineupPage";

const props = defineProps<{
  visible: boolean;
  activeTab: PlayerSheetTab;
  slotView: PitchSlotView | null;
  allSlots: PitchSlotView[];
  attendingCandidates: LineupCandidate[];
  teamOtherCandidates: LineupCandidate[];
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "update:activeTab", tab: PlayerSheetTab): void;
  (event: "assign-starter", userId: number | null): void;
  (event: "toggle-sub", userId: number): void;
}>();

const { rendered, leaving } = useOverlayPresence(
  computed(() => props.visible),
  { leaveDurationMs: () => (prefersReducedMotion() ? 0 : 210) },
);

const showTeamOthers = ref(false);

watch(
  () => props.visible,
  (open) => {
    if (open) {
      showTeamOthers.value = false;
    }
  },
);

const currentStarterId = computed(() => props.slotView?.starter?.user_id ?? null);
const currentSubIdSet = computed(() => new Set((props.slotView?.subs ?? []).map((item) => item.user_id)));

function roleBadge(userId: number): string {
  return describePlayerAssignment(props.allSlots, userId, props.slotView?.slot);
}

function isSelectedInCurrentTab(userId: number): boolean {
  if (props.activeTab === "starter") {
    return currentStarterId.value === userId;
  }
  return currentSubIdSet.value.has(userId);
}

function handleSelectCandidate(userId: number) {
  if (!props.visible || leaving.value) return;
  if (props.activeTab === "starter") {
    emit("assign-starter", userId);
    emit("close");
    return;
  }
  emit("toggle-sub", userId);
}

function handleClearStarter() {
  if (!props.visible || leaving.value) return;
  emit("assign-starter", null);
  emit("close");
}

function handleClose() {
  if (!rendered.value || leaving.value) return;
  emit("close");
}
</script>

<template>
  <view
    v-if="rendered"
    class="sheet-overlay"
    :class="{
      'sheet-overlay--open': rendered && !leaving,
      'sheet-overlay--closing': leaving,
    }"
    @tap="handleClose"
  >
    <view class="sheet-backdrop" />
    <view class="sheet-panel" @tap.stop>
      <view class="sheet-head">
        <view class="sheet-head__info">
          <text class="sheet-title">{{ slotView?.label || "调整位置" }}</text>
          <text class="sheet-subtitle">
            {{ activeTab === "starter" ? "选择首发主力，或在球场拖动互换" : "可多选该位置的替补队员，自动避免身份冲突" }}
          </text>
        </view>
        <button class="sheet-close" aria-label="关闭选人弹层" @tap="handleClose">
          <!-- #ifdef MP-WEIXIN -->
          <AppIcon name="x" tone="muted" />
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          ×
          <!-- #endif -->
        </button>
      </view>

      <view class="sheet-tabs">
        <view
          class="sheet-tab"
          :class="{ 'sheet-tab--active': activeTab === 'starter' }"
          @tap="emit('update:activeTab', 'starter')"
        >
          <text class="sheet-tab__text">主力</text>
          <text v-if="slotView?.starter" class="sheet-tab__meta">{{ slotView.starter.nickname }}</text>
        </view>
        <view
          class="sheet-tab"
          :class="{ 'sheet-tab--active': activeTab === 'sub' }"
          @tap="emit('update:activeTab', 'sub')"
        >
          <text class="sheet-tab__text">该位置替补</text>
          <text v-if="slotView?.subs.length" class="sheet-tab__count">{{ slotView.subs.length }}</text>
        </view>
      </view>

      <scroll-view scroll-y class="sheet-scroll">
        <view v-if="activeTab === 'starter' && currentStarterId !== null" class="sheet-reset-wrap">
          <button
            class="sheet-reset-btn ui-native-button"
            hover-class="sheet-reset-btn--pressed"
            @tap="handleClearStarter"
          >
            移除主力（恢复默认「{{ slotView?.label }}」占位）
          </button>
        </view>

        <view class="sheet-group">
          <view class="sheet-group__head">
            <text class="sheet-group__title">本场已报名队员（{{ attendingCandidates.length }}）</text>
          </view>

          <view v-if="attendingCandidates.length" class="candidate-list">
            <view
              v-for="candidate in attendingCandidates"
              :key="candidate.user_id"
              class="candidate-row"
              :class="{ 'candidate-row--selected': isSelectedInCurrentTab(candidate.user_id) }"
              hover-class="candidate-row--pressed"
              @tap="handleSelectCandidate(candidate.user_id)"
            >
              <view class="candidate-avatar">
                <image
                  v-if="candidate.avatar_url"
                  class="candidate-avatar__img"
                  :src="candidate.avatar_url"
                  mode="aspectFill"
                />
                <text v-else class="candidate-avatar__initial">{{ avatarInitial(candidate.nickname) }}</text>
              </view>

              <view class="candidate-body">
                <text class="candidate-name">{{ candidate.nickname }}</text>
                <text v-if="roleBadge(candidate.user_id)" class="candidate-role">
                  {{ roleBadge(candidate.user_id) }}
                </text>
              </view>

              <view
                class="candidate-check"
                :class="{ 'candidate-check--active': isSelectedInCurrentTab(candidate.user_id) }"
              >
                <text v-if="isSelectedInCurrentTab(candidate.user_id)" class="candidate-check__mark">✓</text>
              </view>
            </view>
          </view>
          <view v-else class="sheet-empty">
            <text>本场暂无已报名参加的队员</text>
          </view>
        </view>

        <view v-if="teamOtherCandidates.length" class="sheet-group sheet-group--team">
          <view class="sheet-group__toggle" @tap="showTeamOthers = !showTeamOthers">
            <text class="sheet-group__title">球队其他成员（{{ teamOtherCandidates.length }}）</text>
            <text class="sheet-group__toggle-hint">{{ showTeamOthers ? "收起" : "展开选人" }}</text>
          </view>

          <view v-if="showTeamOthers" class="candidate-list">
            <view
              v-for="candidate in teamOtherCandidates"
              :key="candidate.user_id"
              class="candidate-row"
              :class="{ 'candidate-row--selected': isSelectedInCurrentTab(candidate.user_id) }"
              hover-class="candidate-row--pressed"
              @tap="handleSelectCandidate(candidate.user_id)"
            >
              <view class="candidate-avatar">
                <image
                  v-if="candidate.avatar_url"
                  class="candidate-avatar__img"
                  :src="candidate.avatar_url"
                  mode="aspectFill"
                />
                <text v-else class="candidate-avatar__initial">{{ avatarInitial(candidate.nickname) }}</text>
              </view>

              <view class="candidate-body">
                <text class="candidate-name">{{ candidate.nickname }}</text>
                <text v-if="roleBadge(candidate.user_id)" class="candidate-role">
                  {{ roleBadge(candidate.user_id) }}
                </text>
                <text v-else class="candidate-role">未报名本场</text>
              </view>

              <view
                class="candidate-check"
                :class="{ 'candidate-check--active': isSelectedInCurrentTab(candidate.user_id) }"
              >
                <text v-if="isSelectedInCurrentTab(candidate.user_id)" class="candidate-check__mark">✓</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="sheet-footer">
        <AppButton block variant="dark" @click="handleClose">完成</AppButton>
      </view>
    </view>
  </view>
</template>

<style scoped>
@import "@/styles/button-controls.css";

.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 130;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
}

.sheet-overlay--open {
  opacity: 1;
  pointer-events: auto;
}

.sheet-overlay--closing {
  opacity: 0;
  pointer-events: auto;
}

.sheet-backdrop {
  position: absolute;
  inset: 0;
  background: var(--ui-color-overlay);
}

.sheet-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  max-height: 78vh;
  padding: var(--ui-space-7) var(--ui-space-7) calc(var(--ui-space-6) + env(safe-area-inset-bottom));
  border-radius: var(--ui-card-radius) var(--ui-card-radius) 0 0;
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-modal);
  box-sizing: border-box;
  transform: translateY(100%);
  transition: transform var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
}

.sheet-overlay--open .sheet-panel {
  transform: translateY(0);
}

.sheet-overlay--closing .sheet-panel {
  transform: translateY(100%);
  transition-timing-function: var(--ui-motion-ease-in-out);
}

.sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-4);
}

.sheet-head__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.sheet-title {
  color: var(--ui-color-text);
  font-size: var(--ui-text-heading);
  font-weight: var(--ui-font-weight-heading);
  line-height: var(--ui-line-height-tight);
}

.sheet-subtitle {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-sm);
  line-height: var(--ui-line-height-compact);
}

.sheet-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text-secondary);
}

.sheet-close::after {
  border: 0;
}

.sheet-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-5);
  padding: 8rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-neutral-bg);
}

.sheet-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2);
  min-height: 68rpx;
  padding: 0 var(--ui-space-3);
  border-radius: 14rpx;
  color: var(--ui-color-text-secondary);
  transition: background-color var(--ui-motion-switch-duration) var(--ui-motion-ease-out);
}

.sheet-tab--active {
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  box-shadow: var(--ui-shadow-pressed);
}

.sheet-tab__text {
  font-size: var(--ui-text-label);
  font-weight: var(--ui-font-weight-heading);
}

.sheet-tab__meta {
  max-width: 120rpx;
  overflow: hidden;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-tab__count {
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent);
  color: var(--ui-color-accent-fg);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-weight-heading);
  line-height: 32rpx;
  text-align: center;
}

.sheet-scroll {
  flex: 1;
  min-height: 240rpx;
  max-height: 46vh;
  margin-top: var(--ui-space-5);
}

.sheet-reset-wrap {
  margin-bottom: var(--ui-space-4);
}

.sheet-reset-btn {
  width: 100%;
  height: 76rpx;
  margin: 0;
  padding: 0 var(--ui-space-4);
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-danger-bg);
  color: var(--ui-color-danger-fg);
  font-size: var(--ui-text-body);
  font-weight: var(--ui-font-weight-heading);
}

.sheet-reset-btn::after {
  border: 0;
}

.sheet-reset-btn--pressed {
  box-shadow: var(--ui-shadow-control-pressed);
}

.sheet-group {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.sheet-group--team {
  margin-top: var(--ui-space-5);
  padding-top: var(--ui-space-4);
  border-top: var(--ui-list-divider);
}

.sheet-group__head,
.sheet-group__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ui-space-1) 0;
}

.sheet-group__title {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-weight-heading);
}

.sheet-group__toggle-hint {
  color: var(--ui-color-text);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-weight-heading);
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.candidate-row {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  min-height: 92rpx;
  padding: var(--ui-space-3) var(--ui-space-4);
  border: 2rpx solid transparent;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-page-muted);
  box-sizing: border-box;
}

.candidate-row--selected {
  border-color: var(--ui-color-accent);
  background: var(--ui-color-accent-soft);
}

.candidate-row--pressed {
  box-shadow: var(--ui-shadow-control-pressed);
}

.candidate-avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60rpx;
  height: 60rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-surface);
  overflow: hidden;
}

.candidate-avatar__img {
  width: 100%;
  height: 100%;
}

.candidate-avatar__initial {
  color: var(--ui-color-text);
  font-size: var(--ui-text-body);
  font-weight: var(--ui-font-weight-heading);
}

.candidate-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}

.candidate-name {
  overflow: hidden;
  color: var(--ui-color-text);
  font-size: var(--ui-text-label);
  font-weight: var(--ui-font-weight-heading);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-role {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-xs);
}

.candidate-check {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid var(--ui-color-line-strong);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-surface);
}

.candidate-check--active {
  border-color: var(--ui-color-accent);
  background: var(--ui-color-accent);
}

.candidate-check__mark {
  color: var(--ui-color-accent-fg);
  font-size: var(--ui-text-body);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1;
}

.sheet-empty {
  padding: var(--ui-space-8) 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-body);
  text-align: center;
}

.sheet-footer {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding-top: var(--ui-space-5);
}
</style>
