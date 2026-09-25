import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("mine page visual composition", () => {
  test("uses the shared semantic page background instead of a page-specific image layer", async () => {
    const userPageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();

    expect(userPageSource.includes('class="app-theme-scope mine-page"')).toEqual(true);
    expect(userPageSource.includes("background:var(--ui-color-page);")).toEqual(true);
    expect(userPageSource.includes("minePageBackgroundUrl")).toEqual(false);
    expect(userPageSource.includes('url("@/static/backgrounds/mine-page-bg.jpg")')).toEqual(false);
  });

  test("keeps the profile hero and statistics in focused reusable components", async () => {
    const userPageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();
    const heroProfileSource = await Bun.file(sourcePath("pages/user/components/MineProfileHero.vue")).text();

    expect(userPageSource.includes("<MineProfileHero")).toEqual(true);
    expect(userPageSource.includes("<MineStatsGrid")).toEqual(true);
    expect(heroProfileSource.includes('class="mine-profile-hero"')).toEqual(true);
    expect(heroProfileSource.includes("profile-stats-row")).toEqual(false);
    expect(userPageSource.includes('class="overview-card"')).toEqual(false);
  });

  test("uses the shared fixed header while the content starts below it", async () => {
    const userPageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();
    const composableSource = await Bun.file(sourcePath("pages/user/useMinePage.ts")).text();

    expect(userPageSource.includes('<AppTabHeader title="我的" />')).toEqual(true);
    expect(userPageSource.includes('class="mine-page-content" :style="contentStyle"')).toEqual(true);
    expect(composableSource.includes("const contentStyle = computed(() => ({")).toEqual(true);
    expect(userPageSource.includes("mine-hero-heading")).toEqual(false);
  });

  test("uses the shared running loader on first load instead of inserting a temporary loading card", async () => {
    const userPageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();
    const loaderSource = await Bun.file(sourcePath("components/ui/RunningLoader.vue")).text();

    expect(userPageSource.includes('<RunningLoader v-if="showInitialLoadingState"')).toEqual(true);
    expect(loaderSource.includes('class="ui-runner__ball"')).toEqual(true);
    expect(userPageSource.includes("正在加载个人中心")).toEqual(false);
    expect(userPageSource.includes('v-else-if="isLoading" class="mine-empty"')).toEqual(false);
    expect(userPageSource.includes('class="team-switch-status"')).toEqual(false);
  });

  test("does not render a standalone error banner above the profile card", async () => {
    const userPageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();

    expect(userPageSource.includes('v-if="errorMessage" class="mine-empty"')).toEqual(false);
    expect(userPageSource.includes("{{ errorMessage }}")).toEqual(false);
  });

  test('routes "all matches" from mine page to the dedicated match list without navigator', async () => {
    const userPageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();
    const composableSource = await Bun.file(sourcePath("pages/user/useMinePage.ts")).text();

    expect(composableSource.includes('function openUserMatches()')).toEqual(true);
    expect(composableSource.includes('url: "/pages/user/matches/index"')).toEqual(true);
    expect(userPageSource.includes("<navigator")).toEqual(false);
  });

  test("keeps membership payment flow on the team fund page", async () => {
    const fundFlow = await Bun.file(sourcePath("pages/teams/fund/useTeamFundPage.ts")).text();
    const detailFlow = await Bun.file(sourcePath("pages/teams/detail/useTeamDetailPage.ts")).text();

    // 队费缴纳从球队详情页下放到独立子页；详情页只保留余额入口行。
    expect(fundFlow.includes("createTeamMembershipOrder")).toEqual(true);
    expect(fundFlow.includes("requestWxPayment")).toEqual(true);
    expect(fundFlow.includes("syncGoPaymentOrder")).toEqual(true);
    expect(detailFlow.includes("createTeamMembershipOrder")).toEqual(false);
    expect(detailFlow.includes("pages/teams/fund/index")).toEqual(true);
  });

  test("keeps slow billing flow out of the mine page wallet card", async () => {
    const composableSource = await Bun.file(sourcePath("pages/user/useMinePage.ts")).text();
    const walletSource = await Bun.file(sourcePath("pages/user/components/MineWalletSection.vue")).text();
    const billingPageSource = await Bun.file(sourcePath("pages/billing/index.vue")).text();

    expect(composableSource.includes("getMyBillingFlow")).toEqual(false);
    expect(composableSource.includes("getMyBalance")).toEqual(false);
    expect(composableSource.includes("getWallet")).toEqual(true);
    expect(composableSource.includes('url: "/pages/billing/index"')).toEqual(true);
    expect(walletSource.includes("@tap=\"emit('openBilling')\"")).toEqual(true);
    expect(walletSource.includes("账单明细已移到二级页面")).toEqual(false);
    expect(walletSource.includes("compact-record-card")).toEqual(false);
    expect(billingPageSource.includes("getTeamFundTransactions")).toEqual(true);
  });

  test("hides the wallet card on mine page during mini review mode", async () => {
    const userPageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();
    const composableSource = await Bun.file(sourcePath("pages/user/useMinePage.ts")).text();

    expect(composableSource.includes('import { useMiniReviewStatus } from "@/stores/miniReview";')).toEqual(true);
    expect(composableSource.includes("const { shouldHideCreationEntrances } = useMiniReviewStatus();")).toEqual(true);
    expect(userPageSource.includes("<MineWalletSection")).toEqual(true);
    expect(userPageSource.includes('v-if="!shouldHideCreationEntrances"')).toEqual(true);
  });

  test("reloads mine page data after the floating login prompt finishes login", async () => {
    const userPageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();

    expect(userPageSource.includes('uni.$on("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
    expect(userPageSource.includes('uni.$off("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
    expect(userPageSource.includes("function handleSessionLoginCompleted")).toEqual(true);
    expect(userPageSource.includes("void loadPageData();")).toEqual(true);
  });

  test("does not label a logged-in user without a team as unauthenticated", async () => {
    const composableSource = await Bun.file(sourcePath("pages/user/useMinePage.ts")).text();

    expect(composableSource.includes("const displayName = computed(() => resolveUserDisplayName(currentUser.value));")).toEqual(true);
    expect(composableSource.includes("resolveUserDisplayName(currentTeam.value)")).toEqual(false);
  });

  test("keeps mine page in guest mode only after a manual logout", async () => {
    const userPageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();
    const composableSource = await Bun.file(sourcePath("pages/user/useMinePage.ts")).text();
    const heroProfileSource = await Bun.file(sourcePath("pages/user/components/MineProfileHero.vue")).text();

    expect(composableSource.includes('import { hasManualLogout } from "@/utils/authStorage";')).toEqual(true);
    expect(composableSource.includes("if (hasManualLogout())")).toEqual(true);
    expect(composableSource.indexOf("if (hasManualLogout())") < composableSource.indexOf("await ensureSessionReady();")).toEqual(true);
    expect(composableSource.includes('resetPageState("登录后可以查看你的比赛、出勤、钱包和球队数据");')).toEqual(true);
    expect(composableSource.includes("async function handleLogin()")).toEqual(true);
    expect(composableSource.includes("await refreshSessionContext();")).toEqual(true);
    expect(userPageSource.includes('@login="handleLogin"')).toEqual(true);
    expect(heroProfileSource.includes('@click="emit(\'login\')"')).toEqual(true);
    expect(heroProfileSource.includes("登录后查看比赛与球队")).toEqual(true);
    expect(heroProfileSource.includes("emit('login')")).toEqual(true);
    expect(heroProfileSource.includes("编辑资料")).toEqual(true);
    expect(userPageSource.includes("退出登录")).toEqual(true);
  });

  test("keeps the page as a lifecycle and component orchestration layer", async () => {
    const userPageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();

    expect(userPageSource.includes('import { useMinePage } from "./useMinePage";')).toEqual(true);
    expect(userPageSource.includes("} = useMinePage();")).toEqual(true);
    expect(userPageSource.includes('from "@/api/payment"')).toEqual(false);
    expect(userPageSource.includes('from "@/api/wallet"')).toEqual(false);
    expect(userPageSource.includes("onShow(() => {")).toEqual(true);
    expect(userPageSource.includes("onLoad(() => {")).toEqual(true);
    expect(userPageSource.includes("onUnload(() => {")).toEqual(true);
  });

  test("centers mine content and header on wide H5 screens without overriding the shared floating tabbar", async () => {
    const userPageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();
    const sharedStyles = await Bun.file(sourcePath("uni.css")).text();
    const styles = userPageSource.match(/<style\b[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? "";
    const h5Styles = styles.match(/\/\*\s*#ifdef H5\s*\*\/([\s\S]*?)\/\*\s*#endif\s*\*\//)?.[1] ?? "";
    const content = styles.match(/\.mine-page-content\s*\{([^}]*)\}/)?.[1]?.replace(/\s+/g, "") ?? "";
    const page = h5Styles.match(/\.mine-page\s*\{([^}]*)\}/)?.[1]?.replace(/\s+/g, "") ?? "";
    const header = h5Styles.match(/\.mine-page\s+:deep\(\.app-tab-header-shell\)\s*\{([^}]*)\}/)?.[1]?.replace(/\s+/g, "") ?? "";
    const tabbar = sharedStyles.match(/\.custom-tabbar\s*\{([^}]*)\}/)?.[1]?.replace(/\s+/g, "") ?? "";

    // 内容列与 H5 页面保持居中；不依赖声明顺序、空格或旧的合并选择器逗号。
    for (const rule of [content, page]) {
      for (const declaration of ["width:100%;", "max-width:750rpx;", "margin:0auto;"]) {
        expect(`;${rule}`.includes(`;${declaration}`)).toEqual(true);
      }
    }
    for (const declaration of ["left:50%;", "right:auto;", "width:100%;", "max-width:750rpx;", "transform:translateX(-50%);"]) {
      expect(`;${header}`.includes(`;${declaration}`)).toEqual(true);
    }

    // 底栏由共享样式负责悬浮和居中，不再被页面强行拉伸到 750rpx。
    expect(userPageSource.includes('<BottomTabBar current="mine" />')).toEqual(true);
    expect(/:deep\(\s*\.custom-tabbar\s*\)/.test(styles)).toEqual(false);
    for (const declaration of ["position:fixed;", "left:50%;", "width:calc(100%-48rpx);", "max-width:702rpx;", "transform:translateX(-50%);"]) {
      expect(`;${tabbar}`.includes(`;${declaration}`)).toEqual(true);
    }
  });
});
