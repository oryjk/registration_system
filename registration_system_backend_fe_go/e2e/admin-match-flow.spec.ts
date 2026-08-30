import { expect, type Page, test } from "@playwright/test";

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

async function login(page: Page) {
  if (!username || !password) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required");
  }
  await page.goto("/login");
  await page.getByPlaceholder("管理员账号").fill(username);
  await page.getByPlaceholder("密码").fill(password);
  await page.getByRole("button", { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

function mockAdmin(isSuperAdmin: boolean) {
  return {
    id: isSuperAdmin ? 1 : 2,
    username: isSuperAdmin ? "e2e-super-admin" : "e2e-venue-admin",
    role: isSuperAdmin ? "super_admin" : "admin",
    status: "active",
    is_super_admin: isSuperAdmin,
    created_at: "2026-07-15T08:30:00Z",
  };
}

async function loginWithMockAdmin(page: Page, isSuperAdmin = true) {
  const admin = mockAdmin(isSuperAdmin);
  await page.route("**/api/v1/admin/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "ok",
        data: {
          access_token: "e2e-admin-token",
          token_type: "Bearer",
          admin,
        },
      }),
    });
  });
  await page.route("**/api/v1/admin/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data: admin }),
    });
  });
  await page.goto("/login");
  await page.getByPlaceholder("管理员账号").fill(admin.username);
  await page.getByPlaceholder("密码").fill("e2e-password");
  await page.getByRole("button", { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function openNavigation(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 0) < 820) {
    await page.getByRole("button", { name: "打开导航" }).click();
  }
  await page.getByRole("button", { name }).click();
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

test("核心管理页面在桌面和移动视口保持一致", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const timestamp = "2026-07-15T08:30:00Z";
  const matchID = "11111111-1111-4111-8111-111111111111";
  const visualMatch = matchItem(matchID, "视觉巡检赛", "registering");
  const visualTeam = {
    id: 1,
    name: "视觉巡检队",
    description: "运营端视觉回归数据",
    logo_url: null,
    captain_id: null,
    status: "active",
    created_at: timestamp,
    updated_at: timestamp,
  };

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED") {
      failedRequests.push(request.url());
    }
  });

  await page.goto("/login");
  await expect(page.getByPlaceholder("管理员账号")).toBeVisible();
  const loginViewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(loginViewport.scrollWidth).toBeLessThanOrEqual(
    loginViewport.innerWidth,
  );
  const loginContainerSize = await page
    .locator(".login-form-inner")
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(loginContainerSize.scrollWidth).toBeLessThanOrEqual(
    loginContainerSize.clientWidth,
  );
  await page.screenshot({
    path: testInfo.outputPath("login.png"),
    fullPage: true,
  });

  await loginWithMockAdmin(page);
  await page.route("**/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data: { status: "ok" } }),
    });
  });
  await page.route("**/api/v1/admin/teams**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data: [visualTeam] }),
    });
  });
  await page.route("**/api/v1/admin/admins", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data: [mockAdmin(true)] }),
    });
  });
  await page.route("**/api/v1/admin/matches**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith(`/${matchID}`)
      ? { match: visualMatch, groups: [] }
      : { items: [visualMatch], total: 1, page: 1, page_size: 20 };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data }),
    });
  });

  const capture = async (name: string) => {
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });
  };

  await page.goto("/");
  await expect(page.getByText("服务概览", { exact: true })).toBeVisible();
  await capture("dashboard");

  await page.goto("/matches");
  await expect(page.getByText("视觉巡检赛")).toBeVisible();
  await expect(page.getByText("线上约队", { exact: true })).toBeVisible();
  await capture("matches");

  await page.goto("/matches/new");
  await expect(page.getByLabel("比赛名称")).toBeVisible();
  const publicationMode = page.getByLabel("比赛类型");
  await publicationMode.click();
  for (const label of ["线下已约", "线上约队", "散人对手"]) {
    await expect(
      page.getByRole("option").filter({ hasText: label }),
    ).toBeVisible();
  }
  await publicationMode.press("Escape");
  await capture("match-form");

  await page.goto(`/matches/${matchID}`);
  await expect(page.getByText("视觉巡检赛", { exact: true })).toBeVisible();
  await expect(
    page.getByText("线上约队", { exact: true }).first(),
  ).toBeVisible();
  await capture("match-detail");

  await page.goto("/teams");
  await expect(page.getByText("视觉巡检队")).toBeVisible();
  await capture("teams");

  await page.goto("/admins");
  await expect(page.getByText("e2e-super-admin")).toBeVisible();
  await capture("admins");

  await page.goto("/access");
  await expect(
    page.getByRole("main").getByText("接入状态", { exact: true }),
  ).toBeVisible();
  await capture("access");

  await page.goto("/403");
  await expect(page.getByText("无权访问")).toBeVisible();
  await capture("forbidden");

  await page.goto("/visual-unknown-route");
  await expect(page.getByText("页面不存在")).toBeVisible();
  await capture("not-found");

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("管理员可以登录并查看比赛详情", async ({ page }, testInfo) => {
  test.skip(!username || !password, "需要 ADMIN_USERNAME 和 ADMIN_PASSWORD");

  await login(page);
  await openNavigation(page, "比赛管理");
  await expect(
    page.getByRole("main").getByText("比赛管理", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("周末管理端联调赛")).toBeVisible();

  await page.getByLabel("查看周末管理端联调赛").click();
  await expect(
    page.locator("[data-slot='card-title']").filter({
      hasText: "周末管理端联调赛",
    }),
  ).toBeVisible();
  await expect(page.getByText("滨江足球场 2 号场")).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("match-detail.png"),
    fullPage: true,
  });

  await page.reload();
  await expect(
    page.locator("[data-slot='card-title']").filter({
      hasText: "周末管理端联调赛",
    }),
  ).toBeVisible();
});

