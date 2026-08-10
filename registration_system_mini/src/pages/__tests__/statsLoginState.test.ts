import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

const pagePath = sourcePath("pages/teams/index.vue");

describe("stats page login state", () => {
  test("shows a login guide instead of statistics when the user is logged out", async () => {
    const source = await Bun.file(pagePath).text();

    expect(source.includes('import { hasManualLogout } from "@/utils/authStorage";')).toEqual(true);
    expect(source.includes("const requiresLogin = ref(false);")).toEqual(true);
    expect(source.includes("function resetStatsData")).toEqual(true);
    expect(source.includes("function goToLogin")).toEqual(false);
    expect(source.includes('v-if="requiresLogin" class="stats-login-card"')).toEqual(false);
    expect(source.includes("stats-login-button")).toEqual(false);
    expect(source.includes('<template v-if="!requiresLogin">')).toEqual(true);
  });

  test("reloads statistics after login completes on the same page", async () => {
    const source = await Bun.file(pagePath).text();

    expect(source.includes('uni.$on("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
    expect(source.includes('uni.$off("session:login-completed", handleSessionLoginCompleted);')).toEqual(true);
    expect(source.includes("function handleSessionLoginCompleted")).toEqual(true);
    expect(source.includes("void loadPageData();")).toEqual(true);
  });
});
