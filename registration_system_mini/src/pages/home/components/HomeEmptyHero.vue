<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import type { OnboardingIllustrations } from "@/composables/useOnboardingIllustrations";
import { resolveHomeOnboardingIllustration } from "../homeOnboardingIllustration";
import type {
  HomeEmptyHeroAction,
  HomeEmptyHeroState,
} from "../homeEmptyHeroState";

const props = defineProps<{
  state: HomeEmptyHeroState;
  /** 「下一场还没安排」社交插画 URL（运行配置下发）；空串表示未配置，回退内置球场视觉。 */
  socialImageUrl?: string;
  onboardingImages?: OnboardingIllustrations;
  imageRevision?: number;
  collapsed?: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{
  (event: "browse"): void;
  (event: "create-team"): void;
  (event: "create-match"): void;
  (event: "create-pickup"): void;
  (event: "join-team"): void;
  (event: "invite-team"): void;
  (event: "view-team"): void;
  (event: "select-task", action: HomeEmptyHeroAction): void;
  (event: "reset-intent"): void;
  (event: "collapse"): void;
  (event: "expand"): void;
  (event: "help"): void;
}>();

// 配置或场景变化后重新尝试；失败回退内置球场，不遮挡任务入口。
const selectedImageUrl = computed(() => resolveHomeOnboardingIllustration(
  props.state,
  props.onboardingImages ?? { welcome: "", team: "", match: "" },
  props.socialImageUrl || "",
));
const socialImageFailed = ref(false);
watch(() => [selectedImageUrl.value, props.imageRevision], () => { socialImageFailed.value = false; });
const showSocialImage = computed(() => !!selectedImageUrl.value && !socialImageFailed.value);

const copy = computed(() => {
  switch (props.state.mode) {
    case "no-team-unknown":
    case "guest":
      return {
        kicker: "从这里开始",
        title: "你想先做什么？",
        description: "在这里组织球队、约球和报名比赛。",
      };
    case "no-team-captain":
      return {
        kicker: "先把球队建起来",
        title: "创建你的球队",
        description: "邀请队友加入，之后就能发起比赛、组织报名。",
      };
    case "no-team-player":
      return {
        kicker: "先找到一场球",
        title: "找一场球踢",
        description: "看看正在招人的比赛，或者自己发起一场散人约球。",
      };
    case "no-team-member":
      return {
        kicker: "下一步 · 加入球队",
        title: "找到你的球队",
        description: "搜索球队名称，或直接打开队友发来的邀请卡片。加入后就能跟队报名。",
      };
    case "team-manager":
      return props.state.actions[0] === "invite-team" ? {
        kicker: "下一步 · 邀请队友",
        title: "叫上队友，一起开踢",
        description: props.state.actions.includes("create-match")
          ? "把球队邀请发到群里，让大家加入。也可以先安排一场比赛。"
          : "把球队邀请发到群里，让大家加入。",
      } : {
        kicker: "安排下一场",
        title: "下一场还没安排",
        description: "约上队友，把下一场定下来。",
      };
    case "team-member":
      return {
        kicker: "看看下一场",
        title: "还没有待参加的比赛",
        description: "队长安排比赛后，会在首页显示报名入口。现在也可以去找其他比赛。",
      };
    default:
      return {
        kicker: "一起上场",
        title: "从一场球开始",
        description: "先看看有哪些比赛，登录后就能报名上场。",
      };
  }
});

function actionCopy(action: HomeEmptyHeroAction) {
  switch (action) {
    case "create-team":
      return {
        title: "创建我的球队",
        hint: "我来组织比赛、邀请队友",
        icon: "user-group",
      };
    case "join-team":
      return {
        title: "加入已有球队",
        hint: "队友已经在用，我来加入并报名",
        icon: "user-group",
      };
    case "invite-team":
      return {
        title: "邀请队友",
        hint: "进入球队页，点击分享邀请发给队友",
        icon: "user-group",
      };
    case "view-team":
      return { title: "查看我的球队", hint: "查看球队信息和成员", icon: "user-group" };
    case "create-match":
      return {
        title: "发起下一场比赛",
        hint: "定好时间，让队友直接报名",
        icon: "calendar-line",
      };
    case "create-pickup":
      return {
        title: "发起散人约球",
        hint: "自己定时间和球场，邀请球友报名",
        icon: "calendar-line",
      };
    default:
      return props.state.mode === "team-manager"
        ? {
            title: "去找对手",
            hint: "看看约队大厅里有没有合适的对手",
            icon: "search-line",
          }
        : {
            title: "找一场球踢",
            hint: "先看看可以参加的比赛，确认时间、地点和费用",
            icon: "search-line",
          };
  }
}

const balancedChoices = computed(() => (
  (props.state.mode === "no-team-unknown" || props.state.mode === "guest") && props.state.actions.length > 1
));
const canChangeTask = computed(() => props.state.mode.startsWith("no-team-") && !balancedChoices.value);
const primaryAction = computed(() => balancedChoices.value ? null : props.state.actions[0] ?? null);
const secondaryActions = computed(() => balancedChoices.value
  ? props.state.actions
  : props.state.actions.slice(1, 2));
const tertiaryAction = computed(() => balancedChoices.value ? null : props.state.actions[2] ?? null);

function emitAction(action: HomeEmptyHeroAction) {
  if (props.busy) return;
  if (balancedChoices.value) {
    emit("select-task", action);
    return;
  }
  switch (action) {
    case "join-team":
      emit("join-team");
      return;
    case "invite-team":
      emit("invite-team");
      return;
    case "view-team":
      emit("view-team");
      return;
    case "create-team":
      emit("create-team");
      return;
    case "create-match":
      emit("create-match");
      return;
    case "create-pickup":
      emit("create-pickup");
      return;
    default:
      emit("browse");
  }
}
</script>

<template>
  <view class="home-empty-hero-shell">
    <view v-if="collapsed" class="home-guide-collapsed">
      <text class="home-guide-collapsed__title">下一步怎么做？</text>
      <button class="home-guide-link" @tap="emit('expand')">展开指引</button>
      <button class="home-guide-link" @tap="emit('help')">使用帮助</button>
    </view>
    <AppSurface v-else variant="outlined" flush>
      <view class="home-empty-hero-intro">
        <view class="home-empty-hero-copy">
          <text class="home-empty-hero-kicker">{{ copy.kicker }}</text>
          <text class="home-empty-hero-title">{{ copy.title }}</text>
          <text class="home-empty-hero-description">{{ copy.description }}</text>
        </view>
        <view
          v-if="showSocialImage"
          class="home-empty-hero-art home-empty-hero-art--social"
          aria-hidden="true"
        >
          <image
            class="home-empty-social-image"
            :src="selectedImageUrl"
            mode="widthFix"
            @error="socialImageFailed = true"
          />
        </view>

        <view v-else class="home-empty-hero-art" aria-hidden="true">
          <view class="home-empty-hero-field">
            <view class="home-empty-hero-circle" />
            <view class="home-empty-hero-goal home-empty-hero-goal--top" />
            <view class="home-empty-hero-goal home-empty-hero-goal--bottom" />
          </view>
          <view class="home-empty-hero-ball" />
        </view>
      </view>

      <view v-if="primaryAction" class="home-empty-hero-primary">
        <AppButton block variant="lime" :disabled="busy" @click="emitAction(primaryAction)">
          {{ actionCopy(primaryAction).title }}
        </AppButton>
        <text class="home-empty-hero-primary-hint">{{ actionCopy(primaryAction).hint }}</text>
      </view>

      <view v-if="secondaryActions.length" class="home-empty-hero-actions">
        <button
          v-for="action in secondaryActions"
          :key="action"
          :disabled="busy"
          class="home-empty-hero-action"
          hover-class="home-empty-hero-action--pressed"
          @tap="emitAction(action)"
        >
          <view class="home-empty-hero-icon" aria-hidden="true">
            <wd-icon :name="actionCopy(action).icon" size="34rpx" />
          </view>
          <view class="home-empty-hero-action-copy">
            <text class="home-empty-hero-action-title">{{ actionCopy(action).title }}</text>
            <text class="home-empty-hero-action-hint">{{ actionCopy(action).hint }}</text>
          </view>
          <text class="home-empty-hero-arrow" aria-hidden="true">→</text>
        </button>
      </view>

      <button
        v-if="tertiaryAction"
        class="home-empty-hero-tertiary"
        hover-class="home-empty-hero-tertiary--pressed"
        @tap="emitAction(tertiaryAction)"
      >
        <text>{{ actionCopy(tertiaryAction).title }}</text>
        <text aria-hidden="true">→</text>
      </button>
      <text v-if="balancedChoices" class="home-guide-invite-hint">已有邀请？直接打开队友发来的邀请卡片。</text>
      <view class="home-guide-footer">
        <button v-if="canChangeTask" class="home-guide-link" @tap="emit('reset-intent')">换个方式开始</button>
        <button class="home-guide-link" @tap="emit('help')">使用帮助</button>
        <button class="home-guide-link" @tap="emit('collapse')">收起指引</button>
      </view>
    </AppSurface>
  </view>
</template>

<style scoped>
.home-guide-collapsed,
.home-guide-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx;
  padding: 12rpx 20rpx;
}

