import { symlink, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const routeBase = process.env.PLAYWRIGHT_DIST_BASE;
const matchID = "11111111-1111-4111-8111-111111111111";

test.describe("Nginx 子路径路由", () => {
  test.skip(!routeBase, "仅在 dist 路由验证中运行");

  test("深链接、刷新、静态资源和 404 保持在路由基址内", async ({
    page,
    request,
  }, testInfo) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const assetPaths: string[] = [];
    const assetStatuses = new Map<string, number>();

    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => failedRequests.push(request.url()));
    page.on("request", (request) => {
      if (
        ["script", "stylesheet", "font", "image"].includes(
          request.resourceType(),
        )
      ) {
        assetPaths.push(new URL(request.url()).pathname);
      }
    });
    page.on("response", (response) => {
      if (
        ["script", "stylesheet", "font", "image"].includes(
          response.request().resourceType(),
        )
      ) {
        assetStatuses.set(new URL(response.url()).pathname, response.status());
      }
    });

    const loginAssetPath = `${routeBase}login-football.jpg`;
    await page.goto(`${routeBase}login`);
    await expect(page.getByPlaceholder("管理员账号")).toBeVisible();
    await expect.poll(() => assetStatuses.get(loginAssetPath)).toBe(200);
    await page.reload();
    await expect(page.getByPlaceholder("管理员账号")).toBeVisible();
    await expect.poll(() => assetStatuses.get(loginAssetPath)).toBe(200);
    await page.screenshot({
      path: testInfo.outputPath("nginx-login.png"),
      fullPage: true,
    });

    await page.addInitScript(() => {
      localStorage.setItem("registration-admin-go.token.v1", "e2e-admin-token");
    });
    await page.route("**/api/admin/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          message: "ok",
          data: {
            id: 1,
            username: "e2e-super-admin",
            role: "super_admin",
            status: "active",
            is_super_admin: true,
            created_at: "2026-07-15T08:30:00Z",
          },
        }),
      });
    });
    await page.route(`**/api/admin/matches/${matchID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          message: "ok",
          data: {
            match: {
              id: matchID,
              name: "Nginx 深链接验证赛",
              publication_mode: "online_team",
              opponent_state: "recruiting",
              status: "registering",
              host_team_id: 1,
              host_team_name: "开发联队",
              away_team_id: null,
              away_team_name: null,
              opponent_name: null,
              players_per_team: 8,
              start_time: "2026-08-10T11:00:00Z",
              end_time: "2026-08-10T13:00:00Z",
              location: "滨江足球场",
              location_latitude: null,
              location_longitude: null,
              description: null,
              created_by_user_id: null,
              created_by_admin_id: 1,
              created_at: "2026-07-15T08:30:00Z",
              updated_at: "2026-07-15T08:30:00Z",
            },
            groups: [],
          },
        }),
      });
    });

    const detailPath = `${routeBase}matches/${matchID}?tab=groups#roster`;
    await page.goto(detailPath);
    const detailTitle = page
      .getByRole("main")
      .getByText("Nginx 深链接验证赛", { exact: true });
    await expect(detailTitle).toBeVisible();
    await page.reload();
    await expect(detailTitle).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("nginx-match-detail.png"),
      fullPage: true,
    });

    expect(assetPaths.length).toBeGreaterThan(0);
    expect(assetPaths.every((path) => path.startsWith(routeBase))).toBe(true);

    const origin = new URL(page.url()).origin;
    const traversal = await request.get(
      `${origin}${routeBase}%2e%2e%2fpackage.json`,
    );
    expect(traversal.status()).toBe(404);

    const outsideLinkName = `outside-${testInfo.project.name}.json`;
    const outsideLinkPath = resolve("dist", outsideLinkName);
    await symlink(resolve("package.json"), outsideLinkPath);
    try {
      const symlinkTraversal = await request.get(
        `${origin}${routeBase}${outsideLinkName}`,
      );
      expect(symlinkTraversal.status()).toBe(404);
    } finally {
      await unlink(outsideLinkPath);
    }

    await page.goto(`${routeBase}unknown-route`);
    await expect(page.getByText("页面不存在")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("nginx-not-found.png"),
      fullPage: true,
    });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});
