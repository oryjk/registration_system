<script setup lang="ts">
import { computed, getCurrentInstance } from "vue";
import { onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
// #endif
import { useAccentTheme } from "@/stores/theme";
import { getCustomNavMetrics } from "@/utils/customNav";
import LineupPitch from "./components/LineupPitch.vue";
import LineupSubList from "./components/LineupSubList.vue";
import LineupPlayerSheet from "./components/LineupPlayerSheet.vue";
// #ifdef MP-WEIXIN
import MatchShareBgSheet from "../components/MatchShareBgSheet.vue";
import TeamVipSheet from "../components/TeamVipSheet.vue";
// #endif
import { useMatchLineupPage } from "./useMatchLineupPage";

defineOptions({ inheritAttrs: false });

const { themePageStyle } = useAccentTheme();
const navMetrics = getCustomNavMetrics();

const {
  loading,
  errorMessage,
  match,
  currentTeam,
  hasSavedLineup,
  playersPerTeam,
  formation,
  formationOptions,
  pitchSlots,
  attendingCandidates,
  teamOtherCandidates,
  unassignedAttending,
  currentUser,
  currentUserRole,
  canEdit,
  isReadonly,
  isDirty,
  saving,
  canSaveLineup,
  showEmptyReadonly,
  pageTitle,
  matchTimeLabel,
  starterCount,
  subCount,
  sheetVisible,
  selectedSlot,
  sheetTab,
  activeSlotView,
  shareBg,
  loadPage,
  selectFormation,
  openSlotSheet,
  closeSlotSheet,
  handlePitchTap,
  handlePitchDrag,
  handleAssignStarter,
  handleToggleSub,
  handleRemoveSub,
  handleResetPositions,
  handleSave,
  handleBackToDetail,
  friendShare,
  timelineShare,
} = useMatchLineupPage(getCurrentInstance());

// uni-app MP 需在页面 SFC 内显式调用分享生命周期以启用原生转发给朋友/群与分享到朋友圈。
onShareAppMessage(friendShare);
onShareTimeline(timelineShare);

const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
  paddingBottom: "var(--ui-action-bar-clearance)",
}));

const metaPageStyle = computed(() =>
  [themePageStyle.value, sheetVisible.value || shareBg.anySheetVisible.value ? "overflow: hidden;" : ""]
    .filter(Boolean)
    .join(";"),
);
</script>

