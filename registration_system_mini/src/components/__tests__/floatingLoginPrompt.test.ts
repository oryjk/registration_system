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

  test("renders a bottom floating login guide on neo surfaces with the action on the right", async () => {
    const source = await read("src/components/FloatingLoginPrompt.vue");

    expect(source.includes('class="floating-login-prompt"')).toEqual(true);
    expect(source.includes('class="floating-login-prompt__card"')).toEqual(true);
    // 定位与卡片皮肤必须写在本组件节点上：custom-class 穿不透小程序组件样式隔离。
    expect(source.includes("custom-class=\"")).toEqual(false);
    expect(source.includes("NeoButton")).toEqual(true);
    expect(source.includes('variant="lime"')).toEqual(true);
    expect(source.includes("position: fixed;")).toEqual(true);
    expect(source.includes("bottom: calc(env(safe-area-inset-bottom) + 126rpx);")).toEqual(true);
    expect(source.includes("justify-content: space-between;")).toEqual(true);
    expect(source.includes("var(--neo-border-strong)")).toEqual(true);
    expect(source.includes("var(--neo-shadow-raised)")).toEqual(true);
    expect(source.includes("请先登录")).toEqual(true);
    expect(source.includes("登录后查看你的比赛、出勤和球队数据。")).toEqual(true);
    expect(source.includes("@click=\"goToLogin\"")).toEqual(true);
    expect(source.includes("await refreshSessionContext();")).toEqual(true);
    expect(source.includes("function getCurrentPageRoute")).toEqual(true);
    expect(source.includes('uni.$emit("session:login-completed", { fromRoute })')).toEqual(true);
    expect(source.includes('uni.switchTab({ url: "/pages/user/index" });')).toEqual(false);
  });

  test("keeps the entry visible after a failed attempt and only emits login-completed when a user is signed in", async () => {
    const source = await read("src/components/FloatingLoginPrompt.vue");

    // 登录成功才广播事件：H5 无微信通道的静默返回不能伪装成登录成功。
    expect(source.includes("if (!currentUser.value) {")).toEqual(true);
    // 登出标记在点击瞬间被清除，armed 状态保证失败后浮条还能重新显示。
    expect(source.includes("isPromptArmed")).toEqual(true);
    expect(source.includes("watch(logoutState")).toEqual(true);
    // 失败重试：isNavigatingToLogin 必须在 finally 复位，否则入口被锁死。
    expect(source.includes("isNavigatingToLogin.value = false;")).toEqual(true);
  });

  test("detail pages reload themselves on session login completed so guest views do not stick", async () => {
    const matchDetailSource = await read("src/pages/matches/useMatchDetailPage.ts");
    const matchGuestLoginSource = await read("src/pages/matches/useMatchGuestLogin.ts");
    const challengeDetailSource = await read("src/pages/challenges/detail.vue");

    for (const source of [matchDetailSource, challengeDetailSource]) {
      expect(source.includes('uni.$on("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
      expect(source.includes('uni.$off("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
    }
    // 比赛详情页的重载回调抽在游客登录 composable 里，挑战详情页内联定义。
    for (const source of [matchGuestLoginSource, challengeDetailSource]) {
      expect(source.includes("function handleSessionLoginCompleted")).toEqual(true);
    }
  });
});
