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
  test("uses a first-load running loader instead of inserting a temporary empty loading block above content", async () => {
    const homePageSource = await sourceFile(
      "pages/home/index.vue",
    ).text();
    const loaderSource = await sourceFile(
      "components/ui/RunningLoader.vue",
    ).text();

    expect(homePageSource.includes('<RunningLoader v-if="showInitialLoadingState"')).toEqual(true);
    expect(homePageSource.includes('v-else-if="isLoading" class="home-empty"')).toEqual(false);
    expect(loaderSource.includes('class="ui-runner__ball"')).toEqual(true);
    expect(loaderSource.includes("@keyframes loader-orbit")).toEqual(true);
  });

  test("keeps the home layout mounted on refresh and uses a non-layout-shifting refresh mask", async () => {
    const homePageSource = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(homePageSource.includes("const isRefreshing = ref(false);")).toEqual(true);
    expect(homePageSource.includes('class="home-refresh-mask"')).toEqual(true);
    // scroll-view 自定义下拉：页面本体不滚动，固定 header 不随下拉拖动。
    expect(homePageSource.includes("const { refreshing, handleRefresherRefresh } = usePullRefresh(() => loadPageData({ preserveContent: hasLoadedOnce.value }));")).toEqual(true);
    expect(homePageSource.includes("<AppPullScrollView")).toEqual(true);
    expect(homePageSource.includes("void loadPageData({ preserveContent: true });")).toEqual(true);
  });

  test("swaps the home title for the L1 team switcher when logged in with at least one team", async () => {
    const homePageSource = await sourceFile("pages/home/index.vue").text();
    const switcherSource = await sourceFile("pages/home/components/HomeTeamSwitcher.vue").text();
    const headerSource = await sourceFile("components/AppTabHeader.vue").text();

    expect(headerSource.includes('<slot name="title">')).toEqual(true);
    expect(homePageSource.includes("const showTeamSwitcher = computed(() => !isGuestMode.value && teamProfiles.value.length >= 1);")).toEqual(true);
    expect(homePageSource.includes("<HomeTeamSwitcher")).toEqual(true);
    expect(homePageSource.includes('@switch-team="switchTeam"')).toEqual(true);
    // 选项行 logo 优先、无 logo 回退首字；切换事件带 teamId。
    expect(switcherSource.includes("team.logoUrl")).toEqual(true);
    expect(switcherSource.includes('(event: "switchTeam", teamId: number): void;')).toEqual(true);
    // 单队：入口仅作身份展示——无箭头、点击不弹面板。
    expect(switcherSource.includes("if (props.teams.length < 2 || props.forceClosed) return;")).toEqual(true);
    expect(switcherSource.includes('v-if="teams.length >= 2" class="home-team-entry__caret"')).toEqual(true);
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
    expect(homePageSource.includes("usePullRefresh(() => loadPageData(")).toEqual(true);
    expect(homePageSource.includes('import { usePullRefresh } from "@/composables/usePullRefresh";')).toEqual(true);
    expect(homePageSource.includes("shouldSkipNextShowRefresh")).toEqual(false);
    // 四个 tab 页改为 scroll-view 自定义下拉，pages.json 不再开启原生下拉。
    for (const tabPath of ["pages/home/index", "pages/activities/index", "pages/teams/index", "pages/user/index"]) {
      const entryMatch = pagesJson.match(new RegExp(`"path": "${tabPath}",\\s*"style":\\s*\\{[^}]*\\}`));
      if (!entryMatch) throw new Error(`pages.json 缺少 ${tabPath} 条目`);
      expect(entryMatch[0].includes("enablePullDownRefresh")).toEqual(false);
    }
  });

  test("switches the home page to /matches/home sections and removes legacy opportunity sources", async () => {
    const source = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(source.includes('import { getMatchHome } from "@/api/match";')).toEqual(true);
    expect(source.includes("buildHomeMatchSections")).toEqual(true);
    expect(source.includes('openMatchList("ongoing")')).toEqual(true);
    expect(source.includes('openMatchList("ended")')).toEqual(true);
    expect(source.includes("HomeOpportunityList")).toEqual(false);
    expect(source.includes("listChallenges")).toEqual(false);
    expect(source.includes("listActivities")).toEqual(false);
  });

  test("keeps guests public and only calls protected match home after session readiness", async () => {
    const source = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(source.includes('<HomeEmptyHero')).toEqual(true);
    expect(source.includes('v-else-if="hasLoadedMatchData"')).toEqual(true);
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
    expect(source.includes("const sections = buildHomeMatchSections(response, new Date());")).toEqual(true);
    expect(source.includes("void syncUnreadCount({ skipEnsure: true }).catch")).toEqual(true);
    expect(source.includes("loadMiniAppRuntimeConfig")).toEqual(false);
  });

  test("wires persisted onboarding intent into the empty-home actions", async () => {
    const source = await sourceFile("pages/home/index.vue").text();

    expect(source.includes("intent: onboardingGuide.intent.value")).toEqual(true);
    expect(source.includes('url: "/pages/challenges/create-individual/index"')).toEqual(true);
    expect(source.includes('@create-pickup="openCreatePickup"')).toEqual(true);
    expect(source.includes("onboardingGuide.setIntent(\"captain\")")).toEqual(true);
    expect(source.includes("onboardingGuide.setIntent(\"player\")")).toEqual(true);
  });

  test("guards initial failure with explicit error state and keeps empty states gated behind a successful load", async () => {
    const source = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(source.includes('const errorMessage = ref("");')).toEqual(true);
    expect(source.includes("const hasLoadedMatchData = ref(false);")).toEqual(true);
    expect(source.includes("const showHomeLoadError = computed(() => !hasLoadedMatchData.value && !!errorMessage.value);")).toEqual(true);
    expect(source.includes("errorMessage.value = error instanceof Error ? error.message : \"首页数据加载失败\";")).toEqual(true);
    expect(source.includes('v-if="showHomeLoadError" class="home-empty home-empty-compact"')).toEqual(true);
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

  test("drops the mine/others tab segmenter and plaza list while keeping the my-matches sections", async () => {
    const source = await sourceFile(
      "pages/home/index.vue",
    ).text();

    expect(source.includes("SegmentedControl")).toEqual(false);
    expect(source.includes("activeHomeTab")).toEqual(false);
    expect(source.includes("HomeOtherMatchesSection")).toEqual(false);
    expect(source.includes("useHomeOtherMatches")).toEqual(false);
    expect(source.includes("<HomeActionMatchCarousel")).toEqual(true);
    expect(source.includes(':matches="actionDeckMatches"')).toEqual(true);
    expect(source.includes("additionalUpcomingMatches")).toEqual(false);
    expect(source.includes('title="进行中的比赛"')).toEqual(true);
    expect(source.includes('v-if="!isGuestMode && endedMatches.length" title="已结束的比赛"')).toEqual(true);
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
    expect(source.includes("imageUrl: HOME_SHARE_IMAGE_URL")).toEqual(true);
  });
});
