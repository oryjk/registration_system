import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export async function readEntrypointAssets({ manifestPath }) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const entryKey = Object.keys(manifest).find((key) => manifest[key]?.isEntry);
  const entry = entryKey ? manifest[entryKey] : undefined;
  if (!entry?.file) {
    throw new Error(`No entrypoint found in ${manifestPath}`);
  }

  const assets = [];
  const visited = new Set();
  const collect = (chunk) => {
    if (!chunk || visited.has(chunk.file)) return;
    visited.add(chunk.file);
    assets.push(chunk.file);
    for (const cssAsset of chunk.css ?? []) assets.push(cssAsset);
    for (const importKey of chunk.imports ?? []) collect(manifest[importKey]);
  };
  collect(entry);

  return assets;
}

export async function measureEntrypointGzip({ distPath, assets }) {
  let assetBytes = 0;
  let gzipBytes = 0;

  for (const asset of assets) {
    const content = await readFile(join(distPath, asset));
    assetBytes += content.length;
    gzipBytes += gzipSync(content, { level: 9 }).length;
  }

  return { assetBytes, gzipBytes };
}

function optionValue(args, option, fallback) {
  const index = args.indexOf(option);
  return index === -1 ? fallback : args[index + 1];
}

async function main(args) {
  const distPath = resolve(optionValue(args, "--dist", "dist"));
  const manifestPath = resolve(
    optionValue(args, "--manifest", join(distPath, ".vite/manifest.json")),
  );
  const maxGzipBytes = Number(optionValue(args, "--max-gzip", "220000"));

  if (!Number.isSafeInteger(maxGzipBytes) || maxGzipBytes < 0) {
    throw new Error("--max-gzip must be a non-negative integer");
  }

  const assets = await readEntrypointAssets({ manifestPath });
  const measurement = await measureEntrypointGzip({ distPath, assets });
  const result = {
    assets,
    ...measurement,
    maxGzipBytes,
    withinBudget: measurement.gzipBytes <= maxGzipBytes,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.withinBudget) process.exitCode = 1;
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  });
}
