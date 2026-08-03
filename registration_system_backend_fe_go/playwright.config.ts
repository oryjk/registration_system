import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT || 5175);
const distBase = process.env.PLAYWRIGHT_DIST_BASE;
const origin = `http://127.0.0.1:${port}`;
const serverURL = `${origin}${distBase || "/"}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || origin,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: distBase
      ? `node scripts/serve-dist.mjs --port ${port} --base ${distBase}`
      : "bun run dev",
    url: serverURL,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
