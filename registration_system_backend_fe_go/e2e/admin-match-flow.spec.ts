import { expect, test, type Page } from "@playwright/test";

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("管理员账号").fill(username!);
  await page.getByPlaceholder("密码").fill(password!);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/$/);
}

async function loginWithMockAdmin(page: Page) {
  await page.route("**/api/admin/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "ok",
        data: {
          access_token: "e2e-admin-token",
          token_type: "Bearer",
          admin: {
            id: 1,
            username: "e2e-admin",
            role: "super_admin",
            status: "active",
            is_super_admin: true,
            created_at: "2026-07-15T08:30:00Z",
          },
        },
      }),
    });
  });
  await page.goto("/login");
  await page.getByPlaceholder("管理员账号").fill("e2e-admin");
  await page.getByPlaceholder("密码").fill("e2e-password");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/$/);
}

async function openNavigation(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 0) < 992) {
    await page.getByLabel("打开导航").click();
  }
  await page.getByRole("link", { name }).click();
}

function matchItem(id: string, name: string, status: "registering" | "ended") {
  return {
    id,
    name,
    publication_mode: "online_team",
    opponent_state: "recruiting",
    status,
    host_team_id: 1,
    host_team_name: "开发联队",
    away_team_id: null,
    away_team_name: null,
    opponent_name: null,
    players_per_team: 8,
    start_time: "2026-07-21T02:30:00Z",
    end_time: "2026-07-21T04:30:00Z",
    location: "滨江足球场",
    location_latitude: null,
    location_longitude: null,
    description: null,
    created_by_user_id: null,
    created_by_admin_id: 1,
    created_at: "2026-07-15T08:30:00Z",
    updated_at: "2026-07-15T08:30:00Z",
  };
}

test("管理员可以登录并查看比赛详情", async ({ page }, testInfo) => {
  test.skip(!username || !password, "需要 ADMIN_USERNAME 和 ADMIN_PASSWORD");

  await login(page);
  await openNavigation(page, "比赛管理");
  await expect(page.getByRole("heading", { name: "比赛管理" })).toBeVisible();
  await expect(page.getByText("周末管理端联调赛")).toBeVisible();

  await page.getByLabel("查看周末管理端联调赛").click();
  await expect(page.getByRole("heading", { name: "周末管理端联调赛" })).toBeVisible();
  await expect(page.getByText("滨江足球场 2 号场")).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("match-detail.png"), fullPage: true });

  await page.reload();
  await expect(page.getByRole("heading", { name: "周末管理端联调赛" })).toBeVisible();
});

test("超级管理员可以创建场馆管理员", async ({ page }, testInfo) => {
  test.skip(!username || !password, "需要 ADMIN_USERNAME 和 ADMIN_PASSWORD");

  await login(page);
  await page.route("**/api/admin/admins", async (route) => {
    const createdAt = "2026-07-15T08:30:00Z";
    const data = route.request().method() === "POST"
      ? { id: 8, username: "venue-e2e", role: "admin", status: "active", is_super_admin: false, created_at: createdAt }
      : [{ id: 1, username: "admin", role: "super_admin", status: "active", is_super_admin: true, created_at: createdAt }];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data }),
    });
  });

  await openNavigation(page, "场馆管理员");
  await expect(page.getByRole("heading", { name: "场馆管理员" })).toBeVisible();
  await page.getByRole("button", { name: "创建管理员" }).click();
  await page.getByLabel("登录账号").fill("venue-e2e");
  await page.getByLabel("初始密码").fill("venue-pass-123");
  await page.getByLabel("确认密码").fill("venue-pass-123");
  await page.getByRole("dialog", { name: "创建场馆管理员" }).getByRole("button", { name: /创\s*建/ }).click();

  await expect(page.getByText("venue-e2e")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "创建场馆管理员" })).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("admin-list.png"), fullPage: true });
});

test("比赛列表可以取消并永久删除比赛", async ({ page }, testInfo) => {
  test.skip(!username || !password, "需要 ADMIN_USERNAME 和 ADMIN_PASSWORD");

  await login(page);
  const cancellable = matchItem("11111111-1111-4111-8111-111111111111", "待取消比赛", "registering");
  const removable = matchItem("22222222-2222-4222-8222-222222222222", "已结束比赛", "ended");
  let cancelled = false;
  let deleted = false;
  await page.route("**/api/admin/matches**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let data: unknown;
    if (request.method() === "GET" && pathname.endsWith("/matches")) {
      data = { items: [cancellable, removable], total: 2, page: 1, page_size: 20 };
    } else if (request.method() === "PATCH" && pathname.endsWith(`/${cancellable.id}/status`)) {
      cancelled = true;
      data = { match: { ...cancellable, status: "cancelled" }, groups: [] };
    } else if (request.method() === "DELETE" && pathname.endsWith(`/${removable.id}`)) {
      deleted = true;
      data = { id: removable.id };
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 0, message: "ok", data }) });
  });

  await openNavigation(page, "比赛管理");
  await page.getByLabel("取消待取消比赛").click();
  await page.getByRole("button", { name: /确\s*认\s*取\s*消/ }).click();
  await expect(page.getByRole("row", { name: /待取消比赛.*已取消/ })).toBeVisible();

  await page.getByLabel("删除已结束比赛").click();
  await page.getByRole("button", { name: /永\s*久\s*删\s*除/ }).click();
  await expect(page.getByText("已结束比赛")).toBeHidden();
  expect(cancelled).toBe(true);
  expect(deleted).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("match-actions.png"), fullPage: true });
});