test("普通管理员不能访问管理员管理权限路由", async ({ page }) => {
  await loginWithMockAdmin(page, false);

  await expect(page.getByRole("link", { name: "场馆管理员" })).toHaveCount(0);
  await page.goto("/admins");
  await expect(page.getByText("无权访问")).toBeVisible();
  await expect(
    page.getByText("当前管理员没有访问此页面的权限。"),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByText("场馆管理员", { exact: true }),
  ).toHaveCount(0);
});

test("超级管理员创建管理员保持权限与 API payload 契约", async ({
  page,
}, testInfo) => {
  await loginWithMockAdmin(page, true);
  const createdAt = "2026-07-15T08:30:00Z";
  let admins = [
    {
      ...mockAdmin(true),
      username: "admin",
      created_at: createdAt,
    },
  ];
  await page.route("**/api/v1/admin/admins", async (route) => {
    const request = route.request();
    let data: unknown;
    if (request.method() === "POST") {
      const payload = request.postDataJSON() as {
        username: string;
        password: string;
      };
      data = {
        id: 8,
        username: payload.username,
        role: "admin",
        status: "active",
        is_super_admin: false,
        created_at: createdAt,
      };
      admins = [data as (typeof admins)[number], ...admins];
    } else {
      data = admins;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data }),
    });
  });

  await openNavigation(page, "场馆管理员");
  await expect(
    page.getByRole("main").getByText("场馆管理员", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "创建管理员" }).click();
  await page.getByLabel("登录账号").fill("venue-e2e");
  await page.getByLabel("初始密码").fill("venue-pass-123");
  await page.getByLabel("确认密码").fill("venue-pass-123");
  const createRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/api/v1/admin/admins"),
  );
  await page
    .getByRole("dialog", { name: "创建场馆管理员" })
    .getByRole("button", { name: /创\s*建/ })
    .click();
  const createPayload = (await createRequest).postDataJSON() as Record<
    string,
    unknown
  >;

  expect(createPayload).toEqual({
    username: "venue-e2e",
    password: "venue-pass-123",
  });

  await expect(page.getByText("venue-e2e")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "创建场馆管理员" }),
  ).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath("admin-list.png"),
    fullPage: true,
  });
});

