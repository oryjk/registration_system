import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("app route fallback", () => {
  test("redirects missing pages to the home tab", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/App.vue",
    ).text();

    expect(source.includes("onPageNotFound")).toEqual(true);
    expect(source.includes('const HOME_PAGE_PATH = "/pages/home/index";')).toEqual(true);
    expect(source.includes("uni.reLaunch")).toEqual(true);
    expect(source.includes("url: HOME_PAGE_PATH")).toEqual(true);
  });

  test("restores only existing sessions during app launch", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/App.vue",
    ).text();

    expect(source.includes("restoreSessionFromStorage")).toEqual(true);
    expect(source.includes('import { restoreSessionFromStorage, useAppSession } from "@/stores/appSession";')).toEqual(true);
    expect(source.includes("ensureSessionReady")).toEqual(false);
    expect(source.includes("if (currentUser.value)")).toEqual(true);
  });
});
