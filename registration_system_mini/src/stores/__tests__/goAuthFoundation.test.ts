import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

const root = "/Users/carlwang/projects/registration_system/registration_system_mini/src";

describe("Go app session foundation", () => {
  test("uses the single Go WeChat login endpoint", async () => {
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

    expect(authSource.includes('url: "/test-auth/users"')).toEqual(true);
    expect(authSource.includes('url: "/test-auth/login"')).toEqual(true);
    expect(sessionSource.includes("export async function loginWithTestUser")).toEqual(true);
    expect(sessionSource.includes("testLogin(userId)")).toEqual(true);
  });
});