<template>
  <page-meta :page-style="metaPageStyle" />
  <view class="app-theme-scope ui-card-page lineup-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader :title="pageTitle" showBack />

    <!-- #ifndef MP-WEIXIN -->
    <view class="lineup-h5-notice">
      <text class="lineup-h5-notice__title">请在微信小程序中使用</text>
      <text class="lineup-h5-notice__desc">比赛排阵型、拖拽站位与海报分享功能仅支持微信小程序端。</text>
      <view class="lineup-h5-notice__action">
        <AppButton block variant="outline" @click="handleBackToDetail">返回上一页</AppButton>
      </view>
    </view>
    <!-- #endif -->

    <!-- #ifdef MP-WEIXIN -->
    <view class="lineup-content">
      <RunningLoader v-if="loading" text="正在加载比赛阵型" />

      <view v-else-if="errorMessage" class="lineup-state-card ui-card-panel">
        <text class="lineup-state-card__title">加载失败</text>
        <text class="lineup-state-card__desc">{{ errorMessage }}</text>
        <view class="lineup-state-card__actions">
          <AppButton block variant="dark" @click="loadPage">重新加载</AppButton>
          <AppButton block variant="outline" @click="handleBackToDetail">返回比赛</AppButton>
        </view>
      </view>

      <template v-else-if="match">
        <!-- 顶部比赛概览卡 -->
        <view class="match-banner ui-card-panel">
          <view class="match-banner__top">
            <view class="match-banner__heading">
              <text class="match-banner__title">{{ match.name }}</text>
              <view class="match-banner__badges">
                <text v-if="match.host_team_name" class="match-badge match-badge--readonly">{{ match.host_team_name }}</text>
                <text class="match-badge match-badge--accent">{{ playersPerTeam }}人制 · {{ formation }}</text>
                <text v-if="canEdit" class="match-badge match-badge--edit">
                  {{ isDirty ? "有未保存修改" : "队长编辑模式" }}
                </text>
                <text v-else-if="hasSavedLineup" class="match-badge match-badge--readonly">首发阵型</text>
              </view>
            </view>
            <button
              v-if="shareBg.canManageShareBg.value && !showEmptyReadonly"
              class="match-banner__share ui-subtle-control"
              hover-class="match-banner__share--pressed"
              :disabled="saving || shareBg.isBusy.value"
              @tap="shareBg.openShareBgManager"
            >
              <AppIcon name="image" size="var(--ui-icon-sm)" />
              <text class="match-banner__share-text">分享背景</text>
            </button>
          </view>

          <view class="match-banner__meta">
            <view class="match-banner__meta-row">
              <AppIcon name="calendar-days" size="var(--ui-icon-xs)" tone="muted" />
              <text class="match-banner__meta-text">{{ matchTimeLabel }}</text>
            </view>
            <view v-if="match.location" class="match-banner__meta-row">
              <AppIcon name="map-pin" size="var(--ui-icon-xs)" tone="muted" />
              <text class="match-banner__meta-text">{{ match.location }}</text>
            </view>
          </view>
        </view>

        <!-- 当前登录用户在阵型中的显著身份提示条 -->
        <view
          v-if="currentUserRole && !showEmptyReadonly"
          class="my-role-banner"
          :class="currentUserRole.kind === 'sub' ? 'my-role-banner--sub' : 'my-role-banner--starter'"
        >
          <text class="my-role-banner__tag">
            {{ currentUserRole.kind === "starter" ? "你的位置" : "你的替补安排" }}
          </text>
          <text v-if="currentUserRole.kind === 'starter'" class="my-role-banner__copy">
            你在本场担任：{{ currentUserRole.label }}（主力）{{
              currentUserRole.subs.length
                ? ` · 替补：${currentUserRole.subs.map((s) => s.nickname).join("、")}`
                : ""
            }}
          </text>
          <text v-else class="my-role-banner__copy">
            你在本场担任：{{ currentUserRole.label }}替补{{
              currentUserRole.starter ? `（替换 ${currentUserRole.starter.nickname}）` : ""
            }}
          </text>
        </view>

        <!-- 只读且尚未排阵型时的空态 -->
        <view v-if="showEmptyReadonly" class="lineup-state-card ui-card-panel">
          <text class="lineup-state-card__title">暂未发布本场阵型</text>
          <text class="lineup-state-card__desc">
            队长或领队保存阵型后，你可以在这里查看自己的首发或替补对应位置。
          </text>
          <view class="lineup-state-card__actions">
            <AppButton block variant="outline" @click="handleBackToDetail">返回比赛详情</AppButton>
          </view>
        </view>

        <template v-else>
          <!-- 首次自动预排提示 -->
          <view v-if="canEdit && !hasSavedLineup" class="prefill-tip">
            <AppIcon name="info" size="var(--ui-icon-sm)" tone="muted" />
            <text class="prefill-tip__text">
              {{
                attendingCandidates.length > 0
                  ? `已按本场 ${attendingCandidates.length} 名已报名队员预排首发（人数不足的位置保留默认占位），调整后请点击「保存阵型」。`
                  : "本场暂未有已报名队员，请轻点球场圆点从球队名册中选择首发或替补后再保存阵型。"
              }}
            </text>
          </view>

          <!-- 阵型选择条（按比赛人制自动匹配，仅编辑态显示） -->
          <view v-if="canEdit" class="formation-bar ui-card-panel">
            <view class="formation-bar__head">
              <text class="formation-bar__title">选择阵型（{{ playersPerTeam }}人制）</text>
              <text class="formation-bar__stat">首发 {{ starterCount }}/{{ playersPerTeam }} · 替补 {{ subCount }} 人</text>
            </view>
            <scroll-view scroll-x class="formation-scroll" :show-scrollbar="false">
              <view class="formation-pills">
                <view
                  v-for="code in formationOptions"
                  :key="code"
                  class="formation-pill"
                  :class="{ 'formation-pill--active': code === formation }"
                  hover-class="formation-pill--pressed"
                  @tap="selectFormation(code)"
                >
                  <text class="formation-pill__text">{{ code }}</text>
                </view>
              </view>
            </scroll-view>
          </view>

          <!-- 未分配已报名队员提示条（方便队长快速安排替补） -->
          <view v-if="canEdit && unassignedAttending.length" class="unassigned-bar ui-card-panel">
            <view class="unassigned-bar__head">
              <text class="unassigned-bar__title">未分配的已报名队员（{{ unassignedAttending.length }}）</text>
              <text class="unassigned-bar__hint">点球场圆点或下方「指定替补」安排</text>
            </view>
            <view class="unassigned-chips">
              <text
                v-for="member in unassignedAttending"
                :key="member.user_id"
                class="unassigned-chip"
              >
                {{ member.nickname }}
              </text>
            </view>
          </view>

          <!-- 球场区 -->
          <view class="pitch-section">
            <LineupPitch
              :players="pitchSlots"
              :readonly="isReadonly"
              :selected-slot="sheetVisible ? selectedSlot : null"
              :current-user-id="currentUser?.id ?? null"
              @tap="handlePitchTap"
              @drag="handlePitchDrag"
            />
            <text class="pitch-hint">
              {{
                canEdit
                  ? "轻点圆点调整主力/替补 · 拖动可微调站位或拖到另一圆点互换主力"
                  : `当前展示 ${playersPerTeam}人制 ${formation} 阵型 · 首发 ${starterCount}/${playersPerTeam} · 替补 ${subCount} 人`
              }}
            </text>
          </view>

          <!-- 替补对应表 -->
          <LineupSubList
            :slots="pitchSlots"
            :readonly="isReadonly"
            :current-user-id="currentUser?.id ?? null"
            @open-starter="(slot) => openSlotSheet(slot, 'starter')"
            @open-sub="(slot) => openSlotSheet(slot, 'sub')"
            @remove-sub="handleRemoveSub"
          />
        </template>
      </template>
    </view>

    <!-- 底部固定操作栏 -->
    <view v-if="!loading && !errorMessage && match && !showEmptyReadonly" class="lineup-footer">
      <view v-if="canEdit" class="lineup-footer__edit-grid">
        <button
          class="footer-btn footer-btn--subtle ui-native-button"
          hover-class="footer-btn--pressed"
          :disabled="saving"
          @tap="handleResetPositions"
        >
          重置站位
        </button>
        <button
          class="footer-btn footer-btn--outline ui-native-button"
          hover-class="footer-btn--pressed"
          open-type="share"
          :disabled="saving"
        >
          分享阵容
        </button>
        <button
          :class="[
            'footer-btn',
            'footer-btn--primary',
            'ui-native-button',
            'ui-native-button--primary',
            !canSaveLineup ? 'footer-btn--disabled' : '',
          ]"
          :hover-class="canSaveLineup ? 'footer-btn--pressed' : 'none'"
          :disabled="!canSaveLineup"
          @tap="handleSave"
        >
          {{ saving ? "保存中…" : "保存阵型" }}
        </button>
      </view>

      <view v-else class="lineup-footer__readonly-grid">
        <button
          class="footer-btn footer-btn--primary ui-native-button ui-native-button--primary"
          hover-class="footer-btn--pressed"
          open-type="share"
        >
          分享阵容
        </button>
      </view>
    </view>

    <!-- 选人/替补弹层 -->
    <LineupPlayerSheet
      :visible="sheetVisible"
      :active-tab="sheetTab"
      :slot-view="activeSlotView"
      :all-slots="pitchSlots"
      :attending-candidates="attendingCandidates"
      :team-other-candidates="teamOtherCandidates"
      @close="closeSlotSheet"
      @update:active-tab="(tab) => (sheetTab = tab)"
      @assign-starter="handleAssignStarter"
      @toggle-sub="handleToggleSub"
    />

    <!-- 分享卡片背景图与球队会员抽屉（与比赛详情共享同一套球队资源库与会员权益） -->
    <MatchShareBgSheet
      :visible="shareBg.shareBgSheetVisible.value"
      :team-name="shareBg.hostTeamName.value"
      :current-bg-url="shareBg.currentBgUrl.value"
      :backgrounds="shareBg.teamBackgrounds.value"
      :loading="shareBg.isLoadingMeta.value"
      :busy="shareBg.isBusy.value"
      :has-access="shareBg.hasCustomShareBgAccess.value"
      :vip-summary-text="shareBg.vipSummaryText.value"
      @close="shareBg.closeShareBgSheet"
      @select-default="void shareBg.handleSelectDefault()"
      @select-background="void shareBg.handleSelectBackground($event)"
      @upload-new="shareBg.handleUploadNew"
      @open-vip="shareBg.openVipSheet()"
    />
    <TeamVipSheet
      :visible="shareBg.vipSheetVisible.value"
      :team-id="shareBg.hostTeamId.value"
      :team-name="shareBg.hostTeamName.value"
      :vip-status="shareBg.teamVipStatus.value"
      :is-vip="currentTeam?.isVip"
      :vip-until="currentTeam?.vipUntil"
      :vip-credits="currentTeam?.vipCredits"
      @close="shareBg.closeVipSheet"
      @purchased="void shareBg.handleVipPurchased()"
    />

    <!-- 离屏 5:4（1000×800）标准 Canvas 2D 分享卡片画布 -->
    <canvas id="lineup-card-canvas" type="2d" class="lineup-canvas lineup-canvas--card" />
    <!-- #endif -->
  </view>
