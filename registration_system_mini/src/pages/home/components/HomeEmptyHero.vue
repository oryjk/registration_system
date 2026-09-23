<script setup lang="ts">
import { computed } from "vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import type { HomeEmptyHeroState } from "../homeEmptyHeroState";

const props = defineProps<{
  state: HomeEmptyHeroState;
}>();

const emit = defineEmits<{
  (event: "browse"): void;
  (event: "create-team"): void;
  (event: "create-match"): void;
}>();

const copy = computed(() => {
  if (props.state.audience === "guest") {
    return {
      kicker: "一起上场",
      title: "好球，等你上场",
      description: "发现一场比赛，认识一起踢球的人。",
      browseHint: "看看有哪些比赛可以参加",
    };
  }
  if (props.state.audience === "no-team") {
    return {
      kicker: "找到你的球友",
      title: "一起踢，才尽兴",
      description: "从一场球开始，把热爱变成默契。",
      browseHint: "发现比赛，找到一起踢的人",
    };
  }
  return {
    kicker: "和队友一起上场",
    title: "下一场，约起来",
    description: "新的对手，熟悉的队友，再踢一场。",
    browseHint: "发现比赛，寻找新对手",
  };
});

const secondaryCopy = computed(() => props.state.secondaryAction === "create-team"
  ? { title: "创建球队", hint: "组建自己的队伍，邀朋友加入", icon: "user-group" }
  : { title: "发起比赛", hint: "定好时间，邀请队友报名", icon: "calendar-line" });

function handleSecondaryAction() {
  if (props.state.secondaryAction === "create-team") {
    emit("create-team");
  } else if (props.state.secondaryAction === "create-match") {
    emit("create-match");
  }
}
</script>

<template>
  <view class="home-empty-hero-shell">
    <AppSurface variant="outlined" flush>
      <view class="home-empty-hero-intro">
        <view class="home-empty-hero-copy">
          <text class="home-empty-hero-kicker">{{ copy.kicker }}</text>
          <text class="home-empty-hero-title">{{ copy.title }}</text>
          <text class="home-empty-hero-description">{{ copy.description }}</text>
        </view>
        <view class="home-empty-hero-art" aria-hidden="true">
          <view class="home-empty-hero-field">
            <view class="home-empty-hero-circle" />
            <view class="home-empty-hero-goal home-empty-hero-goal--top" />
            <view class="home-empty-hero-goal home-empty-hero-goal--bottom" />
          </view>
          <view class="home-empty-hero-ball" />
        </view>
      </view>
      <view class="home-empty-hero-actions">
        <button
          class="home-empty-hero-action"
          hover-class="home-empty-hero-action--pressed"
          @tap="emit('browse')"
        >
          <view class="home-empty-hero-icon" aria-hidden="true">
            <wd-icon name="search-line" size="34rpx" />
          </view>
          <view class="home-empty-hero-action-copy">
            <text class="home-empty-hero-action-title">去约队大厅</text>
            <text class="home-empty-hero-action-hint">{{ copy.browseHint }}</text>
          </view>
          <text class="home-empty-hero-arrow" aria-hidden="true">→</text>
        </button>
        <button
          v-if="state.secondaryAction"
          class="home-empty-hero-action"
          hover-class="home-empty-hero-action--pressed"
          @tap="handleSecondaryAction"
        >
          <view class="home-empty-hero-icon" aria-hidden="true">
            <wd-icon :name="secondaryCopy.icon" size="34rpx" />
          </view>
          <view class="home-empty-hero-action-copy">
            <text class="home-empty-hero-action-title">{{ secondaryCopy.title }}</text>
            <text class="home-empty-hero-action-hint">{{ secondaryCopy.hint }}</text>
          </view>
          <text class="home-empty-hero-arrow" aria-hidden="true">→</text>
        </button>
      </view>
    </AppSurface>
  </view>
</template>

<style scoped>
.home-empty-hero-intro {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 32rpx 28rpx;
  background: var(--ui-color-hero);
  color: var(--ui-color-hero-fg);
}

.home-empty-hero-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.home-empty-hero-kicker {
  color: var(--ui-color-hero-fg);
  font-size: 22rpx;
  line-height: 1.4;
  opacity: 0.75;
}

.home-empty-hero-title {
  margin-top: 10rpx;
  font-size: 38rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.3;
}

.home-empty-hero-description {
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.6;
  opacity: 0.85;
}

.home-empty-hero-art {
  position: relative;
  flex: 0 0 100rpx;
  height: 144rpx;
}

.home-empty-hero-field {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border: 2rpx solid currentColor;
  border-radius: var(--ui-radius-md);
  opacity: 0.3;
}

.home-empty-hero-field::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 2rpx solid currentColor;
}

.home-empty-hero-circle {
  position: absolute;
  width: 36rpx;
  height: 36rpx;
  left: 50%;
  top: 50%;
  border: 2rpx solid currentColor;
  border-radius: var(--ui-radius-round);
  transform: translate(-50%, -50%);
}

.home-empty-hero-goal {
  position: absolute;
  left: 25%;
  width: 50%;
  height: 22rpx;
  border: 2rpx solid currentColor;
  box-sizing: border-box;
}

.home-empty-hero-goal--top { top: -2rpx; }
.home-empty-hero-goal--bottom { bottom: -2rpx; }

.home-empty-hero-ball {
  position: absolute;
  right: 18rpx;
  bottom: 36rpx;
  width: 14rpx;
  height: 14rpx;
  background: var(--ui-color-accent);
  border-radius: var(--ui-radius-round);
}

.home-empty-hero-actions {
  padding: 0 28rpx;
}

.home-empty-hero-action {
  display: flex;
  align-items: center;
  gap: 20rpx;
  width: 100%;
  min-height: 136rpx;
  margin: 0;
  padding: 24rpx 0;
  border: 0;
  border-radius: 0;
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  text-align: left;
  line-height: 1.4;
  box-sizing: border-box;
  transition: opacity var(--ui-motion-press-duration) var(--ui-motion-ease-out);
}

.home-empty-hero-action::after { border: 0; }

.home-empty-hero-action + .home-empty-hero-action {
  border-top: var(--ui-border-default);
}

.home-empty-hero-action--pressed { opacity: 0.65; }

.home-empty-hero-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 68rpx;
  height: 68rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-text);
}

.home-empty-hero-action-copy {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 6rpx;
}

.home-empty-hero-action-title {
  font-size: 30rpx;
  font-weight: var(--ui-font-weight-heading);
}

.home-empty-hero-action-hint {
  font-size: 22rpx;
  color: var(--ui-color-text-muted);
}

.home-empty-hero-arrow {
  flex-shrink: 0;
  font-size: 32rpx;
}
</style>
