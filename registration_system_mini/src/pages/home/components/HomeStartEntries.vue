<script setup lang="ts">
import { computed, getCurrentInstance, ref } from "vue";
import { useMinioImages } from "@/composables/useMinioImages";
import { HOME_VISUAL_ASSETS } from "@/config/homeVisualAssets";
import type { HomeEmptyHeroAction } from "../homeEmptyHeroState";

type BentoAction = "browse" | "venue-map" | "create-team" | "join-team";

interface BentoItem {
  key: BentoAction;
  id: string;
  title: string;
  subtitle: string;
  image: string;
  icon: string;
  featured?: boolean;
  cropCover?: boolean;
}

const props = defineProps<{
  actions: HomeEmptyHeroAction[];
  busy?: boolean;
  showHero?: boolean;
}>();

const emit = defineEmits<{
  (event: "select-task", action: HomeEmptyHeroAction): void;
  (event: "help"): void;
}>();

const instance = getCurrentInstance();
// 漫游直接在此组件 scope 中查询入口 ID，不跨过子组件的样式/查询边界。
defineExpose({ getQueryScope: () => instance?.proxy });

const { minioImageSrc } = useMinioImages();
const failed = ref<Record<string, boolean>>({});

const catalog: Record<BentoAction, BentoItem> = {
  browse: {
    key: "browse",
    id: "home-onboarding-browse",
    title: "找一场野球踢",
    subtitle: "散人约球 · 球队接约",
    image: HOME_VISUAL_ASSETS.findGame,
    icon: "search-line",
    featured: true,
  },
  "venue-map": {
    key: "venue-map",
    id: "home-entry-venue-map",
    title: "球场地图",
    subtitle: "常用绿茵场 · 导航",
    image: HOME_VISUAL_ASSETS.venueMap,
    icon: "location",
    featured: true,
    cropCover: true,
  },
  "create-team": {
    key: "create-team",
    id: "home-onboarding-create-team",
    title: "创建我的球队",
    subtitle: "建队招募 · 队费账本",
    image: HOME_VISUAL_ASSETS.createTeam,
    icon: "user-group",
  },
  "join-team": {
    key: "join-team",
    id: "home-onboarding-join-team",
    title: "加入已有球队",
    subtitle: "搜队名或打开邀请卡",
    image: HOME_VISUAL_ASSETS.joinTeam,
    icon: "user-group",
  },
};

const entries = computed<BentoItem[]>(() => {
  const ordered: BentoAction[] = ["browse", "venue-map"];
  if (props.actions.includes("create-team")) ordered.push("create-team");
  if (props.actions.includes("join-team")) ordered.push("join-team");
  return ordered.map((key) => catalog[key]);
});

function imageSrc(url: string): string {
  return failed.value[url] ? "" : minioImageSrc(url);
}

function imageError(url: string) {
  if (minioImageSrc(url)) failed.value[url] = true;
}

function handleTap(key: BentoAction) {
  if (props.busy) return;
  if (key === "venue-map") {
    uni.navigateTo({ url: "/pages/venues/map" });
    return;
  }
  emit("select-task", key);
}
</script>

<template>
  <view class="home-bento-section">
    <!-- 无待处理比赛或新手漫游时展示紧凑引导横幅 -->
    <view v-if="showHero" class="home-bento-hero ui-card-panel ui-card-panel--flush">
      <view class="home-bento-hero__inner">
        <image
          v-if="imageSrc(HOME_VISUAL_ASSETS.hero)"
          class="home-bento-hero__bg"
          :src="imageSrc(HOME_VISUAL_ASSETS.hero)"
          mode="aspectFill"
          aria-hidden="true"
          @error="imageError(HOME_VISUAL_ASSETS.hero)"
        />
        <view class="home-bento-hero__shade" />
        <view class="home-bento-hero__row">
          <view class="home-bento-hero__copy">
            <text class="home-bento-hero__kicker">绿茵赛事管家</text>
            <text class="home-bento-hero__title">开启下一场绿茵较量</text>
            <text class="home-bento-hero__desc">组织球队、发起约球，或探索附近常踢球场</text>
          </view>
          <button class="home-bento-hero__help" hover-class="home-bento-hero__help--pressed" @tap="emit('help')">
            <wd-icon name="question-circle" size="var(--ui-icon-xs)" />
            <text>使用帮助</text>
          </button>
        </view>
      </view>
    </view>

    <!-- 2×2 紧凑 Bento 金刚区（整合找球踢、球场地图、创建球队、加入球队） -->
    <view class="home-bento-grid">
      <button
        v-for="entry in entries"
        :id="entry.id"
        :key="entry.key"
        class="home-bento-card"
        :class="{ 'home-bento-card--featured': entry.featured }"
        :disabled="busy"
        hover-class="home-bento-card--pressed"
        @tap="handleTap(entry.key)"
      >
        <view
          class="home-bento-card__art"
          :class="{
            'home-bento-card__art--featured': entry.featured,
            'home-bento-card__art--map': entry.cropCover,
          }"
          aria-hidden="true"
        >
          <image
            v-if="imageSrc(entry.image)"
            class="home-bento-card__img"
            :class="{ 'home-bento-card__img--cover': entry.cropCover }"
            :src="imageSrc(entry.image)"
            :mode="entry.cropCover ? 'aspectFill' : 'aspectFit'"
            @error="imageError(entry.image)"
          />
          <wd-icon v-else :name="entry.icon" size="var(--ui-icon-lg)" />
        </view>
        <view class="home-bento-card__copy">
          <text class="home-bento-card__title">{{ entry.title }}</text>
          <text class="home-bento-card__subtitle">{{ entry.subtitle }}</text>
        </view>
      </button>
    </view>
  </view>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";