</template>

<style scoped>
@import "@/styles/page-surfaces.css";
@import "@/styles/list-surfaces.css";
@import "@/styles/button-controls.css";

.lineup-page {
  min-height: 100vh;
  padding-left: var(--ui-page-padding-inline);
  padding-right: var(--ui-page-padding-inline);
  box-sizing: border-box;
}

.lineup-h5-notice {
  margin-top: var(--ui-space-8);
  padding: var(--ui-space-8) var(--ui-space-6);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.lineup-h5-notice__title {
  color: var(--ui-color-text);
  font-size: var(--ui-text-heading);
  font-weight: var(--ui-font-weight-heading);
}

.lineup-h5-notice__desc {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-text-body);
  line-height: var(--ui-line-height-body);
}

.lineup-h5-notice__action {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-top: var(--ui-space-2);
}

.lineup-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-card-gap);
  padding-top: var(--ui-space-3);
  padding-bottom: var(--ui-space-8);
}

.lineup-state-card {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  text-align: center;
}

.lineup-state-card__title {
  color: var(--ui-color-text);
  font-size: var(--ui-text-heading);
  font-weight: var(--ui-font-weight-heading);
}

.lineup-state-card__desc {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-body);
  line-height: var(--ui-line-height-body);
}

.lineup-state-card__actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--ui-space-3);
  margin-top: var(--ui-space-2);
}

