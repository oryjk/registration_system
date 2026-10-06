import { expect, type Page, test } from "@playwright/test";
import type { MatchDetail } from "../src/types/match";

const matchId = "9bc67782-3008-4321-99bc-dbf2fe4f5ff0";
const groupId = "36d1220d-ce77-4cd4-9b88-a6d41ff1b164";

function matchDetail(): MatchDetail {
  return {
    match: {
      id: matchId,
      name: "周末友谊赛",
      publication_mode: "offline_confirmed",
      opponent_state: "no_recruitment",
      status: "ended",
      host_team_id: 7,
      host_team_name: "主队",
      away_team_id: null,
      away_team_name: null,
      opponent_name: "客队",
      players_per_team: 8,
      host_score: null,
      away_score: null,
      start_time: "2026-10-01T08:00:00Z",
      end_time: "2026-10-01T10:00:00Z",
      registration_start_at: null,
      registration_end_at: null,
      location: "滨江球场",
      location_latitude: null,
      location_longitude: null,
      description: null,
      host_color: null,
      away_color: null,
      created_by_user_id: null,
      created_by_admin_id: 1,
      created_at: "2026-09-30T08:00:00Z",
      updated_at: "2026-09-30T08:00:00Z",
      is_free: true,
      payment_mode: "postpaid",
      fee_per_person_cents: 0,
    },
    groups: [
      {
        id: groupId,
        kind: "host_team",
        team_id: 7,
        min_players: 8,
        max_players: 16,
        status: "open",
        registrations: [
          {
            user_id: 42,
            nickname: "Carl Wang",
            real_name: "王睿",
            avatar_url: null,
            member_role: "captain",
            status: "attending",
            registration_count: 1,
            paid: false,
          },
          {
            user_id: 43,
            nickname: "唐斯",
            real_name: null,
            avatar_url: null,
            member_role: "member",
            status: "unregistered",
            registration_count: 1,
            paid: false,
          },
        ],
      },
    ],
  };
}

async function setup(page: Page, detail = matchDetail(), hold = false) {
  const writes: Array<{ url: string; body: { status: string } }> = [];
  let reject = false;
  let release = () => {};
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.addInitScript(() =>
    localStorage.setItem("registration-admin-go.token.v1", "test-token"),
  );
  await page.route("**/api/v1/admin/auth/me", (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          id: 1,
          username: "admin",
          role: "super_admin",
          is_super_admin: true,
          status: "active",
        },
      },
    }),
  );
  await page.route("**/api/v1/admin/matches/**", async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      writes.push({ url: request.url(), body: request.postDataJSON() });
      if (hold) await barrier;
      if (reject) {
        await route.fulfill({
          status: 409,
          json: { code: 409, message: "报名人数已达上限" },
        });
        return;
      }
      const userId = Number(request.url().split("/").at(-1));
      const record = detail.groups[0].registrations.find(
        (item) => item.user_id === userId,
      );
      if (!record) throw new Error("Unexpected registration target");
      record.status = request.postDataJSON().status;
      await route.fulfill({
        json: {
          code: 0,
          data: {
            ...record,
            group_id: groupId,
            updated_at: "2026-10-06T08:00:00Z",
          },
        },
      });
    } else {
      await route.fulfill({ json: { code: 0, data: detail } });
    }
  });
  await page.goto(`/matches/${matchId}`);
  return {
    writes,
    release: () => release(),
    fail: (value: boolean) => {
      reject = value;
    },
  };
}

for (const theme of ["light", "dark"]) {
  test(`${theme}: 选中后确认才保存，取消不提交`, async ({ page }, testInfo) => {
    await page.addInitScript(
      (value) => localStorage.setItem("registration-admin-theme", value),
      theme,
    );
    const { writes } = await setup(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()?.width ?? 1440);
    const row = page.getByRole("radiogroup", { name: "Carl Wang的报名状态" });
    await row.getByRole("radio", { name: "请假", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "确认修改报名状态" });
    await expect(dialog).toContainText("Carl Wang");
    await expect(dialog).toContainText("参赛 → 请假");
    expect(writes).toHaveLength(0);
    await page.screenshot({
      path: testInfo.outputPath(`confirmation-${theme}.png`),
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(
      row.getByRole("radio", { name: "参赛", exact: true }),
    ).toBeChecked();
    expect(writes).toHaveLength(0);
    await row.getByRole("radio", { name: "请假", exact: true }).click();
    await dialog.getByRole("button", { name: "确认修改", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      row.getByRole("radio", { name: "请假", exact: true }),
    ).toBeChecked();
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toEqual({ status: "leave" });
    expect(writes[0].url).toContain(
      `/matches/${matchId}/groups/${groupId}/registrations/42`,
    );
    await page
      .getByRole("radiogroup", { name: "唐斯的报名状态" })
      .getByRole("radio", { name: "参赛", exact: true })
      .click();
    await expect(dialog).toContainText("未报名 → 参赛");
    await dialog.getByRole("button", { name: "确认修改", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page
        .getByRole("radiogroup", { name: "唐斯的报名状态" })
        .getByRole("radio", { name: "参赛", exact: true }),
    ).toBeChecked();
    await page.screenshot({
      path: testInfo.outputPath(`registration-${theme}.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("保存失败保留原状态和确认框，允许取消", async ({ page }) => {
  const state = await setup(page);
  state.fail(true);
  const row = page.getByRole("radiogroup", { name: "Carl Wang的报名状态" });
  await row.getByRole("radio", { name: "缺席", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "确认修改报名状态" });
  await dialog.getByRole("button", { name: "确认修改", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("报名人数已达上限");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(
    row.getByRole("radio", { name: "参赛", exact: true }),
  ).toBeChecked();
  expect(state.writes).toHaveLength(1);
});

test("已取消比赛禁用报名状态修改", async ({ page }) => {
  const detail = matchDetail();
  detail.match.status = "cancelled";
  await setup(page, detail);
  const row = page.getByRole("radiogroup", { name: "Carl Wang的报名状态" });
  await expect(
    page.locator('button[role="radio"][value="attending"]').first(),
  ).toBeDisabled();
  await expect(
    row.getByRole("radio", { name: "请假", exact: true }),
  ).toBeDisabled();
});

test("保存期间禁用重复提交和关闭确认框", async ({ page }) => {
  const state = await setup(page, matchDetail(), true);
  const row = page.getByRole("radiogroup", { name: "Carl Wang的报名状态" });
  await row.getByRole("radio", { name: "请假", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "确认修改报名状态" });
  await dialog.getByRole("button", { name: "确认修改", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "保存中…", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "取消", exact: true }),
  ).toBeDisabled();
  await expect(
    page.locator('button[role="radio"][value="attending"]').first(),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  state.release();
  await expect(dialog).not.toBeVisible();
  expect(state.writes).toHaveLength(1);
  await expect(
    row.getByRole("radio", { name: "请假", exact: true }),
  ).toBeChecked();
});
