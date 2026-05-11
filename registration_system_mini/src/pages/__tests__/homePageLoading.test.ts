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

    expect(homePageSource.includes('v-if="showInitialLoadingState" class="home-skeleton-stack"')).toEqual(true);
    expect(homePageSource.includes('v-else-if="isLoading" class="home-empty"')).toEqual(false);
    expect(homePageSource.includes('class="home-skeleton-card home-skeleton-card-hero"')).toEqual(true);
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

    expect(homePageSource.includes('import { hasManualLogout } from "@/utils/authStorage";')).toEqual(true);
    expect(homePageSource.includes("const isGuestMode = ref(false);")).toEqual(true);
    expect(homePageSource.includes("function resetUserRelatedHomeData")).toEqual(true);
    expect(homePageSource.includes("async function loadPublicHomeData")).toEqual(true);
    expect(homePageSource.includes("buildPublicHomeMatchCards")).toEqual(true);
    expect(homePageSource.includes('import { isRuntimeVisibleActivity, loadMiniAppRuntimeConfig } from "@/config/runtimeConfig";')).toEqual(true);
    expect(homePageSource.includes("const runtimeConfig = await loadMiniAppRuntimeConfig();")).toEqual(true);
    expect(homePageSource.includes("pageSize: runtimeConfig.home.activity_fetch_page_size")).toEqual(true);
    expect(homePageSource.includes("limit: runtimeConfig.home.challenge_card_limit")).toEqual(true);
    expect(homePageSource.includes("isRuntimeVisibleActivity(item, runtimeConfig, now)")).toEqual(true);
    expect(homePageSource.includes("runtimeConfig.home.match_card_limit")).toEqual(true);
    expect(homePageSource.includes("if (hasManualLogout())")).toEqual(true);
    expect(homePageSource.includes("await loadPublicHomeData();")).toEqual(true);
    expect(homePageSource.includes("await ensureSessionReady();")).toEqual(true);
    expect(homePageSource.includes('v-if="errorMessage" class="home-empty"')).toEqual(false);
    expect(homePageSource.includes("{{ errorMessage }}")).toEqual(false);
    expect(homePageSource.includes('v-if="!isGuestMode" class="team-hero-card"')).toEqual(true);
    expect(homePageSource.includes('<view class="section-headline">')).toEqual(true);
    expect(homePageSource.includes("登录后报名")).toEqual(true);
    expect(homePageSource.includes("公开约队可先浏览，接约和报名需要登录。")).toEqual(true);
    expect(homePageSource.includes('class="home-banner"')).toEqual(true);
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
});