test("比赛列表可以取消并永久删除比赛", async ({ page }, testInfo) => {
  test.skip(!username || !password, "需要 ADMIN_USERNAME 和 ADMIN_PASSWORD");

  await login(page);
  const cancellable = matchItem(
    "11111111-1111-4111-8111-111111111111",
    "待取消比赛",
    "registering",
  );
  const removable = matchItem(
    "22222222-2222-4222-8222-222222222222",
    "已结束比赛",
    "ended",
  );
  let cancelled = false;
  let deleted = false;
  await page.route("**/api/v1/admin/matches**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let data: unknown;
    if (request.method() === "GET" && pathname.endsWith("/matches")) {
      data = {
        items: [cancellable, removable],
        total: 2,
        page: 1,
        page_size: 20,
      };
    } else if (
      request.method() === "PATCH" &&
      pathname.endsWith(`/${cancellable.id}/status`)
    ) {
      cancelled = true;
      data = { match: { ...cancellable, status: "cancelled" }, groups: [] };
    } else if (
      request.method() === "DELETE" &&
      pathname.endsWith(`/${removable.id}`)
    ) {
      deleted = true;
      data = { id: removable.id };
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data }),
    });
  });

  await openNavigation(page, "比赛管理");
  await page.getByLabel("取消待取消比赛").click();
  await page.getByRole("button", { name: /确\s*认\s*取\s*消/ }).click();
  await expect(
    page.getByRole("row", { name: /待取消比赛.*已取消/ }),
  ).toBeVisible();

  await page.getByLabel("删除已结束比赛").click();
  await page.getByRole("button", { name: /永\s*久\s*删\s*除/ }).click();
  await expect(page.getByText("已结束比赛")).toBeHidden();
  expect(cancelled).toBe(true);
  expect(deleted).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("match-actions.png"),
    fullPage: true,
  });
});

test("比赛筛选写入 URL 并在刷新后恢复", async ({ page }) => {
  await loginWithMockAdmin(page);
  const requestedQueries: string[] = [];
  await page.route("**/api/v1/admin/matches**", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (
      route.request().method() !== "GET" ||
      !requestUrl.pathname.endsWith("/matches")
    ) {
      await route.fallback();
      return;
    }
    requestedQueries.push(requestUrl.search);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "ok",
        data: {
          items: [
            matchItem(
              "11111111-1111-4111-8111-111111111111",
              "周末筛选赛",
              "registering",
            ),
          ],
          total: 60,
          page: Number(requestUrl.searchParams.get("page") || 1),
          page_size: Number(requestUrl.searchParams.get("page_size") || 20),
        },
      }),
    });
  });

  await page.goto(
    "/matches?search=%E5%91%A8%E6%9C%AB&status=ongoing&page=2&page_size=50",
  );
  const search = page.getByPlaceholder("搜索比赛、场地或主队");
  await expect(search).toHaveValue("周末");
  await expect(page.locator(".status-filter")).toContainText("进行中");

  await search.fill("  滨江  ");
  await search.press("Enter");
  await expect(page).toHaveURL(
    /\/matches\?search=%E6%BB%A8%E6%B1%9F&status=ongoing&page_size=50$/,
  );
  await page.locator(".status-filter").click();
  await page.getByRole("option").filter({ hasText: "已结束" }).click();
  await expect(page).toHaveURL(
    /\/matches\?search=%E6%BB%A8%E6%B1%9F&status=ended&page_size=50$/,
  );

  await page.reload();
  await expect(search).toHaveValue("滨江");
  await expect(page.locator(".status-filter")).toContainText("已结束");
  expect(requestedQueries.at(-1)).toBe(
    "?search=%E6%BB%A8%E6%B1%9F&status=ended&page=1&page_size=50",
  );
});