test("管理员可以增删查改球队", async ({ page }, testInfo) => {
  test.skip(!username || !password, "需要 ADMIN_USERNAME 和 ADMIN_PASSWORD");

  await login(page);
  const timestamp = "2026-07-15T08:30:00Z";
  let teams = [
    { id: 1, name: "东安联队", description: "周末八人制球队", logo_url: null, captain_id: 42, status: "active", created_at: timestamp, updated_at: timestamp },
    { id: 2, name: "西城联队", description: null, logo_url: null, captain_id: null, status: "frozen", created_at: timestamp, updated_at: timestamp },
  ];
  await page.route("**/api/admin/teams**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const id = Number(pathname.split("/").at(-1));
    let data: unknown;
    if (request.method() === "GET" && pathname.endsWith("/teams")) {
      data = teams;
    } else if (request.method() === "GET") {
      data = teams.find((team) => team.id === id);
    } else if (request.method() === "POST") {
      const payload = request.postDataJSON() as { name: string; description: string | null };
      data = { id: 3, ...payload, logo_url: null, captain_id: null, status: "active", created_at: timestamp, updated_at: timestamp };
      teams = [...teams, data as typeof teams[number]];
    } else if (request.method() === "PATCH") {
      const payload = request.postDataJSON() as { name: string; description: string | null; status: "active" | "frozen" };
      const updated = { ...teams.find((team) => team.id === id)!, ...payload, updated_at: timestamp };
      teams = teams.map((team) => team.id === id ? updated : team);
      data = updated;
    } else if (request.method() === "DELETE") {
      teams = teams.filter((team) => team.id !== id);
      data = { id };
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 0, message: "ok", data }) });
  });

  await openNavigation(page, "球队管理");
  await expect(page.getByRole("heading", { name: "球队管理" })).toBeVisible();
  await expect(page.getByText("东安联队")).toBeVisible();

  await page.getByRole("button", { name: "创建球队" }).click();
  const createDialog = page.getByRole("dialog", { name: "创建球队" });
  await createDialog.getByLabel("球队名称").fill("滨江联队");
  await createDialog.getByLabel("球队简介").fill("工作日晚间训练");
  await createDialog.getByRole("button", { name: /创\s*建/ }).click();
  await expect(page.getByText("滨江联队")).toBeVisible();

  await page.getByLabel("编辑东安联队").click();
  const editDialog = page.getByRole("dialog", { name: "编辑球队" });
  await editDialog.getByLabel("球队名称").fill("东安新队");
  await editDialog.getByText("冻结", { exact: true }).click();
  await editDialog.getByRole("button", { name: /保\s*存/ }).click();
  await expect(page.getByText("东安新队")).toBeVisible();

  await page.getByLabel("查看东安新队").click();
  const detailDrawer = page.getByRole("dialog", { name: "球队详情" });
  await expect(detailDrawer.getByText("周末八人制球队")).toBeVisible();
  await detailDrawer.getByRole("button", { name: "关闭" }).click();

  await page.getByLabel("删除西城联队").click();
  await page.getByRole("button", { name: /永\s*久\s*删\s*除/ }).click();
  await expect(page.getByText("西城联队")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("team-management.png"), fullPage: true });
});

