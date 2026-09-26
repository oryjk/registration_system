import { expect, test } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB5kAAAAASUVORK5CYII=",
  "base64",
);
const scenes = [
  ["home", "首页分享"],
  ["hall", "约队大厅"],
  ["team", "球队邀请"],
  ["match", "比赛详情"],
] as const;

test("分享封面尺寸提醒、独立保存与上传清空失败重试", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem("registration-admin-go.token.v1", "test-token"),
  );
  await page.route("**/api/v1/admin/auth/me", (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          id: 1,
          username: "test",
          role: "super_admin",
          is_super_admin: true,
          status: "active",
        },
      },
    }),
  );
  await page.route("**/test-images/*.png", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  // 初始响应不含分享字段，验证旧服务配置仍可显示。
  const home: Record<string, string> = {
    next_match_social_image_url: "/test-images/social.png",
    onboarding_team_image_url: "/test-images/team.png",
  };
  const settings = {
    debug: {
      clear_profile_enabled: false,
      review_status_toggle_enabled: false,
    },
    onboarding: { enabled: false },
    home,
  };
  let rejectUpload = true;
  let rejectClear = true;
  await page.route(
    "**/api/v1/admin/system/mini-app-settings**",
    async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        const scene = request.url().split("/").at(-1);
        expect(scenes.map(([value]) => value)).toContain(scene);
        expect(request.headers()["content-type"]).toContain(
          "multipart/form-data",
        );
        if (rejectUpload) {
          rejectUpload = false;
          await route.fulfill({
            status: 500,
            json: { code: 500, message: "failed" },
          });
          return;
        }
        home[`share_${scene}_image_url`] = `/test-images/share-${scene}.png`;
      }
      if (request.method() === "PUT") {
        const patch = request.postDataJSON();
        expect(Object.keys(patch)).toEqual(["home"]);
        expect(Object.keys(patch.home)).toHaveLength(1);
        expect(Object.values(patch.home)).toEqual([""]);
        if (rejectClear) {
          rejectClear = false;
          await route.fulfill({
            status: 500,
            json: { code: 500, message: "failed" },
          });
          return;
        }
        Object.assign(home, patch.home);
      }
      await route.fulfill({ json: { code: 0, data: settings } });
    },
  );
  await page.goto("/system-settings");
  await expect(page.getByText("建议比例 5:4", { exact: false })).toBeVisible();
  for (const [scene, title] of scenes) {
    const section = page.getByRole("region", { name: title, exact: true });
    await expect(section.getByText("未配置", { exact: true })).toBeVisible();
    await section
      .locator('input[type="file"]')
      .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
    await expect(
      section.getByText("当前图片：", { exact: false }),
    ).toContainText("1×1px");
    await expect(
      section.getByText("当前图片：", { exact: false }),
    ).toContainText("仍可上传");
    if (scene === "home") {
      const cover = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 1000;
        canvas.height = 800;
        return canvas.toDataURL("image/png").split(",")[1];
      });
      await section
        .locator('input[type="file"]')
        .setInputFiles({
          name: "wide.png",
          mimeType: "image/png",
          buffer: Buffer.from(cover, "base64"),
        });
      await expect(
        section.getByText("当前图片：", { exact: false }),
      ).toContainText("1000×800px");
      await expect(
        section.getByText("当前图片：", { exact: false }),
      ).not.toContainText("偏差");
    }
    await section
      .getByRole("button", { name: "上传图片", exact: true })
      .click();
    if (scene === "home") {
      await expect(section.getByRole("alert")).toContainText("图片上传失败");
      await section
        .getByRole("button", { name: "上传图片", exact: true })
        .click();
    }
    await expect(section.getByRole("img")).toHaveAttribute(
      "src",
      `/test-images/share-${scene}.png`,
    );
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("share-settings.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (const [scene, title] of scenes) {
    const section = page.getByRole("region", { name: title, exact: true });
    await section.getByRole("button", { name: "清空图片" }).click();
    if (scene === "home") {
      await expect(section.getByRole("alert")).toContainText("图片清空失败");
      await section.getByRole("button", { name: "清空图片" }).click();
    }
    await expect(section.getByText("暂未上传图片")).toBeVisible();
  }
  await expect(
    page.getByRole("img", { name: "组队 / 入队引导图预览" }),
  ).toHaveAttribute("src", "/test-images/team.png");
});
