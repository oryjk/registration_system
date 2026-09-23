<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import { useAccentTheme } from "@/stores/theme";
import { ensureSessionReady } from "@/stores/appSession";
import { useTeamContext } from "@/stores/teamContext";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";
import { buildVenueMatchCreateUrl } from "@/utils/venueMatchPreset";
import { hasManualLogout } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import { openVenueLocation } from "@/utils/venueLocation";
import { getVenueMap } from "@/api/venue";
import VenueCooperationEntry from "./VenueCooperationEntry.vue";
import { filterVenueMapPoints, toVenueMapPoints, type VenueMapPoint } from "./venueMapState";

const { themePageStyle } = useAccentTheme();
const { currentTeam, currentIdentity } = useTeamContext();
const { shouldHideCreationEntrances } = useMiniReviewStatus();
const canCreateMatch = computed(() => !!currentIdentity.value && !!currentTeam.value?.canManageTeam && !shouldHideCreationEntrances.value);
const navigatingToCreate = ref(false);
function createMatchHere() {
  if (!selected.value || !canCreateMatch.value || navigatingToCreate.value) return;
  navigatingToCreate.value = true;
  uni.navigateTo({
    url: buildVenueMatchCreateUrl({ location: selected.value.location, latitude: selected.value.latitude, longitude: selected.value.longitude }),
    complete: () => { navigatingToCreate.value = false; },
    fail: () => { uni.showToast({ title: "暂时无法打开创建页面，请重试", icon: "none" }); },
  });
}
const pagePadding = { paddingTop: `${getCustomNavMetrics().pageTopPadding + 8}px` };
const venues = ref<VenueMapPoint[]>([]);
const query = ref("");
const selectedId = ref<number | null>(null);
const loading = ref(true);
const error = ref("");
const loginRequired = ref(false);
const mapError = ref(false);
const contactRendered = ref(false);
const filtered = computed(() => filterVenueMapPoints(venues.value, query.value));
const selected = computed(() => filtered.value.find((venue) => venue.id === selectedId.value) ?? null);
const center = computed(() => selected.value ?? filtered.value[0]);
const points = computed(() => (selected.value ? [selected.value] : filtered.value).map(({ latitude, longitude }) => ({ latitude, longitude })));
const markers = computed(() => filtered.value.map((venue) => ({
  id: venue.id,
  latitude: venue.latitude,
  longitude: venue.longitude,
  iconPath: "/static/icons/lucide/map-pin-filled-green.png",
  width: selectedId.value === venue.id ? 40 : 28,
  height: selectedId.value === venue.id ? 40 : 28,
  ...(selectedId.value === venue.id ? { callout: { content: venue.location, display: "ALWAYS", padding: 8, borderRadius: 8 } } : {}),
})));
watch(query, () => { selectedId.value = null; });

async function load(forceLogin = false) {
  if (hasManualLogout() && !forceLogin) {
    loginRequired.value = true;
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    await Promise.all([ensureSessionReady(forceLogin), preloadMiniReviewStatus()]);
    loginRequired.value = false;
    venues.value = toVenueMapPoints(await getVenueMap());
    selectedId.value = null;
    mapError.value = false;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "球场加载失败，请重试";
  } finally {
    loading.value = false;
  }
}
function selectMarker(event: { detail: { markerId: number } }) {
  selectedId.value = Number(event.detail.markerId);
}
function showAll() {
  query.value = "";
  selectedId.value = null;
}
onLoad(() => { void load(); });
onShow(() => {
  if (loginRequired.value && !hasManualLogout() && !loading.value) void load();
});
</script>

