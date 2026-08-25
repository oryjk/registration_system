import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

// 主题靠每页 page-meta 注入 page 级变量覆盖；任何新页面漏挂都会出现“半绿半橙”的混色页面。
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

  test("pages with dialog scroll lock merge theme overrides into one page-style", async () => {
    const matchDetail = await Bun.file(miniPath("src/pages/matches/detail.vue")).text();
    const teamManage = await Bun.file(miniPath("src/pages/teams/manage/index.vue")).text();

    expect(matchDetail.includes(':page-style="metaPageStyle"')).toEqual(true);
    expect(matchDetail.includes('"overflow: hidden;"')).toEqual(true);
    expect(teamManage.includes(':page-style="metaPageStyle"')).toEqual(true);
    expect(teamManage.includes('"overflow: hidden;"')).toEqual(true);
  });
});
