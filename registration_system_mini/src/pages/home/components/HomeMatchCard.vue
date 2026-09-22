<script setup lang="ts">
import { computed } from "vue";
import ExpandableAvatarStack from "@/components/ui/ExpandableAvatarStack.vue";
import type { AvatarItem } from "@/components/ui/avatarTypes";
import AppButton from "@/components/ui/AppButton.vue";
import AppProgress from "@/components/ui/AppProgress.vue";
import AppTag from "@/components/ui/AppTag.vue";
import type { HomeMatchCardViewModel } from "@/types/viewModels";

const props = defineProps<{
  match: HomeMatchCardViewModel;
  isGuestMode: boolean;
  isNavigating: boolean;
}>();

const emit = defineEmits<{
  (event: "matchTap", match: HomeMatchCardViewModel): void;
}>();

const actionLabel = computed(() => props.match.actionLabel || (props.match.canRegister ? "去报名" : "查看比赛"));

// 进行中/已结束查看型卡：日期 + 星期 + 时间一行展示。
const compactDateLine = computed(() => {
  const block = props.match.dateBlock;
  return `${block.monthDay} ${block.weekday} ${block.timeLabel}`;
});

const participantItems = computed<AvatarItem[]>(() =>
  props.match.participantAvatars.map((avatar) => ({
    id: avatar.userId,
    name: avatar.displayText,
    avatarUrl: avatar.avatarUrl || undefined,
    tone: avatar.tone,
  })),
);

function handleTap() {
  if (props.match.canOpenDetail && !props.isNavigating) {
    emit("matchTap", props.match);
  }
}

</script>

<template>
  <!-- 进行中/已结束：紧凑查看型卡。标题时间为主，整卡进入详情，无报名入口与进度强调。 -->
  <view
    v-if="match.viewMode === 'compact'"
    :class="['home-view-card', isNavigating ? 'home-view-card--tapping' : '']"
    :hover-class="match.canOpenDetail ? 'home-view-card--pressed' : 'none'"
    @tap="handleTap"
  >
    <view class="home-view-card__main">
      <view class="home-view-card__title-row">
        <text class="home-view-card__title">{{ match.title }}</text>
      </view>
      <text class="home-view-card__meta">{{ compactDateLine }} · {{ match.venue }}</text>
      <text v-if="match.scoreLabel" class="home-view-card__score">{{ match.scoreNote }} {{ match.scoreLabel }}</text>
    </view>
    <button
      v-if="match.canOpenDetail"
      class="home-view-card__detail"
      :aria-label="`${match.stage}，查看${match.title}详情`"
      :disabled="isNavigating"
      hover-class="home-view-card__detail--pressed"
      @tap.stop="handleTap"
    >
      <text>{{ match.stage }}</text>
      <view class="home-view-card__chevron" aria-hidden="true" />
    </button>
    <view v-else class="home-view-card__badge">
      <AppTag :tone="match.stageTone" size="sm">{{ match.stage }}</AppTag>
    </view>
  </view>

  <!-- 待处理：报名型富卡，与最近要处理叠卡同一信息密度。 -->
  <view
    v-else
    :class="[
      'home-match-card',
      isNavigating ? 'home-match-card-tapping' : '',
    ]"
    :hover-class="match.canOpenDetail ? 'home-match-card-pressed' : 'none'"
    @tap="handleTap"
  >
    <view class="home-match-date">
      <text class="home-match-month">{{ match.dateBlock.monthDay }}</text>
      <text class="home-match-weekday">{{ match.dateBlock.weekday }}</text>
      <view class="home-match-time-chip">
        <text class="home-match-time">{{ match.dateBlock.timeLabel }}</text>
        <text class="home-match-time-note">{{ match.dateNote }}</text>
      </view>
    </view>

    <view class="home-match-body">
      <view class="home-match-title-row">
        <text class="home-match-title">{{ match.title }}</text>
        <view class="home-match-tags">
          <AppTag tone="muted">
            {{ match.publicationModeLabel }}
          </AppTag>
          <AppTag :tone="match.stageTone">
            {{ match.stage }}
          </AppTag>
        </view>
      </view>
      <text class="home-match-meta">{{ match.venue }}</text>
      <text class="home-match-meta">{{ match.formatLabel }} · 对手 {{ match.opponent }}</text>

      <AppProgress
        v-if="match.showRegistrationProgress"
        class="home-ui-progress"
        label="报名进度"
        :value="match.joinedPlayers"
        :target="match.requiredPlayers"
        :max="match.maxPlayers || match.requiredPlayers"
        :value-text="`${match.joinedPlayers}/${match.requiredPlayers}`"
      />

      <view v-if="match.showParticipantAvatars" class="home-avatars-row">
        <view class="home-avatars">
          <ExpandableAvatarStack
            v-if="match.participantAvatars.length > 0"
            :items="participantItems"
            :key="match.id"
            :interactive="false"
            size="xs"
          />
          <view v-else class="home-avatars-empty">
            <view class="home-avatars-empty-badge" />
            <text class="home-avatars-empty-text">暂时没有球星报名</text>
          </view>
        </view>
        <text v-if="match.phase !== 'ended'" class="home-avatar-summary">{{ match.remainingPlayersLabel }}</text>
      </view>

      <view class="home-match-bottom">
        <AppTag v-if="isGuestMode" tone="blue" size="lg">登录后报名</AppTag>
        <AppTag v-else-if="match.myStatus" :tone="match.statusTone" size="lg">
          我的状态：{{ match.myStatus }}
        </AppTag>
        <AppTag v-else tone="blue" size="lg">加入球队后可报名</AppTag>

        <AppButton
          class="home-ui-match-button"
          :variant="match.canRegister ? 'dark' : 'outline'"
          :stop-propagation="false"
        >
          {{ actionLabel }}
        </AppButton>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* ===== 查看型紧凑卡（进行中/已结束） ===== */
