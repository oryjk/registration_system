<script setup lang="ts">
import { computed } from "vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import { defaultMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import type { BackendMiniAppHomeHeroBanner } from "@/types/backend";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { parseDateValue } from "@/utils/datetime";

const props = withDefaults(
  defineProps<{
    heroBanners: BackendMiniAppHomeHeroBanner[];
    /** 有最近要处理的比赛时，banner 位替换为「下一场比赛」动态卡；为空回退品牌 banner。 */
    nextMatch?: HomeMatchCardViewModel | null;
  }>(),
  {
    nextMatch: null,
  },
);

const emit = defineEmits<{
  (event: "bannerTap"): void;
  (event: "matchTap", match: HomeMatchCardViewModel): void;
}>();

function handlePress() {
  if (props.nextMatch) {
    emit("matchTap", props.nextMatch);
    return;
  }
  emit("bannerTap");
}

const visibleHeroBanners = computed(() => {
  const banners = props.heroBanners
    .filter((banner) => banner.enabled && banner.title.trim())
    .sort((left, right) => left.sort_order - right.sort_order);
  return banners.length > 0 ? banners : defaultMiniAppRuntimeConfig.home.hero_banners;
});

const nextMatchCountdown = computed(() => {
  const match = props.nextMatch;
  if (!match?.dateSource) return "";
  const diffMs = parseDateValue(match.dateSource).getTime() - Date.now();
  if (diffMs <= 0) return "即将开始";
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "今天";
  if (days < 2) return "明天";
  return `${days} 天后`;
});

const nextMatchMeta = computed(() => {
  const match = props.nextMatch;
  if (!match) return "";
  const venue = match.venue?.trim() || "地点待定";
  return `${match.dateLabel} · ${venue} · 对手 ${match.opponent}`;
});
</script>

<template>
  <NeoSurface
    class="home-hero-shell"
    variant="raised"
    interactive
    flush
    @press="handlePress"
  >
    <!-- 有最近要处理的比赛时，品牌 banner 让位给「下一场比赛」动态卡。 -->
    <view v-if="nextMatch" class="home-banner home-nextmatch">
      <view class="home-nextmatch-copy">
        <text class="home-nextmatch-kicker">下一场比赛{{ nextMatchCountdown ? ` · ${nextMatchCountdown}` : "" }}</text>
        <text class="home-nextmatch-title">{{ nextMatch.title }}</text>
        <text class="home-nextmatch-meta">{{ nextMatchMeta }}</text>
        <view class="home-nextmatch-row">
          <text v-if="nextMatch.myStatus" class="home-nextmatch-status">我的状态：{{ nextMatch.myStatus }}</text>
          <view class="home-banner-button home-nextmatch-button">{{ nextMatch.actionLabel }}</view>
        </view>
      </view>
      <view class="home-banner-ball home-nextmatch-ball" />
    </view>

    <swiper
      v-else-if="visibleHeroBanners.length > 1"
      class="home-banner-swiper"
      circular
      autoplay
      :interval="4200"
      :duration="420"
    >
      <swiper-item v-for="banner in visibleHeroBanners" :key="`${banner.sort_order}-${banner.title}`">
        <view class="home-banner">
          <image
            v-if="banner.image_url"
            class="home-banner-image"
            :src="banner.image_url"
            mode="aspectFill"
          />
          <view class="home-banner-image-mask" />
          <view class="home-banner-copy">
            <text class="home-banner-title">{{ banner.title }}</text>
            <text class="home-banner-subtitle">{{ banner.subtitle }}</text>
            <view class="home-banner-button">{{ banner.button_text }}</view>
          </view>
          <template v-if="!banner.image_url">
            <view class="home-banner-goal">GOAL!</view>
            <view class="home-banner-net" />
            <view class="home-banner-ball" />
          </template>
        </view>
      </swiper-item>
    </swiper>

    <view v-else class="home-banner">
      <image
        v-if="visibleHeroBanners[0]?.image_url"
        class="home-banner-image"
        :src="visibleHeroBanners[0].image_url"
        mode="aspectFill"
      />
      <view class="home-banner-image-mask" />
      <view class="home-banner-copy">
        <text class="home-banner-title">{{ visibleHeroBanners[0]?.title }}</text>
        <text class="home-banner-subtitle">{{ visibleHeroBanners[0]?.subtitle }}</text>
        <view class="home-banner-button">{{ visibleHeroBanners[0]?.button_text }}</view>
      </view>
      <template v-if="!visibleHeroBanners[0]?.image_url">
        <view class="home-banner-goal">GOAL!</view>
        <view class="home-banner-net" />
        <view class="home-banner-ball" />
      </template>
    </view>
  </NeoSurface>
</template>