.home-guide-collapsed {
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
}

.home-guide-collapsed__title {
  flex: 1;
  color: var(--ui-color-text);
  font-size: 26rpx;
}

.home-guide-footer {
  border-top: var(--ui-border-default);
  justify-content: flex-end;
}

.home-guide-link {
  margin: 0;
  padding: 16rpx 10rpx;
  border: 0;
  background: transparent;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.home-guide-link::after { border: 0; }

.home-guide-invite-hint {
  display: block;
  padding: 8rpx 28rpx 24rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

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

.home-empty-hero-art--social {
  display: flex;
  flex-basis: 184rpx;
  height: 144rpx;
  align-items: center;
  justify-content: flex-end;
}

.home-empty-social-image {
  display: block;
  width: 184rpx;
  height: auto;
}

.home-empty-hero-primary {
  padding: 26rpx 28rpx 24rpx;
}

.home-empty-hero-primary-hint {
  display: block;
  margin-top: 12rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
  text-align: center;
}

.home-empty-hero-actions {
  padding: 0 28rpx;
}

.home-empty-hero-primary + .home-empty-hero-actions {
  border-top: var(--ui-border-default);
}

.home-empty-hero-action {
  display: flex;
  align-items: center;
  gap: 20rpx;
  width: 100%;
  min-height: 128rpx;
  margin: 0;
  padding: 22rpx 0;
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

.home-empty-hero-tertiary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  width: 100%;
  min-height: 72rpx;
  margin: 0;
  padding: 12rpx 28rpx 20rpx;
  border: 0;
  background: var(--ui-color-surface);
  color: var(--ui-color-text-muted);
  font-size: 23rpx;
  line-height: 1.4;
}

.home-empty-hero-tertiary::after { border: 0; }
.home-empty-hero-tertiary--pressed { opacity: 0.65; }
</style>
