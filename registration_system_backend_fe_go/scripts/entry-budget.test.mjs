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
    await mkdir(distPath);
    return await run({ distPath, statsPath: join(distPath, "stats.json") });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

test("reads named utoopack entry assets and measures each gzip stream", async () => {
  await withFixture(async ({ distPath, statsPath }) => {
    const javascript = "const answer = 42;";
    const stylesheet = ".root{display:block}";
    await writeFile(join(distPath, "umi.js"), javascript);
    await writeFile(join(distPath, "umi.css"), stylesheet);
    await writeFile(
      statsPath,
      JSON.stringify({
        entrypoints: {
          umi: { assets: [{ name: "umi.js" }, "umi.css"] },
        },
      }),
    );

    const assets = await readEntrypointAssets({ statsPath, entryName: "umi" });
    const result = await measureEntrypointGzip({ distPath, assets });

    assert.deepEqual(assets, ["umi.js", "umi.css"]);
    assert.deepEqual(result, {
      assetBytes: Buffer.byteLength(javascript) + Buffer.byteLength(stylesheet),
      gzipBytes:
        gzipSync(javascript, { level: 9 }).length +
        gzipSync(stylesheet, { level: 9 }).length,
    });
  });
});

test("rejects a missing named entrypoint", async () => {
  await withFixture(async ({ statsPath }) => {
    await writeFile(statsPath, JSON.stringify({ entrypoints: {} }));

    await assert.rejects(
      readEntrypointAssets({ statsPath, entryName: "umi" }),
      /Entrypoint umi has no generated assets/,
    );
  });
});

test("CLI exits nonzero when the entry exceeds its gzip budget", async () => {
  await withFixture(async ({ distPath, statsPath }) => {
    await writeFile(join(distPath, "umi.js"), "console.log('entry');");
    await writeFile(
      statsPath,
      JSON.stringify({ entrypoints: { umi: { assets: ["umi.js"] } } }),
    );

    const result = spawnSync(
      process.execPath,
      [
        new URL("./entry-budget.mjs", import.meta.url).pathname,
        "--dist",
        distPath,
        "--stats",
        statsPath,
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
