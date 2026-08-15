import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

const root = "/Users/carlwang/projects/registration_system/registration_system_mini/src";

describe("App session foundation", () => {
  test("provides an explicit acceptance H5 build command", async () => {
    const packageJson = JSON.parse(await Bun.file(miniPath("package.json")).text()) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["build:h5:acceptance"]).toEqual("uni build --mode test");
  });

  test("uses the single WeChat login endpoint", async () => {
    const authSource = await Bun.file(`${root}/api/auth.ts`).text();
    const sessionSource = await Bun.file(`${root}/stores/appSession.ts`).text();

    expect(authSource.includes('url: "/auth/wechat/login"')).toEqual(true);
    expect(sessionSource.includes("wechatLogin(code)")).toEqual(true);
    expect(sessionSource.includes("wxLogin(code)")).toEqual(false);
    expect(sessionSource.includes("loginWithOpenId")).toEqual(false);
  });

  test("exposes an explicit H5 test-user login entry point", async () => {
    const authSource = await Bun.file(`${root}/api/auth.ts`).text();
    const sessionSource = await Bun.file(`${root}/stores/appSession.ts`).text();
    const panelSource = await Bun.file(miniPath("src/components/H5TestLoginPanel.vue")).text();

    expect(authSource.includes('url: "/test-auth/users"')).toEqual(true);
    expect(authSource.includes('url: "/test-auth/login"')).toEqual(true);
    expect(sessionSource.includes('import.meta.env.MODE !== "production"')).toEqual(true);
    expect(sessionSource.includes('import.meta.env.VITE_ENABLE_H5_TEST_LOGIN === "true"')).toEqual(true);
    expect(panelSource.includes('import.meta.env.MODE !== "production"')).toEqual(true);
    expect(panelSource.includes('import.meta.env.VITE_ENABLE_H5_TEST_LOGIN === "true"')).toEqual(true);
    expect(sessionSource.includes("export async function loginWithTestUser")).toEqual(true);
    expect(sessionSource.includes("testLogin(userId)")).toEqual(true);
  });
});