.match-banner {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.match-banner__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-3);
}

.match-banner__heading {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.match-banner__title {
  color: var(--ui-color-text);
  font-size: var(--ui-text-heading);
  font-weight: var(--ui-font-weight-heading);
  line-height: var(--ui-line-height-tight);
  overflow-wrap: anywhere;
}

.match-banner__badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}

.match-badge {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 14rpx;
  border-radius: var(--ui-radius-round);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.4;
}

.match-badge--accent {
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-accent-deep);
}

.match-badge--edit {
  background: var(--ui-color-success-bg);
  color: var(--ui-color-success-fg);
}

.match-badge--readonly {
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-neutral-fg);
}

.match-banner__share {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  height: 64rpx;
  min-height: 64rpx;
  margin: 0;
  padding: 0 20rpx;
  font-size: var(--ui-text-sm);
}

.match-banner__share::after {
  border: 0;
}

.match-banner__share--pressed {
  box-shadow: var(--ui-shadow-control-pressed);
}

.match-banner__share-text {
  color: var(--ui-color-text);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1;
}

.match-banner__meta {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding-top: var(--ui-space-3);
  border-top: var(--ui-list-divider);
}

.match-banner__meta-row {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.match-banner__meta-text {
  flex: 1;
  min-width: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-body);
  line-height: var(--ui-line-height-compact);
  overflow-wrap: anywhere;
}

