import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:8000";
const matchId = "9f40a69b-f7d1-4014-ad71-7a39a2fde5bb";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.fill('input[placeholder*="账号"], input#username, input[name="username"]', "admin");
await page.fill('input[type="password"]', "admin123");
await page.click('button[type="submit"], button:has-text("登")');
await page.waitForURL(`${base}/`, { timeout: 20000 });

await page.goto(`${base}/matches/${matchId}/edit`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const fillPicker = async (id, value) => {
  const input = page.locator(`#${id}`);
  await input.click();
  await page.waitForTimeout(300);
  await input.fill(value);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
};

await fillPicker("registration_start_at", "2026-08-16 17:10");
await fillPicker("registration_end_at", "2026-08-20 18:00");
console.log("form registration_start_at:", await page.locator("#registration_start_at").inputValue());
console.log("form registration_end_at:", await page.locator("#registration_end_at").inputValue());

await Promise.all([
  page.waitForURL(`${base}/matches/${matchId}`, { timeout: 15000 }),
  page.click('button:has-text("保存比赛")'),
]);
await page.waitForTimeout(1200);

const arr = (await page.locator(".ant-pro-layout-content").innerText()).split("\n");
console.log("detail 报名开始时间:", arr[arr.findIndex((l) => l.includes("报名开始时间")) + 1]);
console.log("detail 报名截止时间:", arr[arr.findIndex((l) => l.includes("报名截止时间")) + 1]);
await browser.close();