test("管理员可以管理球队成员和队长", async ({ page }, testInfo) => {
  await loginWithMockAdmin(page);
  const timestamp = "2026-07-15T08:30:00Z";
  let team = {
    id: 1,
    name: "东安联队",
    description: "周末八人制球队",
    logo_url: null,
    captain_id: 42 as number | null,
    status: "active",
    created_at: timestamp,
    updated_at: timestamp,
  };
  let members = [
    { id: 1, user_id: 42, nickname: "王队长", avatar_url: null, role: "captain", status: "active", joined_at: timestamp },
    { id: 2, user_id: 43, nickname: "李队员", avatar_url: null, role: "member", status: "active", joined_at: timestamp },
  ];
  const candidates = [
    { user_id: 44, nickname: "张新人", avatar_url: null },
  ];

  await page.route("**/api/admin/teams**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let data: unknown;

    if (request.method() === "GET" && pathname.endsWith("/teams")) {
      data = [team];
    } else if (request.method() === "GET" && pathname.endsWith("/member-candidates")) {
      data = candidates.filter((candidate) => !members.some((member) => member.user_id === candidate.user_id));
    } else if (request.method() === "GET" && pathname.endsWith("/members")) {
      data = { team, members };
    } else if (request.method() === "POST" && pathname.endsWith("/members")) {
      const payload = request.postDataJSON() as { user_id: number; role: string };
      const candidate = candidates.find((item) => item.user_id === payload.user_id)!;
      members = [...members, { id: 3, ...candidate, role: payload.role, status: "active", joined_at: timestamp }];
      data = { team, members };
    } else if (request.method() === "PATCH" && pathname.endsWith("/captain")) {
      const payload = request.postDataJSON() as { user_id: number | null };
      team = { ...team, captain_id: payload.user_id, updated_at: timestamp };
      members = members.map((member) => ({
        ...member,
        role: payload.user_id === member.user_id ? "captain" : member.role === "captain" ? "member" : member.role,
      }));
      data = { team, members };
    } else if (request.method() === "PATCH" && /\/members\/\d+$/.test(pathname)) {
      const userID = Number(pathname.split("/").at(-1));
      const payload = request.postDataJSON() as { role: string; status: string };
      members = members.map((member) => member.user_id === userID ? { ...member, ...payload } : member);
      data = { team, members };
    } else if (request.method() === "DELETE" && /\/members\/\d+$/.test(pathname)) {
      const userID = Number(pathname.split("/").at(-1));
      members = members.filter((member) => member.user_id !== userID);
      data = { team, members };
    } else {
      await route.fallback();
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 0, message: "ok", data }) });
  });

  await openNavigation(page, "球队管理");
  await page.getByLabel("管理东安联队成员").click();
  const memberDrawer = page.getByRole("dialog", { name: "东安联队 · 成员管理" });
  await expect(memberDrawer.getByRole("row", { name: /王队长/ })).toBeVisible();
  await expect(memberDrawer.getByRole("row", { name: /李队员/ })).toBeVisible();

  const candidatesLoaded = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/member-candidates"));
  await memberDrawer.getByRole("button", { name: "添加成员" }).click();
  await candidatesLoaded;
  const addDialog = page.getByRole("dialog", { name: "添加球队成员" });
  await addDialog.getByRole("combobox", { name: "选择球员" }).click();
  await page.locator(".ant-select-item-option").filter({ hasText: "张新人 · ID 44" }).click();
  await addDialog.getByRole("button", { name: /添\s*加/ }).click();
  await expect(memberDrawer.getByText("张新人")).toBeVisible();

  await memberDrawer.getByLabel("编辑李队员").click();
  const editDialog = page.getByRole("dialog", { name: "编辑李队员" });
  await editDialog.locator(".ant-select-selector").click();
  await page.locator(".ant-select-item-option").filter({ hasText: "副队长" }).click();
  await editDialog.getByText("冻结", { exact: true }).click();
  await editDialog.getByRole("button", { name: /保\s*存/ }).click();

  await memberDrawer.getByLabel("设置张新人为队长").click();
  await page.getByRole("button", { name: /确\s*认/ }).click();
  await expect(memberDrawer.getByText("当前队长").locator("..").getByText("张新人")).toBeVisible();

  await memberDrawer.getByLabel("移除王队长").click();
  await page.getByRole("button", { name: /^移\s*除$/ }).click();
  await expect(memberDrawer.getByRole("row", { name: /王队长/ })).toBeHidden();

  await page.screenshot({ path: testInfo.outputPath("team-members.png"), fullPage: true });
});

test("发布比赛时可以确认创建不存在的主队", async ({ page }, testInfo) => {
  test.skip(!username || !password, "需要 ADMIN_USERNAME 和 ADMIN_PASSWORD");

  await login(page);
  const timestamp = "2026-07-15T08:30:00Z";
  let createdPayload: { name: string; description: string | null } | undefined;
  await page.route("**/api/admin/teams**", async (route) => {
    const request = route.request();
    let data: unknown;
    if (request.method() === "GET") {
      data = [{ id: 1, name: "已有联队", description: null, logo_url: null, captain_id: null, status: "active", created_at: timestamp, updated_at: timestamp }];
    } else if (request.method() === "POST") {
      createdPayload = request.postDataJSON() as typeof createdPayload;
      data = { id: 9, ...createdPayload, logo_url: null, captain_id: null, status: "active", created_at: timestamp, updated_at: timestamp };
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 0, message: "ok", data }) });
  });

  await page.goto("/matches/new");
  await expect(page.getByRole("heading", { name: "发布比赛" })).toBeVisible();
  const teamSelect = page.getByRole("combobox", { name: "主队", exact: true });
  await teamSelect.click();
  await teamSelect.fill("临时联队");
  await page.getByRole("button", { name: "保存比赛" }).click();

  const confirmDialog = page.getByRole("dialog", { name: "球队不存在" });
  await expect(confirmDialog.getByText("是否创建“临时联队”并设为本场比赛的主队？")).toBeVisible();
  await confirmDialog.getByRole("button", { name: /创\s*建\s*并\s*选\s*择/ }).click();

  await expect(confirmDialog).toBeHidden();
  await expect(page.locator(".ant-select-selection-item").filter({ hasText: "临时联队" })).toBeVisible();
  expect(createdPayload).toEqual({ name: "临时联队", description: null });
  await page.screenshot({ path: testInfo.outputPath("match-create-missing-team.png"), fullPage: true });
});