test("比赛创建保持 API payload 契约", async ({ page }) => {
  await loginWithMockAdmin(page);
  const matchID = "44444444-4444-4444-8444-444444444444";
  const timestamp = "2026-07-15T08:30:00Z";

  await page.route("**/api/v1/admin/teams**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "ok",
        data: [
          {
            id: 1,
            name: "开发联队",
            description: null,
            logo_url: null,
            captain_id: null,
            status: "active",
            created_at: timestamp,
            updated_at: timestamp,
          },
        ],
      }),
    });
  });
  await page.route("**/api/v1/admin/matches", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "ok",
        data: {
          match: {
            ...matchItem(matchID, String(payload.name), "registering"),
            ...payload,
          },
          groups: [],
        },
      }),
    });
  });

  await page.goto("/matches/new");
  await page.getByLabel("比赛名称").fill("夏夜联赛");
  const hostTeam = page.getByRole("button", { name: "选择主队" });
  await hostTeam.click();
  await page.getByRole("option").first().click();
  // 比赛时间：日历弹层选日期 + 时间输入；时长独立填写
  await page.getByRole("button", { name: "比赛时间" }).click();
  await page.getByLabel("时间").fill("19:00");
  await page.getByRole("button", { name: "确定" }).click();
  await page.getByLabel("比赛时长（分钟）").fill("120");
  await page.getByLabel("比赛场地").fill("滨江足球场 1 号场");
  await page.getByLabel("纬度").fill("30.123456");
  await page.getByLabel("经度").fill("120.654321");
  await page.getByLabel("比赛说明").fill("保留 API 字段测试");

  const createRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/api/v1/admin/matches"),
  );
  await page.getByRole("button", { name: "保存比赛" }).click();
  const createPayload = (await createRequest).postDataJSON() as Record<
    string,
    unknown
  >;
  expect(Object.keys(createPayload).sort()).toEqual(
    [
      "description",
      "end_time",
      "host_capacity_limit",
      "host_team_id",
      "location",
      "location_latitude",
      "location_longitude",
      "name",
      "opponent_name",
      "players_per_team",
      "publication_mode",
      "start_time",
    ].sort(),
  );
  expect(createPayload).toMatchObject({
    name: "夏夜联赛",
    publication_mode: "online_team",
    host_team_id: 1,
    opponent_name: null,
    players_per_team: 8,
    host_capacity_limit: 12,
    location: "滨江足球场 1 号场",
    location_latitude: 30.123456,
    location_longitude: 120.654321,
    description: "保留 API 字段测试",
  });
  expect(createPayload.start_time).toMatch(/^2026-08-10T.*Z$/);
  expect(createPayload.end_time).toMatch(/^2026-08-10T.*Z$/);
  await expect(page).toHaveURL(`/matches/${matchID}`);
});

