import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("app route fallback", () => {
  test("redirects missing pages to the home tab", async () => {
    const source = await Bun.file(sourcePath("App.vue")).text();

    expect(source.includes("onPageNotFound")).toEqual(true);
    expect(source.includes('const HOME_PAGE_PATH = "/pages/home/index";')).toEqual(true);
    expect(source.includes("uni.reLaunch")).toEqual(true);
    expect(source.includes("url: HOME_PAGE_PATH")).toEqual(true);
  });

  test("silently bootstraps the session during app launch", async () => {
    const source = await Bun.file(sourcePath("App.vue")).text();
    const reviewStore = await Bun.file(sourcePath("stores/miniReview.ts")).text();

    expect(source.includes("restoreSessionFromStorage")).toEqual(false);
    expect(source.includes('import { ensureSessionReady, useAppSession } from "@/stores/appSession";')).toEqual(true);
    expect(source.includes('import { preloadMiniReviewStatus } from "@/stores/miniReview";')).toEqual(true);
    expect(source.includes("void preloadMiniReviewStatus();")).toEqual(true);
    expect(reviewStore.includes("const forceMiniReviewMode = String(import.meta.env.VITE_FORCE_MINI_REVIEW_MODE || \"\").trim().toLowerCase() === \"true\";")).toEqual(true);
    expect(reviewStore.includes("const shouldCheckMiniReview = import.meta.env.PROD;")).toEqual(true);
    expect(reviewStore.includes("forceMiniReviewMode || (shouldCheckMiniReview")).toEqual(true);
    expect(reviewStore.includes("if (forceMiniReviewMode)")).toEqual(true);
    expect(reviewStore.includes("开发环境强制审核态")).toEqual(true);
    expect(reviewStore.includes("console.info(`[mini-review] forced in dev: version=${MINI_PROGRAM_VERSION}, reviewing=true`);")).toEqual(true);
    expect(reviewStore.includes("if (!shouldCheckMiniReview)")).toEqual(true);
    expect(reviewStore.includes('console.info("[mini-review] skipped: non-production env");')).toEqual(true);
    expect(reviewStore.includes("console.info(`[mini-review] loaded: version=${MINI_PROGRAM_VERSION}, reviewing=${status.is_reviewing}`);")).toEqual(true);
    expect(reviewStore.includes("const shouldHideCreationEntrances = computed(")).toEqual(true);
    expect(reviewStore.includes("!reviewStatusReady.value || !reviewStatusAvailable.value || reviewMode.value")).toEqual(true);
    expect(reviewStore.includes("reviewMode.value = false;")).toEqual(true);
    expect(source.includes("ensureSessionReady")).toEqual(true);
    expect(source.includes("syncUnreadCount")).toEqual(false);
  });
});
