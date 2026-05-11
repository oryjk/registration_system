import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

import { getAppPlatform, getWindowMetrics } from "../systemInfo";

const runtime = globalThis as typeof globalThis & {
  uni?: {
    getAppBaseInfo?: () => {
      platform?: string;
      statusBarHeight?: number;
    };
    getWindowInfo?: () => {
      windowWidth?: number;
      statusBarHeight?: number;
    };
    getSystemInfoSync?: () => {
      platform?: string;
      windowWidth?: number;
      statusBarHeight?: number;
    };
  };
};

describe("system info helpers", () => {
  test("prefers modern mini program APIs when available", () => {
    runtime.uni = {
      getAppBaseInfo: () => ({
        platform: "devtools",
        statusBarHeight: 24,
      }),
      getWindowInfo: () => ({
        windowWidth: 430,
        statusBarHeight: 24,
      }),
      getSystemInfoSync: () => ({
        platform: "ios",
        windowWidth: 375,
        statusBarHeight: 20,
      }),
    };

    expect(getAppPlatform()).toEqual("devtools");
    expect(getWindowMetrics()).toEqual({
      windowWidth: 430,
      statusBarHeight: 24,
    });
    delete runtime.uni;
  });

  test("falls back to legacy sync API only when modern ones are unavailable", () => {
    runtime.uni = {
      getSystemInfoSync: () => ({
        platform: "ios",
        windowWidth: 390,
        statusBarHeight: 22,
      }),
    };

    expect(getAppPlatform()).toEqual("ios");
    expect(getWindowMetrics()).toEqual({
      windowWidth: 390,
      statusBarHeight: 22,
    });
    delete runtime.uni;
  });

  test("app tab header should rely on mount-safe platform helpers instead of component-level onShow", async () => {
    const headerSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/components/AppTabHeader.vue",
    ).text();

    expect(headerSource.includes('import { computed, onMounted, ref } from "vue";')).toEqual(true);
    expect(headerSource.includes("onMounted(() => {")).toEqual(true);
    expect(headerSource.includes("onShow(() => {")).toEqual(false);
  });
});
