import { expect, test } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB5kAAAAASUVORK5CYII=",
  "base64",
);

test("引导图片独立上传、清空和失败重试", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("registration-admin-go.token.v1", "test-token");
  });
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
  const settings = {
    debug: {
      clear_profile_enabled: false,
      review_status_toggle_enabled: false,
    },
    onboarding: { enabled: false },
    home: {
      next_match_social_image_url: "/test-images/social.png",
      onboarding_welcome_image_url: "/test-images/welcome.png",
      onboarding_team_image_url: "/test-images/team.png",
      onboarding_match_image_url: "/test-images/match.png",
    },
  };
  let rejectUpload = true;
  await page.route(
    "**/api/v1/admin/system/mini-app-settings**",
    async (route) => {
      const request = route.request();
      if (request.method() === "PUT") {
        expect(request.postDataJSON()).toEqual({
          home: { onboarding_team_image_url: "" },
        });
        settings.home.onboarding_team_image_url = "";
      }
      if (request.method() === "POST") {
        expect(request.url()).toContain("/onboarding-images/welcome");
        expect(request.headers()["content-type"]).toContain(
          "multipart/form-data",
        );
        if (rejectUpload) {
          rejectUpload = false;
          await route.fulfill({
            status: 500,
            json: { code: 500, message: "upload failed" },
          });
          return;
        }
        settings.home.onboarding_welcome_image_url =
          "/test-images/new-welcome.png";
      }
      await route.fulfill({ json: { code: 0, data: settings } });
    },
  );
  await page.goto("/system-settings");
  const welcome = page.getByRole("region", {
    name: "首次进入引导图",
    exact: true,
  });
  const team = page.getByRole("region", {
    name: "组队 / 入队引导图",
    exact: true,
  });
  const match = page.getByRole("region", { name: "找比赛引导图", exact: true });
  await expect(welcome.getByRole("img")).toHaveAttribute(
    "src",
    "/test-images/welcome.png",
  );
  await welcome
    .locator('input[type="file"]')
    .setInputFiles({ name: "guide.png", mimeType: "image/png", buffer: png });
  await welcome.getByRole("button", { name: "上传 / 更换图片" }).click();
  await expect(welcome.getByRole("alert")).toContainText("图片上传失败");
  await welcome.getByRole("button", { name: "上传 / 更换图片" }).click();
  await expect(welcome.getByRole("img")).toHaveAttribute(
    "src",
    "/test-images/new-welcome.png",
  );
  await team.getByRole("button", { name: "清空图片" }).click();
  await expect(team.getByText("暂未上传图片")).toBeVisible();
  await expect(welcome.getByRole("img")).toHaveAttribute(
    "src",
    "/test-images/new-welcome.png",
  );
  await expect(match.getByRole("img")).toHaveAttribute(
    "src",
    "/test-images/match.png",
  );
  await expect(
    page.getByRole("img", { name: "首页空状态插画预览" }),
  ).toHaveAttribute("src", "/test-images/social.png");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("onboarding-settings.png"),
    fullPage: true,
  });
});
