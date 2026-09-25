import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

async function read(path: string) {
  return Bun.file(miniPath(path)).text();
}

describe("AppTabHeader", () => {
  test("shared header no longer ships a current-location entry", async () => {
    const source = await read("src/components/AppTabHeader.vue");

    expect(source.includes("showLocation")).toEqual(false);
    expect(source.includes("app-tab-header-location")).toEqual(false);
    expect(source.includes("location-sheet")).toEqual(false);
    expect(source.includes("useCurrentLocation")).toEqual(false);
  });

  test("match registration page keeps the header without the location entry", async () => {
    const home = await read("src/pages/home/index.vue");
    const matchDetail = await read("src/pages/matches/detail.vue");

    expect(home.includes('<AppTabHeader title="首页" showLocation')).toEqual(false);
    expect(matchDetail.includes('<AppTabHeader title="比赛报名" showBack showLocation')).toEqual(false);
    // 详情页导航标题动态显示比赛名（加载前回落通用标题）。
    expect(matchDetail.includes(":title=\"match?.name || '比赛报名'\" showBack />")).toEqual(true);
  });

  test("tab pages keep the header without current location", async () => {
    const activities = await read("src/pages/activities/index.vue");
    const stats = await read("src/pages/teams/index.vue");
    const mine = await read("src/pages/user/index.vue");

    expect(activities.includes('<AppTabHeader title="约队大厅" showLocation')).toEqual(false);
    expect(stats.includes('<AppTabHeader title="统计" showLocation')).toEqual(false);
    expect(mine.includes('<AppTabHeader title="我的" showLocation')).toEqual(false);
  });

  test("mine page can use the shared fixed tab header without the location affordance", async () => {
    const mine = await read("src/pages/user/index.vue");

    expect(mine.includes('import AppTabHeader from "@/components/AppTabHeader.vue";')).toEqual(true);
    expect(mine.includes('<AppTabHeader title="我的" />')).toEqual(true);
    expect(mine.includes("mine-hero-heading")).toEqual(false);
  });

  test("double tapping the header title scrolls the page back to top", async () => {
    const source = await read("src/components/AppTabHeader.vue");

    // 热区覆盖整条头部行（含右侧空白）；胶囊内返回/回首页 stop 隔离，不参与双击判定。
    expect(source.includes('class="app-tab-header" :style="contentStyle" @tap="handleHeaderTap"')).toEqual(true);
    expect(source.includes('@tap.stop="handleBack"')).toEqual(true);
    expect(source.includes('@tap.stop="handleHome"')).toEqual(true);
    expect(source.includes('class="app-tab-header-title" @tap=')).toEqual(false);
    expect(source.includes("DOUBLE_TAP_SCROLL_INTERVAL_MS")).toEqual(true);
    expect(source.includes("uni.pageScrollTo({ scrollTop: 0, duration: 300 })")).toEqual(true);
  });

  test("uses the shared glass tokens without a divider and keeps plain headers transparent", async () => {
    const source = await read("src/components/AppTabHeader.vue");
    const styles = (source.match(/<style\b[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    const shell = styles.match(/\.app-tab-header-shell\s*\{([^}]*)\}/)?.[1]?.replace(/\s+/g, "") ?? "";
    const plain = styles.match(/\.app-tab-header-shell-plain\s*\{([^}]*)\}/)?.[1]?.replace(/\s+/g, "") ?? "";

    // 分别检查普通壳层和 plain 覆盖，避免另一条规则中的同名属性让断言误通过。
    for (const declaration of [
      "position:fixed;",
      "background:var(--ui-glass-bg);",
      "-webkit-backdrop-filter:var(--ui-glass-filter);",
      "backdrop-filter:var(--ui-glass-filter);",
      "box-shadow:var(--ui-glass-header-shadow);",
      "border-bottom:none;",
    ]) {
      expect(`;${shell}`.includes(`;${declaration}`)).toEqual(true);
    }
    expect(source.includes("props.plain ? 'app-tab-header-shell-plain'")).toEqual(true);
    for (const declaration of [
      "background:transparent;",
      "-webkit-backdrop-filter:none;",
      "backdrop-filter:none;",
      "box-shadow:none;",
      "border-bottom:none;",
    ]) {
      expect(`;${plain}`.includes(`;${declaration}`)).toEqual(true);
    }
    expect(shell.includes("linear-gradient(")).toEqual(false);
  });

  test("back and home use independent navigation buttons within the safe area", async () => {
    const source = await read("src/components/AppTabHeader.vue");

    // 导航高度仍对齐原生胶囊，内部改成独立的浅底图标按钮。
    expect(source.includes('class="app-tab-header-capsule"')).toEqual(true);
    expect(source.includes('class="app-tab-header-capsule-divider"')).toEqual(false);
    expect(source.includes("height: `${navMetrics.headerMinHeight}px`")).toEqual(true);
    expect(source.includes('name="arrow-left"')).toEqual(true);
    expect(source.includes('name="home"')).toEqual(true);
    expect(source.includes("box-shadow: 3rpx 3rpx 0 var(--ui-color-text);")).toEqual(false);
  });
});
