import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("home page loading states", () => {
  test("uses a first-load skeleton instead of inserting a temporary empty loading block above content", async () => {
    const homePageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/index.vue",
    ).text();
    const skeleton = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/components/HomeSkeleton.vue",
    ).text();

    expect(homePageSource.includes('<HomeSkeleton v-if="showInitialLoadingState"')).toEqual(true);
    expect(homePageSource.includes('v-else-if="isLoading" class="home-empty"')).toEqual(false);
    expect(skeleton.includes('class="home-skeleton-card home-skeleton-card-hero"')).toEqual(true);
  });

  test("keeps the home layout mounted on refresh and uses a non-layout-shifting refresh mask", async () => {
    const homePageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/index.vue",
    ).text();

    expect(homePageSource.includes('const isRefreshing = ref(false);')).toEqual(true);
    expect(homePageSource.includes('class="home-refresh-mask"')).toEqual(true);
    expect(homePageSource.includes('void loadPageData({ preserveContent: hasLoadedOnce.value });')).toEqual(true);
  });

  test('routes "all matches" from home page to stats instead of mine', async () => {
    const homePageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/index.vue",
    ).text();

    expect(homePageSource.includes(`@tap="openTab('/pages/teams/index')"`)).toEqual(true);
    expect(homePageSource.includes(`@tap="openTab('/pages/user/index')">全部比赛`)).toEqual(false);
  });

  test("does not block the home page behind login when the user is logged out", async () => {
    const homePageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/index.vue",
    ).text();
    const matchList = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/components/HomeMatchList.vue",
    ).text();
    const hero = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/components/HomeHeroSection.vue",
    ).text();

    expect(homePageSource.includes('import { hasManualLogout } from "@/utils/authStorage";')).toEqual(true);
    expect(homePageSource.includes("const isGuestMode = ref(false);")).toEqual(true);
    expect(homePageSource.includes("function resetUserRelatedHomeData")).toEqual(true);
    expect(homePageSource.includes("async function loadPublicHomeData")).toEqual(true);
    expect(homePageSource.includes("buildPublicHomeMatchCards")).toEqual(true);
    expect(homePageSource.includes("isRuntimeVisibleChallengeSummary")).toEqual(true);
    expect(homePageSource.includes("const runtimeConfig = await loadMiniAppRuntimeConfig();")).toEqual(true);
    expect(homePageSource.includes("const challengeFetchLimit = Math.min(runtimeConfig.home.challenge_card_limit * 5, 50);")).toEqual(true);
    expect(homePageSource.includes("pageSize: runtimeConfig.home.activity_fetch_page_size")).toEqual(true);
    expect(homePageSource.includes("limit: challengeFetchLimit")).toEqual(true);
    expect(homePageSource.includes("isRuntimeVisibleActivity(item, runtimeConfig, now)")).toEqual(true);
    expect(homePageSource.includes("isRuntimeVisibleChallengeSummary(summary, runtimeConfig, now)")).toEqual(true);
    expect(homePageSource.includes("runtimeConfig.home.match_card_limit")).toEqual(true);
    expect(homePageSource.includes("if (hasManualLogout())")).toEqual(true);
    expect(homePageSource.includes("await loadPublicHomeData();")).toEqual(true);
    expect(homePageSource.includes("await ensureSessionReady();")).toEqual(true);
    expect(homePageSource.includes('v-if="errorMessage" class="home-empty"')).toEqual(false);
    expect(homePageSource.includes("{{ errorMessage }}")).toEqual(false);
    expect(homePageSource.includes("HomeHeroSection")).toEqual(true);
    expect(hero.includes('v-if="!isGuestMode" class="team-hero-card"')).toEqual(true);
    expect(homePageSource.includes('<view class="section-headline">')).toEqual(true);
    expect(homePageSource.includes("HomeMatchList")).toEqual(true);
    expect(matchList.includes("登录后报名")).toEqual(true);
    expect(homePageSource.includes("公开约队可先浏览，接约和报名需要登录。")).toEqual(true);
    expect(hero.includes('class="home-banner"')).toEqual(true);
  });

  test("reloads the home page after login completes on the same page", async () => {
    const homePageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/index.vue",
    ).text();

    expect(homePageSource.includes('uni.$on("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
    expect(homePageSource.includes('uni.$off("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
    expect(homePageSource.includes("function handleSessionLoginCompleted")).toEqual(true);
    expect(homePageSource.includes("void loadPageData({ preserveContent: true });")).toEqual(true);
  });

  test("orders home challenge opportunities by match time descending before limiting", async () => {
    const homePageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/index.vue",
    ).text();

    expect(homePageSource.includes('sort: "holding_date_desc"')).toEqual(true);
    expect(homePageSource.includes("function sortChallengeSummariesByHoldingTimeDesc")).toEqual(true);
    expect(homePageSource.includes("right.challenge.holding_date.localeCompare(left.challenge.holding_date)")).toEqual(true);
    expect(homePageSource.includes("right.challenge.start_time.localeCompare(left.challenge.start_time)")).toEqual(true);
    expect(homePageSource.includes("sortChallengeSummariesByHoldingTimeDesc(")).toEqual(true);
  });

  test("opens challenge detail when tapping any home opportunity card", async () => {
    const homePageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/index.vue",
    ).text();
    const opportunityListSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/components/HomeOpportunityList.vue",
    ).text();

    expect(homePageSource.includes('function openChallengeDetail(challengeId: string)')).toEqual(true);
    expect(homePageSource.includes("url: `/pages/challenges/detail?id=${challengeId}`")).toEqual(true);
    expect(homePageSource.includes('@open-challenge="openChallengeDetail"')).toEqual(true);
    expect(opportunityListSource.includes('(event: "openChallenge", challengeId: string): void;')).toEqual(true);
    expect(opportunityListSource.includes('@tap="handleOpenChallenge(card.id)"')).toEqual(true);
  });
});