<style scoped>
.home-hero-shell {
  position: relative;
  margin-top: 18rpx;
  background: var(--neo-color-hero);
}

.home-banner-swiper {
  height: 242rpx;
}

.home-banner {
  position: relative;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  overflow: hidden;
  margin-top: 0;
  min-height: 194rpx;
  padding: 24rpx 24rpx;
  background: var(--neo-color-hero);
}

.home-banner-swiper .home-banner {
  margin-top: 0;
  height: 194rpx;
}

.home-banner::before {
  /* Decorative asset colors intentionally stay local to the illustration. */
  content: "";
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 253, 248, 0.08) 2rpx, transparent 2rpx), linear-gradient(90deg, rgba(255, 253, 248, 0.08) 2rpx, transparent 2rpx);
  background-size: 22rpx 22rpx;
  opacity: 0.28;
}

.home-banner-image {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
}

.home-banner-image-mask {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(90deg, rgba(17, 19, 16, 0.78) 0%, rgba(17, 19, 16, 0.58) 54%, rgba(17, 19, 16, 0.3) 100%);
}

.home-banner-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.home-banner-title {
  font-size: 58rpx;
  line-height: 1.06;
  color: var(--neo-color-hero-fg);
  font-weight: 900;
  letter-spacing: 0;
}

.home-banner-subtitle {
  margin-top: 14rpx;
  font-size: 28rpx;
  line-height: 1.2;
  color: var(--neo-color-hero-fg);
  font-weight: 800;
}

.home-banner-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 136rpx;
  height: 54rpx;
  margin-top: 20rpx;
  padding: 0 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
  box-shadow: 3rpx 3rpx 0 var(--neo-color-hero-fg);
}

.home-banner-goal {
  position: absolute;
  top: 22rpx;
  right: 160rpx;
  z-index: 2;
  padding: 6rpx 10rpx;
  border: var(--neo-border-default);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-style: italic;
  font-weight: 800;
  transform: rotate(-10deg);
}

.home-banner-net {
  position: absolute;
  right: 12rpx;
  top: 14rpx;
  z-index: 1;
  width: 188rpx;
  height: 150rpx;
  background:
    linear-gradient(120deg, transparent 0 18%, rgba(255,253,248,0.86) 18% 20%, transparent 20% 38%, rgba(255,253,248,0.86) 38% 40%, transparent 40% 58%, rgba(255,253,248,0.86) 58% 60%, transparent 60% 100%),
    linear-gradient(90deg, transparent 0 18%, rgba(255,253,248,0.86) 18% 20%, transparent 20% 38%, rgba(255,253,248,0.86) 38% 40%, transparent 40% 58%, rgba(255,253,248,0.86) 58% 60%, transparent 60% 100%);
  opacity: 0.9;
  clip-path: polygon(18% 0, 100% 0, 100% 100%, 48% 100%);
}

.home-banner-ball {
  /* Decorative asset colors intentionally stay local to the illustration. */
  position: absolute;
  right: 30rpx;
  bottom: -10rpx;
  z-index: 2;
  width: 154rpx;
  height: 154rpx;
  border: var(--neo-border-strong);
  border-radius: 999rpx;
  background:
    radial-gradient(circle at 35% 35%, #ffffff 0%, #f4f2ea 38%, #1c231d 39%, #1c231d 48%, #e6e4dc 49%, #ffffff 62%, #d6d6d0 100%);
  box-shadow: inset -16rpx -18rpx 30rpx rgba(0, 0, 0, 0.18);
  transform: rotate(-18deg);
}

/* 「下一场比赛」动态卡：沿用 banner 深色底与网格，右侧足球缩小让位给文案。 */
.home-nextmatch {
  min-height: 208rpx;
}

.home-nextmatch-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding-right: 150rpx;
  box-sizing: border-box;
}

.home-nextmatch-kicker {
  color: var(--neo-color-hero-fg);
  font-size: 24rpx;
  font-weight: 800;
  opacity: 0.8;
}

.home-nextmatch-title {
  margin-top: 10rpx;
  color: var(--neo-color-hero-fg);
  font-size: 44rpx;
  line-height: 1.15;
  font-weight: 900;
}

.home-nextmatch-meta {
  margin-top: 10rpx;
  color: var(--neo-color-hero-fg);
  font-size: 24rpx;
  font-weight: 700;
  opacity: 0.85;
}

.home-nextmatch-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 20rpx;
}

.home-nextmatch-status {
  padding: 8rpx 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 22rpx;
  font-weight: 800;
}

.home-nextmatch-button {
  margin-top: 0;
}

.home-nextmatch-ball {
  top: 18rpx;
  right: 20rpx;
  bottom: auto;
  width: 110rpx;
  height: 110rpx;
}
</style>