test("比赛编辑保持 API payload 契约", async ({ page }) => {
  await loginWithMockAdmin(page);
  const matchID = "33333333-3333-4333-8333-333333333333";
  const timestamp = "2026-07-15T08:30:00Z";
  let storedMatch = matchItem(matchID, "待编辑比赛", "registering");

  await page.route("**/api/v1/admin/teams**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "ok",
        data: [
          {
            id: 1,
            name: "开发联队",
            description: null,
            logo_url: null,
            captain_id: null,
            status: "active",
            created_at: timestamp,
            updated_at: timestamp,
          },
        ],
      }),
    });
  });
  await page.route("**/api/v1/admin/matches**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let data: unknown;
    if (request.method() === "PATCH" && pathname.endsWith(`/${matchID}`)) {
      const payload = request.postDataJSON();
      storedMatch = { ...storedMatch, ...payload };
      data = { match: storedMatch, groups: [] };
    } else if (request.method() === "GET" && pathname.endsWith(`/${matchID}`)) {
      data = { match: storedMatch, groups: [] };
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data }),
    });
  });

  await page.goto(`/matches/${matchID}/edit`);
  await expect(page.getByLabel("比赛名称")).toHaveValue("待编辑比赛");
  await page.getByLabel("比赛名称").fill("夏夜联赛更新");
  await page.getByLabel("比赛场地").fill("滨江足球场 2 号场");
  const updateRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      new URL(request.url()).pathname.endsWith(
        `/api/v1/admin/matches/${matchID}`,
      ),
  );
  await page.getByRole("button", { name: "保存比赛" }).click();
  const updatePayload = (await updateRequest).postDataJSON() as Record<
    string,
    unknown
  >;
  expect(Object.keys(updatePayload).sort()).toEqual(
    [
      "description",
      "end_time",
      "location",
      "location_latitude",
      "location_longitude",
      "name",
      "start_time",
    ].sort(),
  );
  expect(updatePayload).toMatchObject({
    name: "夏夜联赛更新",
    location: "滨江足球场 2 号场",
  });
  expect(updatePayload.start_time).toMatch(/^2026-07-21T.*Z$/);
  expect(updatePayload.end_time).toMatch(/^2026-07-21T.*Z$/);
});

