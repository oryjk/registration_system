import fs from "fs";
import path from "path";
import { chromium } from "/Users/carlwang/football_insight/football_insight_h5/node_modules/playwright/index.mjs";

const sourceDir = "/Users/carlwang/registration_system/registration_system_mini/src/static/tab";
const outputDir = "/Users/carlwang/registration_system/registration_system_mini/src/static/tab-png";
const size = 81;

async function main() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });

  const files = fs.readdirSync(sourceDir).filter((file) => file.endsWith(".svg"));

  for (const file of files) {
    const svg = fs.readFileSync(path.join(sourceDir, file), "utf8");
    await page.setContent(
      `<!doctype html>
      <html>
        <head>
          <style>
            html, body {
              margin: 0;
              width: ${size}px;
              height: ${size}px;
              overflow: hidden;
              background: transparent;
            }

            body {
              display: flex;
              align-items: center;
              justify-content: center;
            }

            svg {
              display: block;
              width: ${size}px;
              height: ${size}px;
            }
          </style>
        </head>
        <body>${svg}</body>
      </html>`,
      { waitUntil: "load" },
    );

    await page.screenshot({
      path: path.join(outputDir, file.replace(/\.svg$/, ".png")),
      omitBackground: true,
    });
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