.home-bento-section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.home-bento-hero {
  overflow: hidden;
  border-radius: var(--ui-card-radius);
}

.home-bento-hero__inner {
  position: relative;
  overflow: hidden;
  padding: var(--ui-space-6) var(--ui-space-6);
  background: var(--ui-color-hero);
  color: var(--now-cover-fg);
  box-sizing: border-box;
}

.home-bento-hero__bg,
.home-bento-hero__shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.home-bento-hero__shade {
  background: var(--now-cover-shade);
}

.home-bento-hero__row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4);
}

.home-bento-hero__copy {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.home-bento-hero__kicker {
  color: var(--ui-color-accent);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-weight-heading);
  line-height: var(--ui-line-height-compact);
}

.home-bento-hero__title {
  margin-top: var(--ui-space-1);
  font-size: var(--ui-text-heading);
  font-weight: var(--ui-font-weight-heading);
  line-height: var(--ui-line-height-tight);
}

.home-bento-hero__desc {
  margin-top: var(--ui-space-1);
  color: var(--now-cover-muted);
  font-size: var(--ui-text-xs);
  line-height: var(--ui-line-height-compact);
}

.home-bento-hero__help {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--ui-space-1);
  height: var(--ui-space-10);
  margin: 0;
  padding: 0 var(--ui-space-4);
  border-radius: var(--ui-radius-round);
  background: var(--now-cover-label-bg);
  color: var(--now-cover-fg);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-weight-medium);
  line-height: 1;
}

.home-bento-hero__help::after {
  border: 0;
}

.home-bento-hero__help--pressed {
  opacity: 0.85;
}

.home-bento-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-4);
}

.home-bento-card {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4);
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: var(--ui-space-4) var(--ui-space-5);
  border: var(--ui-panel-border);
  border-radius: var(--ui-card-radius);
  background: var(--ui-card-bg);
  box-shadow: var(--ui-card-shadow);
  color: var(--ui-color-text);
  text-align: left;
  line-height: var(--ui-line-height-compact);
  box-sizing: border-box;
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out), background-color var(--ui-motion-press-duration) ease;
}

.home-bento-card::after {
  border: 0;
}

.home-bento-card--pressed {
  transform: scale(0.98);
  background: var(--ui-color-accent-subtle);
}

.home-bento-card__art {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  overflow: hidden;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-neutral-bg);
}

.home-bento-card__art--featured {
  width: 84rpx;
  height: 84rpx;
  background: var(--ui-color-accent-soft);
}

.home-bento-card__art--map {
  background: var(--ui-home-ready-bg);
}

.home-bento-card__img {
  width: 60rpx;
  height: 60rpx;
}

.home-bento-card--featured .home-bento-card__img {
  width: 72rpx;
  height: 72rpx;
}

.home-bento-card__img--cover {
  width: 100%;
  height: 100%;
  transform: scale(1.22);
}

.home-bento-card__copy {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: var(--ui-space-1);
}

.home-bento-card__title {
  overflow: hidden;
  color: var(--ui-color-text);
  font-size: var(--ui-text-label);
  font-weight: var(--ui-font-weight-heading);
  line-height: var(--ui-line-height-tight);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.home-bento-card--featured .home-bento-card__title {
  font-size: var(--ui-text-subtitle);
}

.home-bento-card__subtitle {
  overflow: hidden;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-xs);
  line-height: var(--ui-line-height-compact);
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