test("管理员可以增删查改球队", async ({ page }, testInfo) => {
  await loginWithMockAdmin(page);
  const timestamp = "2026-07-15T08:30:00Z";
  let teams = [
    {
      id: 1,
      name: "东安联队",
      description: "周末八人制球队",
      logo_url: null,
      captain_id: 42,
      status: "active",
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: 2,
      name: "西城联队",
      description: null,
      logo_url: null,
      captain_id: null,
      status: "frozen",
      created_at: timestamp,
      updated_at: timestamp,
    },
  ];
  await page.route("**/api/v1/admin/teams**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const id = Number(pathname.split("/").at(-1));
    let data: unknown;
    if (request.method() === "GET" && pathname.endsWith("/teams")) {
      data = teams;
    } else if (request.method() === "GET") {
      data = teams.find((team) => team.id === id);
    } else if (request.method() === "POST") {
      const payload = request.postDataJSON() as {
        name: string;
        description: string | null;
      };
      data = {
        id: 3,
        ...payload,
        logo_url: null,
        captain_id: null,
        status: "active",
        created_at: timestamp,
        updated_at: timestamp,
      };
      teams = [...teams, data as (typeof teams)[number]];
    } else if (request.method() === "PATCH") {
      const payload = request.postDataJSON() as {
        name: string;
        description: string | null;
        status: "active" | "frozen";
      };
      const existingTeam = teams.find((team) => team.id === id);
      if (!existingTeam) {
        throw new Error(`Missing mocked team: ${id}`);
      }
      const updated = {
        ...existingTeam,
        ...payload,
        updated_at: timestamp,
      };
      teams = teams.map((team) => (team.id === id ? updated : team));
      data = updated;
    } else if (request.method() === "DELETE") {
      teams = teams.filter((team) => team.id !== id);
      data = { id };
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data }),
    });
  });

  await openNavigation(page, "球队管理");
  await expect(
    page.getByRole("main").getByText("球队管理", { exact: true }),
  ).toBeVisible();
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
  await expect(page.getByRole("row", { name: /西城联队/ })).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath("team-management.png"),
    fullPage: true,
  });
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
    {
      id: 1,
      user_id: 42,
      nickname: "王队长",
      avatar_url:
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
      real_name: "王强",
      phone_number: "13800138000",
      role: "captain",
      status: "active",
      joined_at: timestamp,
    },
    {
      id: 2,
      user_id: 43,
      nickname: "李队员",
      avatar_url: null,
      real_name: "李雷",
      phone_number: null,
      role: "member",
      status: "active",
      joined_at: timestamp,
    },
  ];
  const candidates = [
    {
      user_id: 44,
      nickname: "张新人",
      avatar_url: null,
      real_name: "张新",
      phone_number: "13900139000",
    },
  ];

  let profilePayload:
    | { real_name: string | null; phone_number: string | null }
    | undefined;
  await page.route("**/api/v1/admin/users/*/profile", async (route) => {
    const payload = route.request().postDataJSON() as {
      real_name: string | null;
      phone_number: string | null;
    };
    profilePayload = payload;
    const userID = Number(
      new URL(route.request().url()).pathname.split("/").at(-2),
    );
    members = members.map((member) =>
      member.user_id === userID ? { ...member, ...payload } : member,
    );
    const member = members.find((item) => item.user_id === userID);
    if (!member) {
      throw new Error(`Missing mocked member: ${userID}`);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "ok",
        data: { ...member, id: userID },
      }),
    });
  });

  await page.route("**/api/v1/admin/teams**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let data: unknown;

    if (request.method() === "GET" && pathname.endsWith("/teams")) {
      data = [team];
    } else if (
      request.method() === "GET" &&
      pathname.endsWith("/member-candidates")
    ) {
      data = candidates.filter(
        (candidate) =>
          !members.some((member) => member.user_id === candidate.user_id),
      );
    } else if (request.method() === "GET" && pathname.endsWith("/members")) {
      data = { team, members };
    } else if (request.method() === "POST" && pathname.endsWith("/members")) {
      const payload = request.postDataJSON() as {
        user_id: number;
        role: string;
      };
      const candidate = candidates.find(
        (item) => item.user_id === payload.user_id,
      );
      if (!candidate) {
        throw new Error(`Missing mocked member candidate: ${payload.user_id}`);
      }
      members = [
        ...members,
        {
          id: 3,
          ...candidate,
          role: payload.role,
          status: "active",
          joined_at: timestamp,
        },
      ];
      data = { team, members };
    } else if (request.method() === "PATCH" && pathname.endsWith("/captain")) {
      const payload = request.postDataJSON() as { user_id: number | null };
      team = { ...team, captain_id: payload.user_id, updated_at: timestamp };
      members = members.map((member) => ({
        ...member,
        role:
          payload.user_id === member.user_id
            ? "captain"
            : member.role === "captain"
              ? "member"
              : member.role,
      }));
      data = { team, members };
    } else if (
      request.method() === "PATCH" &&
      /\/members\/\d+$/.test(pathname)
    ) {
      const userID = Number(pathname.split("/").at(-1));
      const payload = request.postDataJSON() as {
        role: string;
        status: string;
      };
      members = members.map((member) =>
        member.user_id === userID ? { ...member, ...payload } : member,
      );
      data = { team, members };
    } else if (
      request.method() === "DELETE" &&
      /\/members\/\d+$/.test(pathname)
    ) {
      const userID = Number(pathname.split("/").at(-1));
      members = members.filter((member) => member.user_id !== userID);
      data = { team, members };
    } else {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data }),
    });
  });

  await openNavigation(page, "球队管理");
  await page.getByLabel("管理东安联队成员").click();
  const memberDrawer = page.getByRole("dialog", {
    name: "东安联队 · 成员管理",
  });
  await expect(
    memberDrawer.getByRole("row", { name: /王强.*13800138000/ }),
  ).toBeVisible();
  await expect(memberDrawer.locator(".member-avatar").first()).toBeVisible();
  await expect
    .poll(() =>
      memberDrawer
        .locator(".member-avatar")
        .first()
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(memberDrawer.getByRole("row", { name: /李雷/ })).toBeVisible();

  const candidatesLoaded = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/member-candidates"),
  );
  await memberDrawer.getByRole("button", { name: "添加成员" }).click();
  await candidatesLoaded;
  const addDialog = page.getByRole("dialog", { name: "添加球队成员" });
  await addDialog.getByRole("combobox", { name: "选择球员" }).click();
  await page
    .getByRole("option")
    .filter({ hasText: "张新 · 13900139000 · ID 44" })
    .click();
  await addDialog.getByRole("button", { name: /添\s*加/ }).click();
  await expect(memberDrawer.getByText("张新", { exact: true })).toBeVisible();

  await memberDrawer.getByLabel("编辑李雷").click();
  const editDialog = page.getByRole("dialog", { name: "编辑李雷" });
  await editDialog.getByRole("textbox", { name: "真实姓名" }).fill("李雷新");
  await editDialog.getByRole("textbox", { name: "手机号" }).fill("13700137000");
  await editDialog.getByRole("combobox", { name: "成员角色" }).click();
  await page.getByRole("option").filter({ hasText: "副队长" }).click();
  await editDialog.getByText("冻结", { exact: true }).click();
  await editDialog.getByRole("button", { name: /保\s*存/ }).click();
  await expect(memberDrawer.getByText("李雷新")).toBeVisible();
  expect(profilePayload).toEqual({
    real_name: "李雷新",
    phone_number: "13700137000",
  });

  await memberDrawer.getByLabel("设置张新为队长").click();
  await page.getByRole("button", { name: /确\s*认/ }).click();
  await expect(
    memberDrawer.getByText("当前队长").locator("..").getByText("张新"),
  ).toBeVisible();

  await memberDrawer.getByLabel("移除王强").click();
  await page.getByRole("button", { name: /^移\s*除$/ }).click();
  await expect(memberDrawer.getByRole("row", { name: /王强/ })).toBeHidden();

  await page.screenshot({
    path: testInfo.outputPath("team-members.png"),
    fullPage: true,
  });
});

