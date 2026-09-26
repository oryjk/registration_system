import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";
import { registeredPages } from "@/test/registeredPages";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

const secondaryPages = [
  { path: "src/pages/teams/manage/index.vue", title: "球队管理", titleBinding: 'title="球队管理"' },
  { path: "src/pages/teams/create/index.vue", title: "创建球队", titleBinding: 'title="创建球队"' },
  { path: "src/pages/teams/join/index.vue", title: "加入球队", titleBinding: 'title="加入球队"' },
  { path: "src/pages/matches/create/index.vue", title: "创建比赛", titleBinding: ":title=\"editId ? '修改比赛' : '创建比赛'\"" },
  { path: "src/pages/notifications/index.vue", title: "消息中心", titleBinding: 'title="消息中心"' },
  { path: "src/pages/billing/index.vue", title: "账单明细", titleBinding: 'title="账单明细"' },
  { path: "src/pages/profile/setup/index.vue", title: "完善资料", titleBinding: ':title="headerTitle"' },
];

describe("secondary page navigation", () => {
  test("uses navigateBack with a home fallback", async () => {
    const source = await Bun.file(miniPath("src/components/AppTabHeader.vue")).text();

    expect(source.includes("function handleBack")).toEqual(true);
    expect(source.includes("getCurrentPages()")).toEqual(true);
    expect(source.includes("uni.navigateBack")).toEqual(true);
    expect(source.includes("uni.switchTab")).toEqual(true);
    expect(source.includes("/pages/home/index")).toEqual(true);
  });

  for (const page of secondaryPages) {
    test(`${page.path} uses the shared secondary page header`, async () => {
      const source = await Bun.file(miniPath(page.path)).text();

      expect(source.includes('import AppTabHeader from "@/components/AppTabHeader.vue";')).toEqual(true);
      expect(source.includes(`<AppTabHeader ${page.titleBinding} showBack`)).toEqual(true);
      expect(source.includes('import PageBackButton from "@/components/PageBackButton.vue";')).toEqual(false);
      expect(source.includes("<PageBackButton")).toEqual(false);
    });
  }

  test("secondary pages use custom navigation so the shared header is not duplicated", async () => {
    const source = await Bun.file(miniPath("src/pages.json")).text();
    const pages = registeredPages(JSON.parse(source));

    for (const page of [
      "pages/teams/manage/index",
      "pages/teams/create/index",
      "pages/teams/join/index",
      "pages/matches/create/index",
      "pages/notifications/index",
      "pages/billing/index",
      "pages/profile/setup/index",
    ]) {
      expect(pages.find((entry) => entry.path === page)?.style?.navigationStyle).toEqual("custom");
    }
  });

  test("match detail uses the same custom header style as tab pages with a back affordance", async () => {
    const source = await Bun.file(miniPath("src/pages/matches/detail.vue")).text();

    expect(source.includes('import AppTabHeader from "@/components/AppTabHeader.vue";')).toEqual(true);
    expect(source.includes(":title=\"match?.name || '比赛报名'\" showBack")).toEqual(true);
    expect(source.includes('import PageBackButton from "@/components/PageBackButton.vue";')).toEqual(false);
    expect(source.includes("<PageBackButton fixed")).toEqual(false);
  });

  test("app tab header can render an integrated back button", async () => {
    const source = await Bun.file(miniPath("src/components/AppTabHeader.vue")).text();

    expect(source.includes("showBack?: boolean")).toEqual(true);
    expect(source.includes("function handleBack")).toEqual(true);
    expect(source.includes("uni.navigateBack")).toEqual(true);
    expect(source.includes("app-tab-header-capsule")).toEqual(true);
  });
});