.my-role-banner {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  padding: var(--ui-space-4) var(--ui-space-5);
  border-radius: var(--ui-radius-card);
  box-shadow: var(--ui-shadow-card);
}

.my-role-banner--starter {
  background: var(--ui-color-success-bg);
}

.my-role-banner--sub {
  background: var(--ui-color-warning-bg);
}

.my-role-banner__tag {
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-weight-heading);
  color: var(--ui-color-text-secondary);
}

.my-role-banner--starter .my-role-banner__copy {
  color: var(--ui-color-success-fg);
}

.my-role-banner--sub .my-role-banner__copy {
  color: var(--ui-color-warning-fg);
}

.my-role-banner__copy {
  font-size: var(--ui-text-label);
  font-weight: var(--ui-font-weight-heading);
  line-height: var(--ui-line-height-compact);
}

.prefill-tip {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3) var(--ui-space-4);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
}

.prefill-tip__text {
  flex: 1;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-sm);
  line-height: var(--ui-line-height-compact);
}

.formation-bar {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.formation-bar__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
}

.formation-bar__title {
  color: var(--ui-color-text);
  font-size: var(--ui-text-label);
  font-weight: var(--ui-font-weight-heading);
}

.formation-bar__stat {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-sm);
  font-variant-numeric: tabular-nums;
}

.formation-scroll {
  width: 100%;
  white-space: nowrap;
}

.formation-pills {
  display: inline-flex;
  gap: var(--ui-space-2);
}

.formation-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 112rpx;
  height: 64rpx;
  padding: 0 var(--ui-space-5);
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  box-sizing: border-box;
  transition: background-color var(--ui-motion-switch-duration) var(--ui-motion-ease-out);
}

.formation-pill--active {
  border-color: var(--ui-color-accent);
  background: var(--ui-color-accent);
  color: var(--ui-color-accent-fg);
}

.formation-pill--pressed {
  box-shadow: var(--ui-shadow-control-pressed);
}

.formation-pill__text {
  font-size: var(--ui-text-body);
  font-weight: var(--ui-font-weight-heading);
  font-variant-numeric: tabular-nums;
}

.unassigned-bar {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.unassigned-bar__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--ui-space-2);
}

.unassigned-bar__title {
  color: var(--ui-color-text);
  font-size: var(--ui-text-body);
  font-weight: var(--ui-font-weight-heading);
}

.unassigned-bar__hint {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-xs);
}

.unassigned-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}

.unassigned-chip {
  padding: 6rpx 16rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-weight-medium);
}

.pitch-section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.pitch-hint {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-sm);
  text-align: center;
  line-height: var(--ui-line-height-compact);
}

.lineup-footer {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom) + var(--ui-action-bar-bottom));
  z-index: 40;
  width: calc(100% - var(--ui-floating-action-inset) * 2);
  max-width: var(--ui-content-max-width);
  padding: var(--ui-action-bar-padding);
  border: var(--ui-border-hairline);
  border-radius: var(--ui-action-bar-radius);
  background: var(--ui-action-bar-bg);
  box-shadow: var(--ui-action-bar-shadow);
  transform: translateX(-50%);
  box-sizing: border-box;
}

.lineup-footer__edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.25fr;
  gap: var(--ui-space-3);
}

.lineup-footer__readonly-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-3);
}

.footer-btn {
  width: 100%;
  height: var(--ui-button-height-md);
  margin: 0;
  padding: 0 var(--ui-space-3);
  border: 0;
  border-radius: var(--ui-button-radius);
  font-size: var(--ui-text-subtitle);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1;
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out);
}

.footer-btn::after {
  border: 0;
}

.footer-btn--subtle {
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text);
}

.footer-btn--outline {
  border: var(--ui-button-outline-border);
  background: var(--ui-button-outline-bg);
  color: var(--ui-color-text);
}

.footer-btn--disabled {
  background: var(--ui-color-disabled);
  color: var(--ui-color-text-disabled);
}

.footer-btn--pressed {
  transform: scale(0.98);
  box-shadow: var(--ui-shadow-control-pressed);
}

.lineup-canvas {
  position: fixed;
  left: -4000px;
  top: 0;
  pointer-events: none;
}

.lineup-canvas--card {
  width: 1000px;
  height: 800px;
}
</style>
