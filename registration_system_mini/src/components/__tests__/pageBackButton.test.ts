import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

const miniRoot = "/Users/carlwang/registration_system/registration_system_mini";

const secondaryPages = [
  { path: "src/pages/teams/manage/index.vue", title: "球队管理", titleBinding: 'title="球队管理"' },
  { path: "src/pages/matches/create/index.vue", title: "创建比赛", titleBinding: ':title="pageMode === \'edit\' ? \'编辑比赛\' : \'创建比赛\'"' },
  { path: "src/pages/challenges/detail.vue", title: "约队详情", titleBinding: ':title="pageTitle"' },
  { path: "src/pages/notifications/index.vue", title: "消息中心", titleBinding: 'title="消息中心"' },
  { path: "src/pages/billing/index.vue", title: "账单明细", titleBinding: 'title="账单明细"' },
  { path: "src/pages/profile/setup/index.vue", title: "完善资料", titleBinding: ':title="headerTitle"' },
];

describe("PageBackButton", () => {
  test("uses navigateBack with a home fallback", async () => {
    const source = await Bun.file(`${miniRoot}/src/components/PageBackButton.vue`).text();

    expect(source.includes("function handleBack")).toEqual(true);
    expect(source.includes("getCurrentPages()")).toEqual(true);
    expect(source.includes("uni.navigateBack")).toEqual(true);
    expect(source.includes("uni.switchTab")).toEqual(true);
    expect(source.includes("/pages/home/index")).toEqual(true);
  });

  for (const page of secondaryPages) {
    test(`${page.path} uses the shared secondary page header`, async () => {
      const source = await Bun.file(`${miniRoot}/${page.path}`).text();

      expect(source.includes('import AppTabHeader from "@/components/AppTabHeader.vue";')).toEqual(true);
      expect(source.includes(`<AppTabHeader ${page.titleBinding} showBack`)).toEqual(true);
      expect(source.includes('import PageBackButton from "@/components/PageBackButton.vue";')).toEqual(false);
      expect(source.includes("<PageBackButton")).toEqual(false);
    });
  }

  test("secondary pages use custom navigation so the shared header is not duplicated", async () => {
    const source = await Bun.file(`${miniRoot}/src/pages.json`).text();

    for (const page of [
      "pages/teams/manage/index",
      "pages/matches/create/index",
      "pages/challenges/detail",
      "pages/notifications/index",
      "pages/billing/index",
      "pages/profile/setup/index",
    ]) {
      const pageIndex = source.indexOf(`"path": "${page}"`);
      expect(pageIndex >= 0).toEqual(true);
      const nextPageIndex = source.indexOf('"path": "', pageIndex + 1);
      const block = source.slice(pageIndex, nextPageIndex >= 0 ? nextPageIndex : source.length);
      expect(block.includes('"navigationStyle": "custom"')).toEqual(true);
    }
  });

  test("match detail uses the same custom header style as tab pages with a back affordance", async () => {
    const source = await Bun.file(`${miniRoot}/src/pages/matches/detail.vue`).text();

    expect(source.includes('import AppTabHeader from "@/components/AppTabHeader.vue";')).toEqual(true);
    expect(source.includes('<AppTabHeader title="比赛报名" showBack')).toEqual(true);
    expect(source.includes('import PageBackButton from "@/components/PageBackButton.vue";')).toEqual(false);
    expect(source.includes("<PageBackButton fixed")).toEqual(false);
  });

  test("app tab header can render an integrated back button", async () => {
    const source = await Bun.file(`${miniRoot}/src/components/AppTabHeader.vue`).text();

    expect(source.includes("showBack?: boolean")).toEqual(true);
    expect(source.includes("function handleBack")).toEqual(true);
    expect(source.includes("uni.navigateBack")).toEqual(true);
    expect(source.includes("app-tab-header-back")).toEqual(true);
  });
});
