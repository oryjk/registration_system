import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

async function read(path: string) {
  return Bun.file(miniPath(path)).text();
}

describe("FloatingLoginPrompt", () => {
  test("is mounted by the shared app tab header so every page using the header gets the login guide", async () => {
    const headerSource = await read("src/components/AppTabHeader.vue");

    expect(headerSource.includes('import FloatingLoginPrompt from "@/components/FloatingLoginPrompt.vue";')).toEqual(true);
    expect(headerSource.includes("<FloatingLoginPrompt />")).toEqual(true);
  });

  test("renders a bottom floating login guide with the action on the right", async () => {
    const source = await read("src/components/FloatingLoginPrompt.vue");

    expect(source.includes('class="floating-login-prompt"')).toEqual(true);
    expect(source.includes("position: fixed;")).toEqual(true);
    expect(source.includes("bottom: calc(env(safe-area-inset-bottom) + 126rpx);")).toEqual(true);
    expect(source.includes("justify-content: space-between;")).toEqual(true);
    expect(source.includes("请先登录")).toEqual(true);
    expect(source.includes("登录后查看你的比赛、出勤和球队数据。")).toEqual(true);
    expect(source.includes('class="floating-login-button" @tap="goToLogin"')).toEqual(true);
    expect(source.includes("await refreshSessionContext();")).toEqual(true);
    expect(source.includes("function getCurrentPageRoute")).toEqual(true);
    expect(source.includes('uni.$emit("session:login-completed", { fromRoute })')).toEqual(true);
    expect(source.includes('uni.switchTab({ url: "/pages/user/index" });')).toEqual(false);
  });
});
