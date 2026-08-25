import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

function sourceFile(path: string) {
  return Bun.file(sourcePath(path));
}

describe("home page loading states", () => {
  test("uses a first-load skeleton instead of inserting a temporary empty loading block above content", async () => {
    const homePageSource = await sourceFile(
      "pages/home/index.vue",
    ).text();
    const skeleton = await sourceFile(
      "pages/home/components/HomeSkeleton.vue",
    ).text();

    expect(homePageSource.includes('<HomeSkeleton v-if="showInitialLoadingState"')).toEqual(true);
    expect(homePageSource.includes('v-else-if="isLoading" class="home-empty"')).toEqual(false);
    expect(skeleton.includes('class="home-skeleton-card home-skeleton-card-hero"')).toEqual(true);
  });

  test("keeps the home layout mounted on refresh and uses a non-layout-shifting refresh mask", async () => {
    const homePageSource = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(homePageSource.includes("const isRefreshing = ref(false);")).toEqual(true);
    expect(homePageSource.includes('class="home-refresh-mask"')).toEqual(true);
    expect(homePageSource.includes("await loadPageData({ preserveContent: hasLoadedOnce.value });")).toEqual(true);
    expect(homePageSource.includes("void loadPageData({ preserveContent: true });")).toEqual(true);
  });

  test("does not refresh the home page on every onShow; uses hidden duration threshold and pending-reload flag instead", async () => {
    const homePageSource = await sourceFile(
      "pages/home/index.vue",
    ).text();
    const pagesJson = await sourceFile(
      "pages.json",
    ).text();

    expect(homePageSource.includes("const HIDDEN_RELOAD_THRESHOLD_MS = 2 * 60 * 1000;")).toEqual(true);
    expect(homePageSource.includes("const hiddenAt = ref<number | null>(null);")).toEqual(true);
    expect(homePageSource.includes("const pendingReloadFromEvent = ref(false);")).toEqual(true);
    expect(homePageSource.includes('uni.$on("home:data-may-changed", handleHomeDataMayChanged);')).toEqual(true);
    expect(homePageSource.includes('uni.$off("home:data-may-changed", handleHomeDataMayChanged);')).toEqual(true);
    expect(homePageSource.includes("if (hiddenDuration < HIDDEN_RELOAD_THRESHOLD_MS) return;")).toEqual(true);
    expect(homePageSource.includes("onHide(() => {")).toEqual(true);
    expect(homePageSource.includes("hiddenAt.value = Date.now();")).toEqual(true);
    expect(homePageSource.includes("onPullDownRefresh(async () => {")).toEqual(true);
    expect(homePageSource.includes("uni.stopPullDownRefresh();")).toEqual(true);
    expect(homePageSource.includes("shouldSkipNextShowRefresh")).toEqual(false);
    expect(pagesJson.includes('"enablePullDownRefresh": true')).toEqual(true);
  });

  test("switches the home page to /matches/home sections and removes legacy opportunity sources", async () => {
    const source = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(source.includes('import { getMatchHome, listMyMatches, listMatches } from "@/api/match";')).toEqual(true);
    expect(source.includes("buildHomeMatchSections")).toEqual(true);
    expect(source.includes('openMatchList("ongoing")')).toEqual(true);
    expect(source.includes('openMatchList("ended")')).toEqual(true);
    expect(source.includes("HomeOpportunityList")).toEqual(false);
    expect(source.includes("listChallenges")).toEqual(false);
    expect(source.includes("listActivities")).toEqual(false);
  });

  test("uses default hero banners, keeps guests public, and only calls protected match home after session readiness", async () => {
    const source = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(source.includes('import { defaultMiniAppRuntimeConfig } from "@/config/runtimeConfig";')).toEqual(true);
    expect(source.includes("const homeHeroBanners = ref(defaultMiniAppRuntimeConfig.home.hero_banners);")).toEqual(true);
    expect(source.includes("const upcomingMatches = ref<HomeMatchCardViewModel[]>([]);")).toEqual(true);
    expect(source.includes("const ongoingMatches = ref<HomeMatchCardViewModel[]>([]);")).toEqual(true);
    expect(source.includes("const endedMatches = ref<HomeMatchCardViewModel[]>([]);")).toEqual(true);
    expect(source.includes("if (hasManualLogout())")).toEqual(true);
    expect(source.includes("upcomingMatches.value = [];")).toEqual(true);
    expect(source.includes("ongoingMatches.value = [];")).toEqual(true);
    expect(source.includes("endedMatches.value = [];")).toEqual(true);
    expect(source.includes("let homeLoadVersion = 0;")).toEqual(true);
    expect(source.includes("const loadVersion = ++homeLoadVersion;")).toEqual(true);
    expect(source.includes("if (loadVersion !== homeLoadVersion) return;")).toEqual(true);
    expect(source.includes("await ensureSessionReady();")).toEqual(true);
    expect(source.includes("const response = await getMatchHome();")).toEqual(true);
    expect(source.includes("const sections = buildHomeMatchSections(response, new Date(), 2);")).toEqual(true);
    expect(source.includes("void syncUnreadCount({ skipEnsure: true }).catch")).toEqual(true);
    expect(source.includes("loadMiniAppRuntimeConfig")).toEqual(false);
  });

  test("guards initial failure with explicit error state and keeps empty states gated behind a successful load", async () => {
    const source = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(source.includes('const errorMessage = ref("");')).toEqual(true);
    expect(source.includes("const hasLoadedMatchData = ref(false);")).toEqual(true);
    expect(source.includes("const showHomeLoadError = computed(() => !hasLoadedMatchData.value && !!errorMessage.value);")).toEqual(true);
    expect(source.includes("errorMessage.value = error instanceof Error ? error.message : \"首页数据加载失败\";")).toEqual(true);
    expect(source.includes('v-if="!hasSearched && activeHomeTab === \'mine\' && showHomeLoadError" class="home-empty home-empty-compact"')).toEqual(true);
    expect(source.includes("@tap=\"handleRetryLoad\"")).toEqual(true);
    expect(source.includes("点击重试")).toEqual(true);
  });

  test("reloads the home page after login completes on the same page", async () => {
    const source = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(source.includes('uni.$on("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
    expect(source.includes('uni.$off("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
    expect(source.includes("function handleSessionLoginCompleted")).toEqual(true);
    expect(source.includes("void loadPageData({ preserveContent: true });")).toEqual(true);
  });

  test("renders three phased match sections and only shows ongoing/ended sections for authenticated users", async () => {
    const source = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(source.includes('title="最近要处理的比赛"')).toEqual(true);
    expect(source.includes('openMatchList("upcoming")')).toEqual(true);
    expect(source.includes('v-if="!isGuestMode" title="进行中的比赛"')).toEqual(true);
    expect(source.includes('v-if="!isGuestMode" title="已结束的比赛"')).toEqual(true);
    expect(source.includes('title="最近要处理的比赛" marker="热" action-label="更多"')).toEqual(true);
    expect(source.includes(":action-label=\"ongoingMatches.length ? '更多' : undefined\"")).toEqual(true);
    expect(source.includes(":action-label=\"endedMatches.length ? '更多' : undefined\"")).toEqual(true);
  });

  test("keeps match list consumers declarative without presentation callback props", async () => {
    const homeSource = await sourceFile("pages/home/index.vue").text();
    const listSource = await sourceFile("pages/home/components/HomeMatchList.vue").text();
    const phaseListSource = await sourceFile("pages/home/matches/index.vue").text();

    for (const source of [homeSource, listSource, phaseListSource]) {
      expect(source.includes("format-match-date-block")).toEqual(false);
      expect(source.includes("progress-base-width")).toEqual(false);
      expect(source.includes("progress-extra-width")).toEqual(false);
      expect(source.includes("progress-split-left")).toEqual(false);
      expect(source.includes("stage-class")).toEqual(false);
      expect(source.includes("status-class")).toEqual(false);
    }
  });

  test("keeps homepage search as a parent orchestration and child presentation boundary", async () => {
    const source = await Bun.file(sourcePath("pages/home/index.vue")).text();
    const searchSource = await Bun.file(sourcePath("pages/home/components/HomeMatchSearch.vue")).text().catch(() => "");

    expect(source.includes("<HomeMatchSearch")).toEqual(true);
    expect(source.includes("onReachBottom")).toEqual(true);
    expect(source.includes("HOME_MATCH_SEARCH_PAGE_SIZE")).toEqual(true);
    expect(source.includes("loadAllHomeMatchSearchResults")).toEqual(false);
    expect(searchSource.includes("@/api/match")).toEqual(false);
    expect(searchSource.includes("useTeamContext")).toEqual(false);
  });

  test("dedupes in-flight search page requests by target page instead of queueing replays", async () => {
    const source = await Bun.file(sourcePath("pages/home/index.vue")).text();

    expect(source.includes("let searchLoadingTargetPage = 0;")).toEqual(true);
    expect(source.includes("if (page === searchLoadingTargetPage) return;")).toEqual(true);
    expect(source.includes("pendingSearchLoadMore")).toEqual(false);
    expect(source.includes('"queue"')).toEqual(false);
  });

  test("allows ongoing and ended cards to navigate to detail and only blocks missing detail or duplicate navigation", async () => {
    const source = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(source.includes("if (!match.canOpenDetail || navigatingMatchId.value) return;")).toEqual(true);
    expect(source.includes("if (!match.canRegister)")).toEqual(false);
    expect(source.includes('title: "本场暂不可报名"')).toEqual(false);
    expect(source.includes("url: match.detailUrl")).toEqual(true);
  });

  test("keeps one time snapshot while paging every phase from my matches", async () => {
    const source = await sourceFile(
      "pages/home/matches/index.vue",
    ).text();

    expect(source.includes('import { listMyMatches } from "@/api/match";')).toEqual(true);
    expect(source.includes("const phaseClock = ref(new Date())")).toEqual(true);
    expect(source.includes("phaseClock.value = new Date();")).toEqual(true);
    expect(source.includes("phaseClock.value,")).toEqual(true);
    expect(source.includes("listMatches({ scope: \"others\"")).toEqual(false);
  });

  test("enables sharing for the public home page with the default share cover", async () => {
    const source = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(source.includes("onShareAppMessage")).toEqual(true);
    expect(source.includes("onShareTimeline")).toEqual(true);
    expect(source.includes('const shareTitle = "约球开踢：组队、报名、上场";')).toEqual(true);
    expect(source.includes('const sharePath = "/pages/home/index";')).toEqual(true);
    expect(source.includes("imageUrl: DEFAULT_SHARE_IMAGE_URL")).toEqual(true);
  });
});