<template>
  <page-meta :page-style="`${themePageStyle};overflow:hidden`" />
  <view class="app-theme-scope venue-map-page" :style="[themePageStyle, pagePadding]">
    <AppTabHeader title="球场地图" show-back />
    <view v-if="loading || loginRequired || error || !venues.length" class="venue-map-state">
      <view class="venue-map-state__icon"><wd-icon name="location" size="52rpx" /></view>
      <text class="venue-map-state__title">{{ loading ? '正在加载球场…' : loginRequired ? '登录后查看球场地图' : error ? '暂时无法加载球场' : '还没有已定位的球场' }}</text>
      <text class="venue-map-state__hint">{{ loading ? '整理已保存的球场位置' : error || '比赛中保存过的球场位置会显示在这里' }}</text>
      <view v-if="!loading && (loginRequired || error)" class="venue-map-state__action">
        <AppButton @click="load(loginRequired)">{{ loginRequired ? '登录后查看' : '重新加载' }}</AppButton>
      </view>
    </view>
    <template v-else>
      <view class="venue-map-tools">
        <view class="venue-map-search">
          <wd-icon name="search-line" size="30rpx" />
          <input v-model="query" class="venue-map-search__input" placeholder="搜索球场名称" placeholder-class="venue-map-placeholder" confirm-type="search" />
          <button v-if="query" class="venue-map-clear" aria-label="清空搜索" @tap="query = ''"><wd-icon name="close" size="26rpx" /></button>
        </view>
        <view class="venue-map-summary">
          <text>{{ query ? `找到 ${filtered.length} 个球场` : `已收录 ${venues.length} 个球场` }}</text>
          <button class="venue-map-all" @tap="showAll">查看全部</button>
        </view>
      </view>
      <view class="venue-map-canvas">
        <map
          v-if="center && !contactRendered"
          id="venue-map"
          class="venue-map-native"
          :latitude="center.latitude"
          :longitude="center.longitude"
          :scale="selected ? 15 : 11"
          :markers="markers"
          :include-points="points"
          @markertap="selectMarker"
          @callouttap="selectMarker"
          @error="mapError = true"
        />
        <view v-else-if="!center" class="venue-map-no-results">
          <wd-icon name="search-line" size="44rpx" />
          <text>没有找到这个球场</text>
          <text class="venue-map-state__hint">试试更短的名称，或查看全部球场</text>
        </view>
      </view>
      <view class="venue-map-panel" :class="{ 'venue-map-panel--with-cooperation': !shouldHideCreationEntrances }">
        <text v-if="mapError" class="venue-map-warning">地图暂时未能显示，可选择下方球场后打开地图查看。</text>
        <template v-if="selected">
          <text class="venue-map-panel__eyebrow">已选球场</text>
          <view class="venue-map-selection">
            <text class="venue-map-panel__title">{{ selected.location }}</text>
          </view>
          <view class="venue-map-selection-actions">
            <view class="venue-map-open"><AppButton variant="outline" @click="openVenueLocation(selected)">打开地图</AppButton></view>
            <view v-if="canCreateMatch" class="venue-map-create"><AppButton block :disabled="navigatingToCreate" @click="createMatchHere">在此创建比赛</AppButton></view>
          </view>
          <text v-if="!canCreateMatch && !shouldHideCreationEntrances" class="venue-map-panel__hint">队长或领队可在此创建比赛</text>
        </template>
        <template v-else>
          <text class="venue-map-panel__title">下一场，在哪踢？</text>
          <text class="venue-map-panel__hint">点击地图标记或下方球场，查看具体位置</text>
        </template>
        <scroll-view v-if="filtered.length" scroll-x class="venue-map-venues" :scroll-into-view="selected ? `venue-${selected.id}` : ''" scroll-with-animation>
          <view class="venue-map-venues__row">
            <button v-for="venue in filtered" :id="`venue-${venue.id}`" :key="venue.id" class="venue-map-chip" :class="{ 'venue-map-chip--selected': selectedId === venue.id }" @tap="selectedId = venue.id">
              {{ venue.location }}
            </button>
          </view>
        </scroll-view>
      </view>
    </template>
    <view v-if="!shouldHideCreationEntrances" class="venue-map-cooperation">
      <VenueCooperationEntry @presence="contactRendered = $event" />
    </view>
  </view>
