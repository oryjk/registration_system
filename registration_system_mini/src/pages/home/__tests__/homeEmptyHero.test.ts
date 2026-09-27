import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("HomeEmptyHero", () => {
  test("turns the empty home into intent-aware next-step guidance", async () => {
    const source = await Bun.file(miniPath("src/pages/home/components/HomeEmptyHero.vue")).text();

    expect(source.includes("你想先做什么？")).toEqual(true);
    expect(source.includes("创建你的球队")).toEqual(true);
    expect(source.includes("找一场球踢")).toEqual(true);
    expect(source.includes("下一场还没安排")).toEqual(true);
    expect(source.includes('(event: "create-pickup"): void;')).toEqual(true);
    expect(source.includes("state.actions")).toEqual(true);
  });

  test("loads the team-manager illustration from a runtime-config url instead of a bundled asset", async () => {
    const source = await Bun.file(miniPath("src/pages/home/components/HomeEmptyHero.vue")).text();

    // URL 由首页从运行配置取出后经 prop 传入，组件不知道 MinIO 地址。
    expect(source.includes("socialImageUrl?: string;")).toEqual(true);
    expect(source.includes(':src="selectedImageUrl"')).toEqual(true);
    expect(source.includes('mode="widthFix"')).toEqual(true);
    expect(source.includes("oryjk.cn")).toEqual(false);
    expect(source.includes("data:image")).toEqual(false);
    expect(source.includes("home-empty-social-person")).toEqual(false);
  });

  test("configured artwork has a silent fallback", async () => {
    const source = await Bun.file(miniPath("src/pages/home/components/HomeEmptyHero.vue")).text();

    // 空 URL / 加载失败回退内置球场视觉，不弹 toast。

    expect(source.includes("socialImageFailed")).toEqual(true);
    expect(source.includes('@error="socialImageFailed = true"')).toEqual(true);
    expect(source.includes("showToast")).toEqual(false);
    expect(source.includes("home-empty-hero-field")).toEqual(true);
  });

  test("the home page feeds the runtime-config url via a per-load-cycle shared request", async () => {
    const homeSource = await Bun.file(miniPath("src/pages/home/index.vue")).text();
    const composableSource = await Bun.file(miniPath("src/pages/home/useHomeNextMatchSocialImage.ts")).text();
    const cycleSource = await Bun.file(miniPath("src/pages/home/homeRuntimeConfigCycle.ts")).text();
    const configSource = await Bun.file(miniPath("src/config/runtimeConfig.ts")).text();

    expect(homeSource.includes('import { useHomeNextMatchSocialImage } from "./useHomeNextMatchSocialImage";')).toEqual(true);
    expect(homeSource.includes(":social-image-url=\"nextMatchSocialImageUrl\"")).toEqual(true);
    expect(homeSource.includes("ensureSocialImageLoaded()")).toEqual(true);
    // 每轮 loadPageData 重置共享周期：刷新/重进可重新拉取，而不是整个 App 只请求一次。
    expect(homeSource.includes("homeRuntimeConfig.reset()")).toEqual(true);
    // 首页主加载链不直接请求 runtime config（由 cycle 模块持有）。
    expect(homeSource.includes("loadMiniAppRuntimeConfig")).toEqual(false);
    // 插画使用注入的周期 loader。
    expect(composableSource.includes("loadRuntimeConfig")).toEqual(true);
    expect(composableSource.includes("loadMiniAppRuntimeConfig")).toEqual(false);
    expect(cycleSource.includes("createRuntimeConfigCycle")).toEqual(true);
    // config 层不再提供 App 生命周期级 once 缓存（其他页面继续用 loadMiniAppRuntimeConfig）。
    expect(configSource.includes("loadMiniAppRuntimeConfigOnce")).toEqual(false);
  });

  test("no hardcoded MinIO asset url remains in mini sources", async () => {
    const homePageSource = await Bun.file(miniPath("src/pages/home/index.vue")).text();
    const heroSource = await Bun.file(miniPath("src/pages/home/components/HomeEmptyHero.vue")).text();

    expect(homePageSource.includes("https://oryjk.cn:82/registration/static/home/home-next-match-social.png")).toEqual(false);
    expect(heroSource.includes("https://oryjk.cn:82/registration/static/home/home-next-match-social.png")).toEqual(false);
    expect(heroSource.includes("data:image/png;base64")).toEqual(false);
  });
});
