import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("bottom tab bar assets", () => {
  test("uses imported local icon assets so component image paths do not resolve under /components", async () => {
    const tabBarSource = await Bun.file(sourcePath("components/BottomTabBar.vue")).text();

    expect(tabBarSource.includes('import homeIconUrl from "@/static/tab-png/home.png";')).toEqual(true);
    expect(tabBarSource.includes("icon: homeIconUrl")).toEqual(true);
    expect(tabBarSource.includes('icon: "static/tab-png/home.png"')).toEqual(false);
  });

  test("keeps the tab bar component under a single root wrapper for mp-weixin renderer stability", async () => {
    const tabBarSource = await Bun.file(sourcePath("components/BottomTabBar.vue")).text();

    expect(tabBarSource.includes('<view class="custom-tabbar-shell">')).toEqual(true);
    expect(tabBarSource.includes(":class=\"['custom-tabbar', shouldShowCreateEntry ? '' : 'custom-tabbar-no-create']\"")).toEqual(true);
    expect(tabBarSource.includes(":class=\"['custom-tabbar', isOpen ? 'custom-tabbar-open' : '']\"")).toEqual(false);
  });

  test("opens a radial create menu from the center tab button", async () => {
    const tabBarSource = await Bun.file(sourcePath("components/BottomTabBar.vue")).text();

    expect(tabBarSource.includes("custom-tab-plus-open")).toEqual(true);
    expect(tabBarSource.includes('{{ isOpen ? "×" : "+" }}')).toEqual(true);
    expect(tabBarSource.includes("create-menu-overlay-open")).toEqual(true);
    expect(tabBarSource.includes("create-menu-backdrop")).toEqual(true);
    expect(tabBarSource.includes("create-menu-action-left")).toEqual(true);
    expect(tabBarSource.includes("create-menu-action-center")).toEqual(true);
    expect(tabBarSource.includes("create-menu-action-right")).toEqual(true);
    expect(tabBarSource.includes("create-menu-icon-match")).toEqual(true);
    expect(tabBarSource.includes("create-menu-icon-ball")).toEqual(true);
    expect(tabBarSource.includes("create-menu-icon-team")).toEqual(true);
    expect(tabBarSource.includes("shouldHideCreationEntrances")).toEqual(true);
    expect(tabBarSource.includes("const shouldShowCreateEntry = computed(() => !shouldHideCreationEntrances.value);")).toEqual(true);
    expect(tabBarSource.includes("custom-tabbar-no-create")).toEqual(true);
    expect(tabBarSource.includes('<template v-if="shouldShowCreateEntry">')).toEqual(true);
    expect(tabBarSource.includes('<template v-else>')).toEqual(true);
    expect(tabBarSource.includes('v-if="shouldShowCreateEntry" :class="[\'create-menu-overlay\'')).toEqual(true);
    expect(tabBarSource.includes('<text class="create-menu-action-icon">赛</text>')).toEqual(false);
    expect(tabBarSource.includes('<text class="create-menu-action-icon">约</text>')).toEqual(false);
    expect(tabBarSource.includes('<text class="create-menu-action-icon">队</text>')).toEqual(false);
    expect(tabBarSource.includes("创建比赛")).toEqual(true);
    expect(tabBarSource.includes("创建散人约球")).toEqual(true);
    expect(tabBarSource.includes("创建球队")).toEqual(true);
    expect(tabBarSource.includes('url: "/pages/challenges/create-individual/index?kind=individual"')).toEqual(true);
    expect(tabBarSource.includes("transition: opacity 260ms ease, transform 280ms cubic-bezier")).toEqual(true);
    expect(tabBarSource.includes("backdrop-filter: blur")).toEqual(true);
    expect(tabBarSource.includes("custom-tabbar-open")).toEqual(false);
    expect(tabBarSource.includes("fab-sheet")).toEqual(false);
  });

  test("keeps hidden create actions out of the hit-test tree until the menu opens", async () => {
    const tabBarSource = await Bun.file(sourcePath("components/BottomTabBar.vue")).text();
    const actionBlock = tabBarSource.slice(
      tabBarSource.indexOf(".create-menu-action {"),
      tabBarSource.indexOf(".create-menu-overlay-open .create-menu-action {"),
    );
    const openActionBlock = tabBarSource.slice(
      tabBarSource.indexOf(".create-menu-overlay-open .create-menu-action {"),
      tabBarSource.indexOf(".create-menu-action-left {"),
    );

    expect(actionBlock.includes("pointer-events: none;")).toEqual(true);
    expect(actionBlock.includes("pointer-events: auto;")).toEqual(false);
    expect(openActionBlock.includes("pointer-events: auto;")).toEqual(true);
  });

  test("keeps bottom tab icons large enough to balance the center create button", async () => {
    const globalStyles = await Bun.file(sourcePath("uni.css")).text();

    expect(globalStyles.includes("width: 58rpx;")).toEqual(true);
    expect(globalStyles.includes("height: 52rpx;")).toEqual(true);
    expect(globalStyles.includes("width: 48rpx;")).toEqual(true);
    expect(globalStyles.includes("height: 48rpx;")).toEqual(true);
    expect(globalStyles.includes("width: 40rpx;")).toEqual(false);
    expect(globalStyles.includes("height: 40rpx;")).toEqual(false);
  });

  test("uses an opaque bottom tab bar background", async () => {
    const globalStyles = await Bun.file(sourcePath("uni.css")).text();

    expect(globalStyles.includes("background: #ffffff;")).toEqual(true);
    expect(globalStyles.includes("background: rgba(255, 255, 255, 0.96);")).toEqual(false);
  });

  test("keeps icon labels visually close to their tab icons", async () => {
    const globalStyles = await Bun.file(sourcePath("uni.css")).text();
    const customTabItemBlock = globalStyles.slice(
      globalStyles.indexOf(".custom-tab-item {"),
      globalStyles.indexOf(".custom-tab-icon-shell {"),
    );

    expect(customTabItemBlock.includes("gap: 0;")).toEqual(true);
    expect(customTabItemBlock.includes("gap: 6rpx;")).toEqual(false);
    expect(globalStyles.includes("margin-top: -2rpx;")).toEqual(true);
  });

  test("does not add an oversized center cutout behind the create button", async () => {
    const globalStyles = await Bun.file(sourcePath("uni.css")).text();

    expect(globalStyles.includes(".custom-tabbar::before")).toEqual(false);
    expect(globalStyles.includes("top: -58rpx;")).toEqual(false);
    expect(globalStyles.includes("height: 132rpx;")).toEqual(false);
    expect(globalStyles.includes(".custom-tab-item-center .custom-tab-label")).toEqual(false);
  });
});
