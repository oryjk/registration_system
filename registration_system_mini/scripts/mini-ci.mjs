#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import JSON5 from "json5";
import { allocateReviewVersion, syncManifestVersion } from "./sync-manifest-version.mjs";

const command = process.argv[2];
const extraArgs = process.argv.slice(3);
const cliPath = "/Users/carlwang/.local/share/mini-program-ci-cli/index.mjs";
const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);

if (!command) {
  console.error("用法: bun run mp:preview [-- --robot 2 --desc 文案]");
  console.error("   或: bun run mp:upload [-- --robot 2 --version 1.0.1 --desc 文案]");
  process.exit(1);
}

// 上传版本号：显式 --version 优先；否则复用审核登记接口当前审核中的版本
// （build 阶段 prebuild 已分配并登记），离线跳过时退回 manifest 当前值。
async function resolveUploadVersion() {
  const versionArgIndex = extraArgs.indexOf("--version");
  if (versionArgIndex >= 0 && extraArgs[versionArgIndex + 1]) {
    return extraArgs[versionArgIndex + 1];
  }
  const manifest = JSON5.parse(readFileSync(path.join(projectRoot, "src", "manifest.json"), "utf8"));
  return (await allocateReviewVersion({ currentVersion: String(manifest.versionName || "") })) || manifest.versionName;
}

async function main() {
  const uploadVersion = command === "upload" ? await resolveUploadVersion() : null;
  const versionArgIndex = extraArgs.indexOf("--version");
  const forwardedArgs =
    command === "upload" && uploadVersion && versionArgIndex < 0 ? [...extraArgs, "--version", uploadVersion] : extraArgs;

  await syncManifestVersion(uploadVersion ? { versionName: uploadVersion } : {});

  const childEnv =
    command === "upload" && uploadVersion
      ? { ...process.env, MINI_PROGRAM_VERSION: uploadVersion }
      : process.env;

  const child = spawn("node", [cliPath, command, projectRoot, ...forwardedArgs], {
    env: childEnv,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  const exitCode = await new Promise((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
