import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("bottom tab bar assets", () => {
  test("uses imported local icon assets so component image paths do not resolve under /components", async () => {
    const tabBarSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/components/BottomTabBar.vue",
    ).text();

    expect(tabBarSource.includes('import homeIconUrl from "@/static/tab-png/home.png";')).toEqual(true);
    expect(tabBarSource.includes("icon: homeIconUrl")).toEqual(true);
    expect(tabBarSource.includes('icon: "static/tab-png/home.png"')).toEqual(false);
  });

  test("keeps the tab bar component under a single root wrapper for mp-weixin renderer stability", async () => {
    const tabBarSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/components/BottomTabBar.vue",
    ).text();

    expect(tabBarSource.includes('<view class="custom-tabbar-shell">')).toEqual(true);
    expect(tabBarSource.includes('<view class="custom-tabbar">')).toEqual(true);
  });
});