</template>

<style scoped>
.venue-map-page { height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; background: var(--ui-color-page); color: var(--ui-color-text); }
.venue-map-tools { padding: 16rpx 28rpx 12rpx; flex-shrink: 0; }
.venue-map-search { display: flex; align-items: center; gap: 14rpx; height: 84rpx; padding: 0 20rpx; border: var(--ui-border-default); border-radius: var(--ui-radius-button); background: var(--ui-color-surface); color: var(--ui-color-text-muted); }
.venue-map-search__input { min-width: 0; flex: 1; height: 100%; font-size: 26rpx; color: var(--ui-color-text); }
.venue-map-placeholder { color: var(--ui-color-text-disabled); }
.venue-map-clear { display: flex; align-items: center; justify-content: center; width: 60rpx; height: 60rpx; padding: 0; margin: 0; background: transparent; color: var(--ui-color-text-muted); }
.venue-map-summary { display: flex; align-items: center; justify-content: space-between; font-size: 22rpx; color: var(--ui-color-text-muted); }
.venue-map-all { margin: 0; padding: 16rpx 0 16rpx 20rpx; background: transparent; color: var(--ui-color-text); font-size: 24rpx; line-height: 1.5; }
.venue-map-all::after, .venue-map-clear::after, .venue-map-chip::after { border: 0; }
.venue-map-canvas { flex: 1; min-height: 0; position: relative; background: var(--ui-color-neutral-bg); }
.venue-map-native { width: 100%; height: 100%; }
.venue-map-panel { flex-shrink: 0; padding: 26rpx 28rpx calc(env(safe-area-inset-bottom) + 24rpx); background: var(--ui-color-surface); border-top: var(--ui-border-default); }
.venue-map-cooperation { flex-shrink: 0; }
.venue-map-panel--with-cooperation { padding-bottom: 20rpx; }
.venue-map-panel__eyebrow { display: block; font-size: 22rpx; color: var(--ui-color-text-muted); margin-bottom: 8rpx; }
.venue-map-panel__title { display: block; font-size: 30rpx; font-weight: var(--ui-font-weight-heading); line-height: 1.4; overflow-wrap: anywhere; }
.venue-map-panel__hint { display: block; margin-top: 8rpx; font-size: 24rpx; color: var(--ui-color-text-muted); }
.venue-map-selection { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }
.venue-map-selection .venue-map-panel__title { min-width: 0; flex: 1; }
.venue-map-selection-actions { display: flex; align-items: center; gap: 16rpx; margin-top: 20rpx; }
.venue-map-open { flex-shrink: 0; }
.venue-map-create { flex: 1; min-width: 0; }
.venue-map-venues { margin-top: 22rpx; width: 100%; }
.venue-map-venues__row { display: flex; gap: 12rpx; }
.venue-map-chip { flex-shrink: 0; margin: 0; padding: 16rpx 20rpx; border: var(--ui-border-default); border-radius: var(--ui-radius-button); background: var(--ui-color-surface); color: var(--ui-color-text-muted); font-size: 24rpx; line-height: 1.5; }
.venue-map-chip--selected { background: var(--ui-color-accent-soft); border-color: var(--ui-color-accent); color: var(--ui-color-accent-deep); }
.venue-map-state, .venue-map-no-results { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20rpx; padding: 32rpx; text-align: center; }
.venue-map-state { flex: 1; }
.venue-map-no-results { height: 100%; box-sizing: border-box; }
.venue-map-state__icon { color: var(--ui-color-text-muted); }
.venue-map-state__title { font-size: 30rpx; font-weight: var(--ui-font-weight-heading); }
.venue-map-state__hint { font-size: 24rpx; color: var(--ui-color-text-muted); line-height: 1.5; }
.venue-map-state__action { margin-top: 12rpx; }
.venue-map-warning { display: block; margin-bottom: 16rpx; font-size: 22rpx; color: var(--ui-color-text-muted); line-height: 1.5; }
</style>
