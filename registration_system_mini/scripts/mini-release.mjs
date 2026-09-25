#!/usr/bin/env bun
// 微信小程序唯一构建/发布入口：清理继承变量 → 生产构建 → 校验实际产物 → 上传。
import { existsSync, readFileSync } from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const defaultProjectRoot = fileURLToPath(new URL("..", import.meta.url));

function requireBun() {
  if (!process.versions.bun) throw new Error("小程序构建和上传必须使用 Bun，请运行 bun run mp:release。");
}

export function normalizeReleaseApiBase(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(".env.production 必须显式配置 VITE_API_BASE_URL，禁止回退到本地地址。");
  }
  const base = value.trim().replace(/\/+$/, "");
  let url;
  try {
    url = new URL(base);
  } catch {
    throw new Error("生产 VITE_API_BASE_URL 不是有效的 URL。");
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
    || !host.includes(".") || isIP(host.replace(/^\[|\]$/g, ""))
    || /(?:^|\.)(?:localhost|local|internal)$/.test(host)
    || !/^https:\/\/[^/?#]+(?:\/[^/?#]+)*\/api\/v1\/app$/i.test(base)) {
    throw new Error("生产 VITE_API_BASE_URL 必须是公开域名的 HTTPS /api/v1/app 地址，不能包含本地 IP、认证信息或查询参数。");
  }
  return base;
}

export function loadProductionEnvironment(projectRoot = defaultProjectRoot, inherited = process.env) {
  requireBun();
  const envFile = path.join(projectRoot, ".env.production");
  if (!existsSync(envFile)) throw new Error("缺少 .env.production，已阻止构建/上传。");

  // 外层 `bun run` 也可能提前注入 .env.development；--no-env-file 不会清除已继承的值。
  // 发布只信任显式的生产文件。保留 PATH、代理和 MINI_CI_* / MINI_REVIEW_* 等非客户端配置。
  const clean = Object.fromEntries(Object.entries(inherited)
    .filter(([key, value]) => value !== undefined && !key.startsWith("VITE_") && !key.startsWith("UNI_")));
  clean.NODE_ENV = "production";
  const result = Bun.spawnSync([
    process.execPath, "--no-env-file", `--env-file=${envFile}`, "--eval",
    'console.log(JSON.stringify(Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")))))',
  ], { cwd: projectRoot, env: clean, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error("使用 Bun 读取 .env.production 失败，已阻止构建/上传。");
  let production;
  try {
    production = JSON.parse(result.stdout.toString());
  } catch {
    throw new Error("无法解析生产构建环境，已阻止构建/上传。");
  }
  const apiBase = normalizeReleaseApiBase(production.VITE_API_BASE_URL);
  if (/^(true|1)$/i.test(String(production.VITE_USE_MOCK || "").trim())) {
    throw new Error("生产发布不能启用 Mock，请检查 .env.production。");
  }
  // 将生产变量显式传给 Vite，防止 .env.local 等本地覆盖层改写发布目标。
  return { ...clean, ...production, VITE_API_BASE_URL: apiBase, VITE_USE_MOCK: "false" };
}

export function verifyReleaseBundle(projectRoot, expectedApiBase) {
  const expected = normalizeReleaseApiBase(expectedApiBase);
  const dist = path.join(projectRoot, "dist", "build", "mp-weixin");
  if (!existsSync(path.join(dist, "app.json"))) {
    throw new Error("缺少小程序产物 app.json，请先运行 bun run build:mp-weixin。");
  }
  const apiFile = path.join(dist, "config", "apiBase.js");
  if (!existsSync(apiFile)) throw new Error("缺少编译后的 config/apiBase.js，已阻止上传。");

  // 检查真实返回值，而不是搜索 URL 字符串：未使用的 localhost fallback 可以仍在文件中。
  // 此模块目前无运行时依赖；独立上下文不提供 require/process，格式变化时默认拒绝上传。
  let actual;
  try {
    actual = runInNewContext(`${readFileSync(apiFile, "utf8")}\n;
      if (typeof exports.getApiBaseUrl !== "function") throw new Error("缺少 getApiBaseUrl");
      exports.getApiBaseUrl();`, { exports: {} }, { timeout: 1000, filename: apiFile });
  } catch {
    throw new Error("无法读取编译包的 getApiBaseUrl()，已阻止上传；请检查 config/apiBase.js。");
  }
  actual = normalizeReleaseApiBase(actual);
  if (actual !== expected) {
    throw new Error(`编译包 API 与 .env.production 不一致，已阻止上传。请重新运行 bun run mp:release。`);
  }
  return actual;
}

function validateArguments(command, args) {
  if (!["build", "upload", "preview", "verify"].includes(command)) {
    throw new Error("用法: bun scripts/mini-release.mjs build|upload|preview|verify [--robot N] [--desc 文案]");
  }
  const forwarded = args[0] === "--" ? args.slice(1) : [...args];
  if ((command === "build" || command === "verify") && forwarded.length) {
    throw new Error(`${command} 不接受额外参数，生产 mode 与 API 由统一入口管理。`);
  }
  const seen = new Set();
  for (let i = 0; i < forwarded.length; i += 2) {
    const name = forwarded[i];
    const value = forwarded[i + 1];
    if (!["--robot", "--desc"].includes(name) || seen.has(name) || !value || value.startsWith("--")) {
      throw new Error("上传参数无效，只支持 --robot N 和 --desc 文案，且不能重复。");
    }
    if (name === "--robot" && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)) {
      throw new Error("--robot 必须为正整数；日常开发版用 1，体验版专用线用 2。");
    }
    seen.add(name);
  }
  return forwarded;
}

async function executeStep(cmd, options) {
  const child = Bun.spawn(cmd, { ...options, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  return await child.exited;
}

export async function runMiniRelease(command, args = [], {
  projectRoot = defaultProjectRoot,
  env = process.env,
  runStep = executeStep,
} = {}) {
  const forwarded = validateArguments(command, args);
  const production = loadProductionEnvironment(projectRoot, env);
  // 上传必须走登记库，不能被上一次离线验证留下的 MINI_REVIEW_SKIP=1 意外跳过。
  if (command === "upload") production.MINI_REVIEW_SKIP = "0";
  console.log(`[mini-release] Bun ${Bun.version}; mode=production; API=${production.VITE_API_BASE_URL}`);

  const run = async (label, script, scriptArgs = []) => {
    console.log(`[mini-release] ${label}`);
    const exitCode = await runStep([process.execPath, "--no-env-file", "--bun", path.join(projectRoot, script), ...scriptArgs], {
      cwd: projectRoot, env: production,
    });
    if (exitCode !== 0) throw new Error(`${label}失败（退出码 ${exitCode}），后续步骤未执行。`);
  };

  if (command === "build" || command === "upload") {
    await run("同步审核版本", "scripts/sync-manifest-version.mjs");
    await run("构建生产小程序", "node_modules/@dcloudio/vite-plugin-uni/bin/uni.js", ["build", "-p", "mp-weixin", "--mode", "production"]);
    await run("检查小程序组件注册", "scripts/verify-mp-component-registrations.mjs");
  }
  const actualApi = verifyReleaseBundle(projectRoot, production.VITE_API_BASE_URL);
  console.log(`[mini-release] 编译包 API 校验通过: ${actualApi}`);
  if (command === "upload" || command === "preview") {
    await run(command === "upload" ? "上传微信开发版本" : "生成微信预览", "scripts/mini-ci.mjs", [command, ...forwarded]);
  }
}

if (import.meta.main) {
  runMiniRelease(process.argv[2], process.argv.slice(3)).catch((error) => {
    console.error(`[mini-release] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
