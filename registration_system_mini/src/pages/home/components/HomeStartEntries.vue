<script setup lang="ts">
import { computed, getCurrentInstance, ref } from "vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import { useMinioImages } from "@/composables/useMinioImages";
import { HOME_VISUAL_ASSETS } from "@/config/homeVisualAssets";
import type { HomeEmptyHeroAction } from "../homeEmptyHeroState";

const props = defineProps<{ actions: HomeEmptyHeroAction[]; busy?: boolean }>();
const emit = defineEmits<{
  (event: "select-task", action: HomeEmptyHeroAction): void;
  (event: "help"): void;
}>();
const instance = getCurrentInstance();
// 漫游直接在此组件 scope 中查询入口 ID，不跨过子组件的样式/查询边界。
defineExpose({ getQueryScope: () => instance?.proxy });
const { minioImageSrc } = useMinioImages();
const failed = ref<Record<string, boolean>>({});
const choices: Partial<Record<HomeEmptyHeroAction, { title: string; image: string; icon: string }>> = {
  "create-team": { title: "创建我的球队", image: HOME_VISUAL_ASSETS.createTeam, icon: "user-group" },
  "join-team": { title: "加入已有球队", image: HOME_VISUAL_ASSETS.joinTeam, icon: "user-group" },
  browse: { title: "找一场球踢", image: HOME_VISUAL_ASSETS.findGame, icon: "search-line" },
};
const entries = computed(() => props.actions.flatMap(action => {
  const choice = choices[action];
  return choice ? [{ action, ...choice }] : [];
}));
function imageSrc(url: string): string { return failed.value[url] ? "" : minioImageSrc(url); }
function imageError(url: string) { if (minioImageSrc(url)) failed.value[url] = true; }
function select(action: HomeEmptyHeroAction) { if (!props.busy) emit("select-task", action); }
</script>

<template>
  <AppSurface variant="outlined" flush>
    <view class="home-start">
      <view class="home-start__hero">
        <image v-if="imageSrc(HOME_VISUAL_ASSETS.hero)" class="home-start__background" :src="imageSrc(HOME_VISUAL_ASSETS.hero)" mode="aspectFill" aria-hidden="true" @error="imageError(HOME_VISUAL_ASSETS.hero)" />
        <view class="home-start__shade" />
        <view class="home-start__copy">
          <text class="home-start__kicker">从这里开始</text>
          <text class="home-start__title">你想先做什么？</text>
          <text class="home-start__description">在这里组织球队、约球和报名比赛。</text>
        </view>
      </view>
      <view class="home-start__entries">
        <button v-for="entry in entries" :id="`home-onboarding-${entry.action}`" :key="entry.action" class="home-start__entry" :disabled="busy" hover-class="home-start__entry--pressed" @tap="select(entry.action)">
          <view class="home-start__art" aria-hidden="true">
            <view class="home-start__art-backdrop" />
            <image v-if="imageSrc(entry.image)" class="home-start__illustration" :src="imageSrc(entry.image)" mode="aspectFit" @error="imageError(entry.image)" />
            <wd-icon v-else :name="entry.icon" size="48rpx" />
          </view>
          <text class="home-start__entry-title">{{ entry.title }}</text>
        </button>
      </view>
      <view class="home-start__footer">
        <text class="home-start__hint">已有邀请？直接打开队友发来的邀请卡片。</text>
        <button class="home-start__help" hover-class="home-start__help--pressed" @tap="emit('help')">
          <wd-icon name="question-circle" size="26rpx" /><text>使用帮助</text>
        </button>
      </view>
    </view>
  </AppSurface>
</template>

<style scoped>
.home-start__hero { position: relative; overflow: hidden; min-height: 242rpx; padding: 38rpx 28rpx; box-sizing: border-box; background: var(--ui-color-hero); color: var(--now-cover-fg); }
.home-start__background, .home-start__shade { position: absolute; inset: 0; width: 100%; height: 100%; }
/* 照片遮罩使用既有封面语义，确保五个主题上白色文案均有足够对比度。 */
.home-start__shade { background: var(--now-cover-shade); }
.home-start__copy { position: relative; display: flex; flex-direction: column; align-items: flex-start; }
.home-start__kicker { font-size: 22rpx; line-height: 1.4; color: var(--now-cover-muted); }
.home-start__title { margin-top: 12rpx; font-size: 38rpx; font-weight: var(--ui-font-weight-heading); line-height: 1.35; }
.home-start__description { margin-top: 16rpx; font-size: 24rpx; line-height: 1.6; color: var(--now-cover-muted); }
.home-start__entries { display: flex; gap: 12rpx; padding: 20rpx 20rpx 12rpx; }
.home-start__entry { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 10rpx; width: 0; min-width: 0; margin: 0; padding: 16rpx 6rpx 22rpx; border: var(--ui-border-default); border-radius: var(--ui-radius-button); background: var(--ui-color-surface); color: var(--ui-color-text); line-height: 1.4; box-sizing: border-box; }
.home-start__entry::after, .home-start__help::after { border: 0; }
.home-start__entry--pressed { box-shadow: var(--ui-shadow-control-pressed); }
.home-start__art { position: relative; display: flex; align-items: center; justify-content: center; width: 140rpx; height: 132rpx; }
.home-start__art-backdrop { position: absolute; width: 118rpx; height: 118rpx; border-radius: var(--ui-radius-round); background: var(--ui-color-accent-soft); }
.home-start__illustration { position: relative; width: 140rpx; height: 132rpx; }
.home-start__entry-title { font-size: 26rpx; font-weight: var(--ui-font-weight-heading); white-space: nowrap; }
.home-start__footer { display: flex; align-items: center; gap: 12rpx; padding: 10rpx 24rpx 22rpx; }
.home-start__hint { flex: 1; min-width: 0; font-size: 21rpx; line-height: 1.5; color: var(--ui-color-text-muted); }
.home-start__help { display: flex; align-items: center; flex-shrink: 0; gap: 6rpx; min-height: 56rpx; margin: 0; padding: 0; background: transparent; color: var(--ui-color-text-muted); font-size: 22rpx; line-height: 1.4; }
.home-start__help--pressed { color: var(--ui-color-text); }
</style>
