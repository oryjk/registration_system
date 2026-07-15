import { expect, test } from "@playwright/test";

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

test("管理员可以登录并查看比赛详情", async ({ page }, testInfo) => {
  test.skip(!username || !password, "需要 ADMIN_USERNAME 和 ADMIN_PASSWORD");

  await page.goto("/login");
  await page.getByPlaceholder("管理员账号").fill(username!);
  await page.getByPlaceholder("密码").fill(password!);
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/$/);
  if ((page.viewportSize()?.width ?? 0) < 992) {
    await page.getByLabel("打开导航").click();
  }
  await page.getByRole("link", { name: "比赛管理" }).click();
  await expect(page.getByRole("heading", { name: "比赛管理" })).toBeVisible();
  await expect(page.getByText("周末管理端联调赛")).toBeVisible();

  await page.getByLabel("查看周末管理端联调赛").click();
  await expect(page.getByRole("heading", { name: "周末管理端联调赛" })).toBeVisible();
  await expect(page.getByText("滨江足球场 2 号场")).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("match-detail.png"), fullPage: true });

  await page.reload();
  await expect(page.getByRole("heading", { name: "周末管理端联调赛" })).toBeVisible();
});
