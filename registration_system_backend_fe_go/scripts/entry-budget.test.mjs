import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import {
  measureEntrypointGzip,
  readEntrypointAssets,
} from "./entry-budget.mjs";

async function withFixture(run) {
  const root = await mkdtemp(join(tmpdir(), "entry-budget-"));
  try {
    const distPath = join(root, "dist");
    const assetsPath = join(distPath, "assets");
    const viteDir = join(distPath, ".vite");
    await mkdir(assetsPath, { recursive: true });
    await mkdir(viteDir, { recursive: true });
    return await run({
      distPath,
      manifestPath: join(distPath, ".vite/manifest.json"),
      assetsPath,
    });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

test("collects the entry chunk, its css and its static imports from the vite manifest", async () => {
  await withFixture(async ({ distPath, manifestPath, assetsPath }) => {
    const entryJs = "const answer = 42;";
    const entryCss = ".root{display:block}";
    const vendorJs = "export const vendor = true;";
    const lazyJs = "export const lazy = true;";
    await writeFile(join(assetsPath, "index-B.js"), entryJs);
    await writeFile(join(assetsPath, "index-C.css"), entryCss);
    await writeFile(join(assetsPath, "vendor-D.js"), vendorJs);
    await writeFile(join(assetsPath, "match-page-E.js"), lazyJs);
    await writeFile(
      manifestPath,
      JSON.stringify({
        "main.tsx": {
          file: "assets/index-B.js",
          src: "main.tsx",
          isEntry: true,
          css: ["assets/index-C.css"],
          imports: ["_vendor-D.js"],
        },
        "_vendor-D.js": { file: "assets/vendor-D.js" },
        "match-page.tsx": {
          file: "assets/match-page-E.js",
          src: "match-page.tsx",
          isDynamicEntry: true,
        },
      }),
    );

    const assets = await readEntrypointAssets({ manifestPath });
    const result = await measureEntrypointGzip({ distPath, assets });

    assert.deepEqual(assets.sort(), [
      "assets/index-B.js",
      "assets/index-C.css",
      "assets/vendor-D.js",
    ]);
    assert.deepEqual(result, {
      assetBytes:
        Buffer.byteLength(entryJs) +
        Buffer.byteLength(entryCss) +
        Buffer.byteLength(vendorJs),
      gzipBytes:
        gzipSync(entryJs, { level: 9 }).length +
        gzipSync(entryCss, { level: 9 }).length +
        gzipSync(vendorJs, { level: 9 }).length,
    });
  });
});

test("rejects a manifest without an entry", async () => {
  await withFixture(async ({ manifestPath }) => {
    await writeFile(manifestPath, JSON.stringify({}));

    await assert.rejects(
      readEntrypointAssets({ manifestPath }),
      /No entrypoint found/,
    );
  });
});

test("CLI exits nonzero when the entry exceeds its gzip budget", async () => {
  await withFixture(async ({ distPath, manifestPath, assetsPath }) => {
    await writeFile(join(assetsPath, "index-B.js"), "console.log('entry');");
    await writeFile(
      manifestPath,
      JSON.stringify({
        "main.tsx": {
          file: "assets/index-B.js",
          src: "main.tsx",
          isEntry: true,
        },
      }),
    );

    const result = spawnSync(
      process.execPath,
      [
        new URL("./entry-budget.mjs", import.meta.url).pathname,
        "--dist",
        distPath,
        "--max-gzip",
        "1",
      ],
      { encoding: "utf8" },
    );

    assert.equal(result.status, 1);
    const output = JSON.parse(result.stdout);
    assert.equal(output.withinBudget, false);
    assert.ok(output.gzipBytes > output.maxGzipBytes);
  });
});
