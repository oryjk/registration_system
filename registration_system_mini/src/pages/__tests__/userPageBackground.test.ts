import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("mine page background rendering", () => {
  test("renders the local background through an image layer instead of wxss url()", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();

    expect(userPageSource.includes('class="mine-page-bg"')).toEqual(true);
    expect(userPageSource.includes('import minePageBackgroundUrl from "@/static/backgrounds/mine-page-bg.jpg";')).toEqual(true);
    expect(userPageSource.includes(':src="minePageBackgroundUrl"')).toEqual(true);
    expect(userPageSource.includes('url("@/static/backgrounds/mine-page-bg.jpg")')).toEqual(false);
  });

  test("uses a hero layout with the profile stats embedded in the main card", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();

    expect(userPageSource.includes('class="mine-hero"')).toEqual(true);
    expect(userPageSource.includes('class="profile-stats-row"')).toEqual(true);
    expect(userPageSource.includes('class="overview-card"')).toEqual(false);
  });

  test("uses the shared fixed header while the content starts below it", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();

    expect(userPageSource.includes('<AppTabHeader title="我的" />')).toEqual(true);
    expect(userPageSource.includes('class="mine-page-content" :style="contentStyle"')).toEqual(true);
    expect(userPageSource.includes("const contentStyle = computed(() => ({")).toEqual(true);
    expect(userPageSource.includes("mine-hero-heading")).toEqual(false);
  });

  test("keeps the profile shell mounted while switching teams instead of inserting a full-page loading block", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();

    expect(userPageSource.includes('v-if="showInitialLoadingState" class="mine-empty"')).toEqual(true);
    expect(userPageSource.includes('v-else-if="isLoading" class="mine-empty"')).toEqual(false);
    expect(userPageSource.includes('class="team-switch-status"')).toEqual(false);
  });

  test("does not render a standalone error banner above the profile card", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();

    expect(userPageSource.includes('v-if="errorMessage" class="mine-empty"')).toEqual(false);
    expect(userPageSource.includes("{{ errorMessage }}")).toEqual(false);
  });

  test('routes "all matches" from mine page to the dedicated match list without navigator', async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();

    expect(userPageSource.includes('function openUserMatches()')).toEqual(true);
    expect(userPageSource.includes('url: "/pages/user/matches/index"')).toEqual(true);
    expect(userPageSource.includes("<navigator")).toEqual(false);
  });

  test("wires membership renewal to the real payment flow", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();

    expect(userPageSource.includes("createTeamMembershipOrder")).toEqual(true);
    expect(userPageSource.includes("requestWxPayment")).toEqual(true);
    expect(userPageSource.includes("syncPaymentOrderStatus")).toEqual(true);
    expect(userPageSource.includes("handleMembershipRenewal")).toEqual(true);
  });

  test("reloads mine page data after the floating login prompt finishes login", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();

    expect(userPageSource.includes('uni.$on("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
    expect(userPageSource.includes('uni.$off("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
    expect(userPageSource.includes("function handleSessionLoginCompleted")).toEqual(true);
    expect(userPageSource.includes("void loadPageData();")).toEqual(true);
  });
});
