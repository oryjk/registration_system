import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

// 原生 page-meta + 页面根节点双重绑定，避免 H5 缓存页共享 page-meta 的样式目标。
describe("accent theme page-meta coverage", () => {
  test("every registered page injects the accent theme via page-meta", async () => {
    const raw = await Bun.file(miniPath("src/pages.json")).text();
    const pages = (JSON.parse(raw).pages as { path: string }[]).map((item) => item.path);
    expect(pages.length >= 20).toEqual(true);

    for (const path of pages) {
      const source = await Bun.file(miniPath(`src/${path}.vue`)).text();
      expect(source.includes("<page-meta")).toEqual(true);
      expect(source.includes("themePageStyle")).toEqual(true);
    }
  });

  test("every local page owns a reactive theme scope instead of relying on H5 page-meta", async () => {
    const { pages } = JSON.parse(await Bun.file(miniPath("src/pages.json")).text()) as { pages: { path: string }[] };
    for (const { path } of pages) {
      if (path === "pages/webview/index") continue; // 外部文档由其自身管理样式。
      const source = await Bun.file(miniPath(`src/${path}.vue`)).text();
      const root = source.split("<template>")[1]?.match(/<view\b[^>]*>/)?.[0] || "";
      expect(root.includes("app-theme-scope")).toEqual(true);
      expect(/:style="[^"]*themePageStyle/.test(root)).toEqual(true);
    }
    const tokens = await Bun.file(miniPath("src/styles/design-tokens.css")).text();
    expect(tokens.includes("page,\n.app-theme-scope {")).toEqual(true);
  });

  test("pages with dialog scroll lock merge theme overrides into one page-style", async () => {
    const matchDetail = await Bun.file(miniPath("src/pages/matches/detail.vue")).text();
    const teamManage = await Bun.file(miniPath("src/pages/teams/manage/index.vue")).text();

    expect(matchDetail.includes(':page-style="metaPageStyle"')).toEqual(true);
    expect(matchDetail.includes('"overflow: hidden;"')).toEqual(true);
    expect(teamManage.includes(':page-style="metaPageStyle"')).toEqual(true);
    expect(teamManage.includes('"overflow: hidden;"')).toEqual(true);
  });
});
