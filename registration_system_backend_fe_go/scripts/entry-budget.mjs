import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export async function readEntrypointAssets({ statsPath, entryName }) {
  const stats = JSON.parse(await readFile(statsPath, "utf8"));
  const entry = stats.entrypoints?.[entryName];
  if (!entry?.assets?.length) {
    throw new Error(
      `Entrypoint ${entryName} has no generated assets in ${statsPath}`,
    );
  }

  return entry.assets.map((asset) =>
    typeof asset === "string" ? asset : asset.name,
  );
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
  const statsPath = resolve(
    optionValue(args, "--stats", join(distPath, "stats.json")),
  );
  const entryName = optionValue(args, "--entry", "umi");
  const maxGzipBytes = Number(optionValue(args, "--max-gzip", "220000"));

  if (!Number.isSafeInteger(maxGzipBytes) || maxGzipBytes < 0) {
    throw new Error("--max-gzip must be a non-negative integer");
  }

  const assets = await readEntrypointAssets({ statsPath, entryName });
  const measurement = await measureEntrypointGzip({ distPath, assets });
  const result = {
    entryName,
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
