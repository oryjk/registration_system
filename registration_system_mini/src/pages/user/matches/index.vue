<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { loadAllMyMatches } from "../myMatchesData";
import UserMatchList from "./components/UserMatchList.vue";
import UserMatchesSkeleton from "./components/UserMatchesSkeleton.vue";
import { buildUserMatchCards, type UserMatchCard, type UserMatchScope } from "./userMatchesState";

const { ensureSessionReady } = useTeamContext();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const errorMessage = ref("");
const matchScope = ref<UserMatchScope>("future");
const matches = ref<UserMatchCard[]>([]);

const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

const scopeOptions = [
  { value: "future", label: "未结束" },
  { value: "past", label: "已结束" },
];

const emptyText = computed(() =>
  matchScope.value === "future" ? "暂时没有未结束的相关比赛。" : "暂时没有已结束的相关比赛。",
);

const heroCopy = computed(() =>
  matchScope.value === "future"
    ? "展示进行中及待开始的比赛，按时间顺序排列。"
    : "展示已经结束的比赛，方便回看历史记录。",
);

function handleScopeChange(event: Event) {
  const payload = event as Event & { value?: string | number; detail?: { value?: string | number } };
  const value = payload.value ?? payload.detail?.value;
  matchScope.value = value === "past" ? "past" : "future";
  void loadPageData();
}

function openMatchDetail(matchId: string) {
  uni.navigateTo({
    url: `/pages/matches/detail?id=${matchId}`,
  });
}

function openMap(locationLatitude: number | null, locationLongitude: number | null, name: string, address: string) {
  if (locationLatitude == null || locationLongitude == null) {
    uni.showToast({
      title: "暂无可打开的地图定位",
      icon: "none",
    });
    return;
  }

  uni.openLocation({
    latitude: Number(locationLatitude),
    longitude: Number(locationLongitude),
    name,
    address,
  });
}

async function loadPageData() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    await ensureSessionReady();
    const allMatches = await loadAllMyMatches();
    matches.value = buildUserMatchCards({
      matches: allMatches,
      scope: matchScope.value,
    });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "我的比赛加载失败";
  } finally {
    isLoading.value = false;
  }
}

onShow(() => {
  void loadPageData();
});
</script>

<template>
  <view class="my-matches-page">
    <AppTabHeader title="我的比赛" showBack />
    <view class="my-matches-content" :style="contentStyle">
      <view class="page-hero">
        <wd-text custom-class="page-title" color="#111310" text="我的比赛" />
        <wd-text custom-class="page-copy" color="#66705f" :text="heroCopy" />
      </view>

      <wd-segmented
        :value="matchScope"
        :options="scopeOptions"
        custom-class="scope-segment app-segment"
        @change="handleScopeChange"
      >
        <template #label="{ option }">
          <text>{{ option.value === "future" ? "未结束" : "已结束" }}</text>
        </template>
      </wd-segmented>

      <UserMatchesSkeleton v-if="isLoading" />
      <view v-else-if="errorMessage" class="empty-card">
        <wd-text custom-class="empty-text" color="#66705f" :text="errorMessage" />
      </view>
      <view v-else-if="!matches.length" class="empty-card">
        <wd-text custom-class="empty-text" color="#66705f" :text="emptyText" />
      </view>
      <UserMatchList
        v-else
        :matches="matches"
        @open-detail="openMatchDetail"
        @open-map="openMap"
      />
    </view>
  </view>
</template>

<style scoped>
.my-matches-page {
  min-height: 100vh;
  padding: 0 28rpx 96rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.12), transparent 20%),
    linear-gradient(180deg, #fbfcf7 0%, #eef2e6 100%);
  box-sizing: border-box;
}

.page-hero,
.empty-card {
  border-radius: 30rpx;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.page-hero {
  padding: 28rpx;
  background: #ffffff;
}

.page-title {
  display: block;
  color: #111310;
  font-size: 48rpx;
  line-height: 1.15;
  font-weight: 900;
}

.page-copy {
  display: block;
  margin-top: 12rpx;
  color: #66705f;
  font-size: 26rpx;
  line-height: 1.5;
  font-weight: 700;
}

:deep(.scope-segment) {
  margin-top: 18rpx;
}

.empty-card {
  margin-top: 18rpx;
  padding: 44rpx 28rpx;
  text-align: center;
  background: #ffffff;
}

.empty-text {
  font-size: 28rpx;
  font-weight: 800;
}
</style>
