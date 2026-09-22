import { describe, expect, test } from "bun:test";
import { prefersReducedMotion } from "@/utils/reducedMotion";

/** 可变 matches 的 matchMedia 桩：模拟用户运行中切换系统"减少动态效果"。 */
function installFakeWindow(initialMatches: boolean) {
  const fakeMediaQuery = { matches: initialMatches };
  const globalWithWindow = globalThis as { window?: unknown };
  const originalWindow = globalWithWindow.window;
  globalWithWindow.window = {
    matchMedia: () => fakeMediaQuery,
  };
  return {
    fakeMediaQuery,
    restore() {
      globalWithWindow.window = originalWindow;
    },
  };
}

describe("prefersReducedMotion live reads", () => {
  test("reflects a settings flip at runtime instead of caching the first result", () => {
    const { fakeMediaQuery, restore } = installFakeWindow(false);
    try {
      expect(prefersReducedMotion()).toEqual(false);
      // 用户打开"减少动态效果"：下一次读取必须立即反映，CSS 媒体查询才能与 JS 同步。
      fakeMediaQuery.matches = true;
      expect(prefersReducedMotion()).toEqual(true);
      // 再关闭：同样立即回落。
      fakeMediaQuery.matches = false;
      expect(prefersReducedMotion()).toEqual(false);
    } finally {
      restore();
    }
  });

  test("returns false without a window (mini-program runtimes)", () => {
    const globalWithWindow = globalThis as { window?: unknown };
    const originalWindow = globalWithWindow.window;
    delete globalWithWindow.window;
    try {
      expect(prefersReducedMotion()).toEqual(false);
    } finally {
      globalWithWindow.window = originalWindow;
    }
  });
});
