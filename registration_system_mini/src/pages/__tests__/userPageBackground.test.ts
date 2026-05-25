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
    const heroProfileSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/components/MineHeroProfile.vue",
    ).text();

    expect(userPageSource.includes('class="mine-hero"')).toEqual(true);
    expect(userPageSource.includes("<MineHeroProfile")).toEqual(true);
    expect(heroProfileSource.includes('class="profile-stats-row"')).toEqual(true);
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

  test("uses a skeleton on first load instead of inserting a temporary loading card", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();
    const skeletonSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/components/MineSkeleton.vue",
    ).text();

    expect(userPageSource.includes('<MineSkeleton v-if="showInitialLoadingState"')).toEqual(true);
    expect(skeletonSource.includes('class="mine-skeleton-stack"')).toEqual(true);
    expect(skeletonSource.includes('class="mine-skeleton-profile"')).toEqual(true);
    expect(userPageSource.includes("正在加载个人中心")).toEqual(false);
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

  test("keeps slow billing flow out of the mine page wallet card", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();
    const walletSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/components/MineWalletSection.vue",
    ).text();
    const billingPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/billing/index.vue",
    ).text();

    expect(userPageSource.includes("getMyBillingFlow")).toEqual(false);
    expect(userPageSource.includes("getMyBalance")).toEqual(true);
    expect(userPageSource.includes('url: "/pages/billing/index"')).toEqual(true);
    expect(walletSource.includes("查看账单")).toEqual(true);
    expect(walletSource.includes("账单明细已移到二级页面")).toEqual(false);
    expect(walletSource.includes("compact-record-card")).toEqual(false);
    expect(billingPageSource.includes("getMyBillingFlow")).toEqual(true);
  });

  test("hides the wallet card on mine page during mini review mode", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();

    expect(userPageSource.includes('import { useMiniReviewStatus } from "@/stores/miniReview";')).toEqual(true);
    expect(userPageSource.includes("const { shouldHideCreationEntrances } = useMiniReviewStatus();")).toEqual(true);
    expect(userPageSource.includes("<MineWalletSection")).toEqual(true);
    expect(userPageSource.includes('v-if="!shouldHideCreationEntrances"')).toEqual(true);
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

  test("does not label a logged-in user without a team as unauthenticated", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();

    expect(userPageSource.includes('if (!currentUser.value) return "未登录";')).toEqual(true);
    expect(userPageSource.includes('return currentTeam.value?.myRoleLabel || "未加入球队";')).toEqual(true);
  });

  test("keeps mine page in guest mode when local token is missing", async () => {
    const userPageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();
    const heroProfileSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/components/MineHeroProfile.vue",
    ).text();

    expect(userPageSource.includes('import { getAccessToken } from "@/utils/authStorage";')).toEqual(true);
    expect(userPageSource.includes("if (!getAccessToken())")).toEqual(true);
    expect(userPageSource.indexOf("if (!getAccessToken())") < userPageSource.indexOf("await ensureSessionReady();")).toEqual(true);
    expect(userPageSource.includes('resetPageState("登录后可以查看你的比赛、出勤、钱包和球队数据");')).toEqual(true);
    expect(userPageSource.includes("async function handleLogin()")).toEqual(true);
    expect(userPageSource.includes("await refreshSessionContext();")).toEqual(true);
    expect(userPageSource.includes('@login="handleLogin"')).toEqual(true);
    expect(heroProfileSource.includes('currentUser ? "编辑资料" : "去登录"')).toEqual(true);
    expect(heroProfileSource.includes('v-if="currentUser" class="profile-edit-chip profile-logout-chip"')).toEqual(true);
  });
});
