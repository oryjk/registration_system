import { expect, test } from "@playwright/test";

for (const timezoneId of ["UTC", "America/Los_Angeles", "Asia/Shanghai"]) {
  test.describe(`Beijing schedule in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test("shows the Beijing calendar day and submits UTC after date/time edits", async ({
      page,
    }, testInfo) => {
      const admin = {
        id: 1,
        username: "timezone-admin",
        role: "super_admin",
        status: "active",
        is_super_admin: true,
        created_at: "2026-10-01T16:30:00Z",
      };
      const match = {
        id: "11111111-1111-4111-8111-111111111111",
        name: "跨时区比赛",
        publication_mode: "online_team",
        opponent_state: "recruiting",
        status: "registering",
        host_team_id: 1,
        host_team_name: "北京时间队",
        away_team_id: null,
        away_team_name: null,
        opponent_name: null,
        players_per_team: 8,
        host_score: null,
        away_score: null,
        start_time: "2026-10-01T16:30:00Z",
        end_time: "2026-10-01T18:30:00Z",
        registration_start_at: "2026-09-01T00:00:00Z",
        registration_end_at: "2026-10-01T14:30:00Z",
        location: "测试场地",
        location_latitude: null,
        location_longitude: null,
        description: null,
        created_by_user_id: null,
        created_by_admin_id: 1,
        host_color: "#ffffff",
        away_color: "#ff0000",
        is_free: false,
        payment_mode: "postpaid",
        fee_per_person_cents: 0,
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      };
      await page.route("**/api/v1/admin/**", async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        let data: unknown = {};
        if (pathname.endsWith("/auth/login")) {
          data = {
            access_token: "timezone-test-token",
            token_type: "Bearer",
            admin,
          };
        } else if (pathname.endsWith("/auth/me")) {
          data = admin;
        } else if (pathname.endsWith("/teams")) {
          data = [
            {
              id: 1,
              name: "北京时间队",
              description: null,
              logo_url: null,
              captain_id: null,
              captain: null,
              status: "active",
              created_at: "2026-09-01T00:00:00Z",
              updated_at: "2026-09-01T00:00:00Z",
            },
          ];
        } else if (pathname.endsWith(`/matches/${match.id}`)) {
          data = { match, groups: [] };
        }
        await route.fulfill({ json: { code: 0, message: "ok", data } });
      });
      await page.route("**/health", (route) =>
        route.fulfill({ json: { status: "ok" } }),
      );
      await page.goto("/login");
      await page.getByPlaceholder("管理员账号").fill(admin.username);
      await page.getByPlaceholder("密码").fill("test-password");
      await page.getByRole("button", { name: /登\s*录/ }).click();
      await expect(page).toHaveURL(/\/$/);

      await page.goto(`/matches/${match.id}/edit`);
      const schedule = page.getByRole("button", {
        name: "比赛时间",
        exact: true,
      });
      await expect(schedule).toHaveText("2026-10-02 00:30");
      await schedule.click();
      const selected = page.locator('[aria-selected="true"]');
      await expect(selected).toContainText("2");
      await expect(page.locator('[data-slot="popover-content"]')).toHaveCSS(
        "opacity",
        "1",
      );
      await page.screenshot({
        path: testInfo.outputPath("beijing-calendar.png"),
      });
      await page.locator('[data-day="2026-10-03"] button').click();
      await page.getByLabel("时间", { exact: true }).fill("01:45");
      await page.getByRole("button", { name: "确定", exact: true }).click();
      await expect(schedule).toHaveText("2026-10-03 01:45");

      const request = page.waitForRequest(
        (request) =>
          request.method() === "PATCH" &&
          request.url().endsWith(`/matches/${match.id}`),
      );
      await page.getByRole("button", { name: "保存比赛" }).click();
      expect((await request).postDataJSON()).toMatchObject({
        start_time: "2026-10-02T17:45:00.000Z",
        end_time: "2026-10-02T19:45:00.000Z",
        registration_start_at: "2026-09-01T00:00:00.000Z",
        registration_end_at: "2026-10-02T15:45:00.000Z",
      });
    });
  });
}