test("发布比赛时可以确认创建不存在的主队", async ({ page }, testInfo) => {
  test.skip(!username || !password, "需要 ADMIN_USERNAME 和 ADMIN_PASSWORD");

  await login(page);
  const timestamp = "2026-07-15T08:30:00Z";
  let createdPayload: { name: string; description: string | null } | undefined;
  await page.route("**/api/v1/admin/teams**", async (route) => {
    const request = route.request();
    let data: unknown;
    if (request.method() === "GET") {
      data = [
        {
          id: 1,
          name: "已有联队",
          description: null,
          logo_url: null,
          captain_id: null,
          status: "active",
          created_at: timestamp,
          updated_at: timestamp,
        },
      ];
    } else if (request.method() === "POST") {
      createdPayload = request.postDataJSON() as typeof createdPayload;
      data = {
        id: 9,
        ...createdPayload,
        logo_url: null,
        captain_id: null,
        status: "active",
        created_at: timestamp,
        updated_at: timestamp,
      };
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data }),
    });
  });

  await page.goto("/matches/new");
  await expect(
    page.locator("[data-slot='card-title']").filter({ hasText: "发布比赛" }),
  ).toBeVisible();
  const teamSelect = page.getByRole("button", { name: "选择主队" });
  await teamSelect.click();
  await page.getByLabel("搜索球队").fill("临时联队");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存比赛" }).click();

  const confirmDialog = page.getByRole("dialog", { name: "球队不存在" });
  await expect(
    confirmDialog.getByText("是否创建“临时联队”并设为本场比赛的主队？"),
  ).toBeVisible();
  await confirmDialog
    .getByRole("button", { name: /创\s*建\s*并\s*选\s*择/ })
    .click();

  await expect(confirmDialog).toBeHidden();
  await expect(
    page.locator(".team-select-label").filter({ hasText: "临时联队" }),
  ).toBeVisible();
  expect(createdPayload).toEqual({ name: "临时联队", description: null });
  await page.screenshot({
    path: testInfo.outputPath("match-create-missing-team.png"),
    fullPage: true,
  });
});
