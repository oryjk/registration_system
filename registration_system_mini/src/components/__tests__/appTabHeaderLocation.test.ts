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

describe("AppTabHeader location visibility", () => {
  test("location display is opt-in on the shared header", async () => {
    const source = await read("src/components/AppTabHeader.vue");

    expect(source.includes("showLocation?: boolean")).toEqual(true);
    expect(source.includes("showLocation: false")).toEqual(true);
    expect(source.includes('v-if="props.showLocation"')).toEqual(true);
  });

  test("home and match registration pages opt into location display", async () => {
    const home = await read("src/pages/home/index.vue");
    const matchDetail = await read("src/pages/matches/detail.vue");

    expect(home.includes('<AppTabHeader title="首页" showLocation')).toEqual(true);
    expect(matchDetail.includes('<AppTabHeader title="比赛报名" showBack showLocation')).toEqual(true);
  });

  test("non-location tab pages keep the header without current location", async () => {
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

    expect(source.includes('class="app-tab-header-title" @tap="handleTitleTap"')).toEqual(true);
    expect(source.includes("DOUBLE_TAP_SCROLL_INTERVAL_MS")).toEqual(true);
    expect(source.includes("uni.pageScrollTo({ scrollTop: 0, duration: 300 })")).toEqual(true);
    expect(source.includes("padding: 10rpx 0;")).toEqual(true);
  });

  test("renders the header in solid neo style instead of glass blur", async () => {
    const source = await read("src/components/AppTabHeader.vue");

    expect(source.includes("backdrop-filter")).toEqual(false);
    expect(source.includes("linear-gradient(180deg, var(--neo-color-surface-translucent)")).toEqual(false);
    expect(source.includes("background: var(--neo-color-page);")).toEqual(true);
    expect(source.includes("border-bottom: var(--neo-border-default);")).toEqual(true);
    expect(source.includes("box-shadow: 3rpx 3rpx 0 var(--neo-color-text);")).toEqual(true);
  });
});