.home-view-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx 26rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-sizing: border-box;
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out), background-color var(--ui-motion-press-duration) ease;
}

.home-view-card--pressed,
.home-view-card--tapping {
  transform: scale(0.98);
  background: var(--ui-color-neutral-bg);
}

.home-view-card__main {
  flex: 1;
  min-width: 0;
}

.home-view-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.home-view-card__title {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  line-height: 1.35;
  color: var(--ui-color-text);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.home-view-card__meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: var(--ui-color-text-muted);
  overflow-wrap: anywhere;
}

.home-view-card__score {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.4;
  color: var(--ui-color-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.home-view-card__badge {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  line-height: 0;
  white-space: nowrap;
}

.home-view-card__detail {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 12rpx;
  min-height: 72rpx;
  padding: 0 20rpx;
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
  margin: 0;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-text);
  line-height: 1;
  transition: background-color var(--ui-motion-press-duration) ease;
}
.home-view-card__detail::after { border: 0; }
.home-view-card__detail--pressed { background: var(--ui-color-accent); }
.home-view-card__chevron {
  flex-shrink: 0;
  width: 14rpx;
  height: 14rpx;
  border-top: 4rpx solid currentColor;
  border-right: 4rpx solid currentColor;
  transform: translateX(-3rpx) rotate(45deg);
}

/* ===== 报名型富卡（待处理） ===== */
.home-match-card {
  display: flex;
  gap: 18rpx;
  padding: 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-raised);
  box-sizing: border-box;
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out);
}

.home-match-card-pressed,
.home-match-card-tapping {
  transform: scale(0.98);
}

.home-match-date {
  display: flex;
  width: 150rpx;
  min-height: 246rpx;
  padding: 16rpx 14rpx;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-page);
  color: var(--ui-color-text);
  box-sizing: border-box;
}

.home-match-month {
  font-size: 28rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.home-match-weekday {
  margin-top: 8rpx;
  font-size: 46rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.home-match-time-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: auto;
  padding: 14rpx 6rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-accent);
  color: var(--ui-color-text);
}

.home-match-time {
  font-size: 36rpx;
  line-height: 1.05;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.home-match-time-note {
  margin-top: 6rpx;
  font-size: 20rpx;
  line-height: 1.25;
  font-weight: 400;
}

.home-match-body {
  flex: 1;
  min-width: 0;
}

.home-match-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.home-match-title {
  flex: 1;
  font-size: 32rpx;
  line-height: 1.32;
  color: var(--ui-color-text);
  font-weight: 600;
}

.home-match-tags {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.home-match-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: var(--ui-color-text-muted);
  font-weight: 400;
}

.home-ui-progress {
  margin-top: 20rpx;
  --ui-progress-meta-font-size: 26rpx;
  --ui-progress-track-margin-top: 10rpx;
}

.home-avatars-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 14rpx;
}

.home-avatars {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

/* 组件根节点占满可用宽度：+N 展开时按容器实测宽度计算头像间隙，
   保证满行两端与左右留白对齐。 */
.home-avatars :deep(.ui-avatar-stack) {
  width: 100%;
}

.home-avatar-summary {
  font-size: 24rpx;
  color: var(--ui-color-text-muted);
  font-weight: 500;
}

.home-avatars-empty {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.home-avatars-empty-badge {
  width: 42rpx;
  height: 42rpx;
  border: 2rpx dashed var(--ui-color-text-muted);
  border-radius: var(--ui-radius-round);
  box-sizing: border-box;
  flex-shrink: 0;
  opacity: 0.6;
}

.home-avatars-empty-text {
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home-match-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 22rpx;
}

.home-ui-match-button {
  min-width: 142rpx;
}

/* H5 减少动态效果：卡片按压只保留表面色反馈。 */
@media (prefers-reduced-motion: reduce) {
  .home-view-card,
  .home-view-card__detail,
  .home-match-card {
    transition: none;
  }

  .home-view-card--pressed,
  .home-view-card--tapping,
  .home-match-card-pressed,
  .home-match-card-tapping {
    transform: none;
  }
}
</style>
