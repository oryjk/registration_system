# 微信小程序 CI 发布工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `registration_system_mini` 和 `football_insight_mini` 提供一套基于微信官方 `miniprogram-ci` 的本地共享 CLI，并在各项目内暴露 `bun run mp:preview` / `bun run mp:upload`，让日常预览和上传无需手动打开开发者工具点击上传。

**Architecture:** 在机器本地创建一个共享的 Node CLI 工作目录，内部封装 `miniprogram-ci`、项目配置发现、`.env.ci.local` 读取、`uni-app` 构建、版本号解析、preview/upload 调用。两个小程序项目仅通过 package scripts 和极薄的 wrapper 调用这个共享 CLI；`registration_system_mini` 同步把真实 appid 写回 `src/manifest.json`。

**Tech Stack:** Node.js 24、Bun、uni-app、miniprogram-ci、原生 ESM、dotenv

---

### Task 1: 搭建共享 CLI 工作目录

**Files:**
- Create: `/Users/carlwang/.local/share/mini-program-ci-cli/package.json`
- Create: `/Users/carlwang/.local/share/mini-program-ci-cli/index.mjs`
- Create: `/Users/carlwang/.local/share/mini-program-ci-cli/README.md`

- [ ] **Step 1: 创建共享 CLI package.json**

```json
{
  "name": "mini-program-ci-cli",
  "private": true,
  "type": "module",
  "version": "0.1.0",
  "bin": {
    "mini-program-ci-cli": "./index.mjs"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "miniprogram-ci": "^2.1.31"
  }
}
```

- [ ] **Step 2: 安装依赖**

Run: `cd /Users/carlwang/.local/share/mini-program-ci-cli && npm install`
Expected: 生成 `node_modules` 和 lockfile，无安装错误

- [ ] **Step 3: 编写 CLI 主入口骨架**

```js
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import ci from "miniprogram-ci";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function logStep(message) {
  console.log(`[mini-ci] ${message}`);
}

async function main() {
  logStep("CLI bootstrap placeholder");
}

main().catch((error) => {
  console.error(`[mini-ci] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exit(1);
});
```

- [ ] **Step 4: 写共享 CLI README**

```md
# mini-program-ci-cli

本地共享的微信小程序 CI 工具。

- 读取项目内 `.env.ci.local`
- 调用 `bun run build:mp-weixin`
- 使用微信官方 `miniprogram-ci` 执行 `preview` / `upload`
```

- [ ] **Step 5: 验证 CLI 能启动**

Run: `node /Users/carlwang/.local/share/mini-program-ci-cli/index.mjs`
Expected: 输出 `[mini-ci] CLI bootstrap placeholder`

### Task 2: 实现项目配置发现与命令解析

**Files:**
- Modify: `/Users/carlwang/.local/share/mini-program-ci-cli/index.mjs`

- [ ] **Step 1: 实现参数解析和用法提示**

```js
function parseArgs(argv) {
  const [command, projectRootArg, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const part = rest[index];
    if (part === "--robot") options.robot = Number(rest[++index]);
    else if (part === "--desc") options.desc = rest[++index];
    else if (part === "--version") options.version = rest[++index];
    else if (part === "--page") options.pagePath = rest[++index];
    else if (part === "--query") options.searchQuery = rest[++index];
    else if (part === "--qrcode-output") options.qrcodeOutput = rest[++index];
    else throw new Error(`未知参数: ${part}`);
  }

  if (!command || !projectRootArg) {
    throw new Error("用法: mini-program-ci-cli <preview|upload> <projectRoot> [--robot N] [--desc TEXT] [--version X.Y.Z]");
  }

  return {
    command,
    projectRoot: path.resolve(projectRootArg),
    options,
  };
}
```

- [ ] **Step 2: 实现 `.env.ci.local` / manifest / .env 的配置读取**

```js
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveProjectConfig(projectRoot) {
  const ciEnv = loadEnvFile(path.join(projectRoot, ".env.ci.local"));
  const productionEnv = loadEnvFile(path.join(projectRoot, ".env.production"));
  const manifest = readJsonFile(path.join(projectRoot, "src", "manifest.json"));

  const appid = ciEnv.MINI_PROGRAM_APPID || manifest["mp-weixin"]?.appid || manifest.appid;
  const version = ciEnv.MINI_PROGRAM_VERSION || productionEnv.VITE_MINI_PROGRAM_VERSION || manifest.versionName;
  const robot = Number(ciEnv.MINI_PROGRAM_CI_ROBOT || 1);
  const privateKeyPath = ciEnv.MINI_PROGRAM_PRIVATE_KEY_PATH;
  const buildScript = ciEnv.MINI_PROGRAM_BUILD_SCRIPT || "build:mp-weixin";
  const projectName = manifest.name || path.basename(projectRoot);

  if (!appid || appid.startsWith("__UNI__") || appid === "touristappid") {
    throw new Error(`项目 ${projectRoot} 缺少真实 appid，请检查 manifest 或 .env.ci.local`);
  }
  if (!privateKeyPath) {
    throw new Error(`项目 ${projectRoot} 缺少 MINI_PROGRAM_PRIVATE_KEY_PATH，请配置 .env.ci.local`);
  }

  return {
    appid,
    version,
    robot,
    privateKeyPath: path.resolve(projectRoot, privateKeyPath),
    buildScript,
    projectName,
    distProjectPath: path.join(projectRoot, "dist", "build", "mp-weixin"),
  };
}
```

- [ ] **Step 3: 读取构建产物 project.config.json 并映射 setting**

```js
function resolveCiSettings(distProjectPath) {
  const projectConfigPath = path.join(distProjectPath, "project.config.json");
  if (!fs.existsSync(projectConfigPath)) {
    return { es6: true };
  }
  const projectConfig = readJsonFile(projectConfigPath);
  return projectConfig.setting || { es6: true };
}
```

- [ ] **Step 4: 在 main 中串起配置解析**

```js
async function main() {
  const { command, projectRoot, options } = parseArgs(process.argv.slice(2));
  const config = resolveProjectConfig(projectRoot);
  logStep(`command=${command}`);
  logStep(`project=${config.projectName}`);
  logStep(`appid=${config.appid}`);
}
```

- [ ] **Step 5: 验证读取 registration_system_mini 配置**

Run: `node /Users/carlwang/.local/share/mini-program-ci-cli/index.mjs preview /Users/carlwang/registration_system/registration_system_mini`
Expected: 若 `.env.ci.local` 尚未配置，则报缺少 `MINI_PROGRAM_PRIVATE_KEY_PATH`，说明参数和项目发现链路生效

### Task 3: 实现构建与微信 CI preview/upload

**Files:**
- Modify: `/Users/carlwang/.local/share/mini-program-ci-cli/index.mjs`

- [ ] **Step 1: 增加构建执行器**

```js
import { spawn } from "node:child_process";

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} 退出码 ${code}`));
    });
    child.on("error", reject);
  });
}

async function buildMiniProgram(projectRoot, buildScript) {
  logStep(`开始构建: bun run ${buildScript}`);
  await runCommand("bun", ["run", buildScript], projectRoot);
}
```

- [ ] **Step 2: 创建 `ci.Project` 工厂**

```js
function createCiProject(config) {
  return new ci.Project({
    appid: config.appid,
    type: "miniProgram",
    projectPath: config.distProjectPath,
    privateKeyPath: config.privateKeyPath,
    ignores: ["node_modules/**/*"],
  });
}
```

- [ ] **Step 3: 实现 preview**

```js
async function runPreview(config, options) {
  const project = createCiProject(config);
  const qrcodeOutputDest = options.qrcodeOutput || path.join(config.distProjectPath, "preview-qrcode.jpg");
  const result = await ci.preview({
    project,
    desc: options.desc || `preview ${config.projectName}`,
    setting: resolveCiSettings(config.distProjectPath),
    robot: options.robot || config.robot,
    qrcodeFormat: "image",
    qrcodeOutputDest,
    pagePath: options.pagePath,
    searchQuery: options.searchQuery,
    onProgressUpdate: console.log,
  });
  logStep(`预览完成，二维码: ${qrcodeOutputDest}`);
  logStep(JSON.stringify(result, null, 2));
}
```

- [ ] **Step 4: 实现 upload**

```js
async function runUpload(config, options) {
  const project = createCiProject(config);
  const result = await ci.upload({
    project,
    version: options.version || config.version,
    desc: options.desc || `upload ${config.projectName}`,
    setting: resolveCiSettings(config.distProjectPath),
    robot: options.robot || config.robot,
    onProgressUpdate: console.log,
  });
  logStep(`上传完成，版本号: ${options.version || config.version}`);
  logStep(JSON.stringify(result, null, 2));
}
```

- [ ] **Step 5: main 中切换 preview/upload**

```js
async function main() {
  const { command, projectRoot, options } = parseArgs(process.argv.slice(2));
  const config = resolveProjectConfig(projectRoot);
  await buildMiniProgram(projectRoot, config.buildScript);

  if (command === "preview") {
    await runPreview(config, options);
    return;
  }
  if (command === "upload") {
    await runUpload(config, options);
    return;
  }

  throw new Error(`不支持的命令: ${command}`);
}
```

- [ ] **Step 6: 验证无密钥时不会误上传**

Run: `node /Users/carlwang/.local/share/mini-program-ci-cli/index.mjs upload /Users/carlwang/football_insight/football_insight_mini`
Expected: 若 `.env.ci.local` 未配置，则提前报缺少 `MINI_PROGRAM_PRIVATE_KEY_PATH`，不会进入上传

### Task 4: 接入 registration_system_mini

**Files:**
- Modify: `/Users/carlwang/registration_system/registration_system_mini/src/manifest.json`
- Modify: `/Users/carlwang/registration_system/registration_system_mini/package.json`
- Create: `/Users/carlwang/registration_system/registration_system_mini/scripts/mini-ci.mjs`
- Create: `/Users/carlwang/registration_system/registration_system_mini/.env.ci.local.example`
- Modify: `/Users/carlwang/registration_system/registration_system_mini/README.md`
- Modify: `/Users/carlwang/registration_system/task_plan.md`
- Modify: `/Users/carlwang/registration_system/findings.md`
- Modify: `/Users/carlwang/registration_system/progress.md`
- Modify: `/Users/carlwang/registration_system/registration_system_mini/task_plan.md`
- Modify: `/Users/carlwang/registration_system/registration_system_mini/findings.md`
- Modify: `/Users/carlwang/registration_system/registration_system_mini/progress.md`

- [ ] **Step 1: 把真实 appid 写回 manifest**

```json
{
  "appid": "wx0b5cef0e7f1af280",
  "mp-weixin": {
    "appid": "wx0b5cef0e7f1af280"
  }
}
```

- [ ] **Step 2: 添加项目 wrapper**

```js
#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const command = process.argv[2];
const extraArgs = process.argv.slice(3);
const cliPath = "/Users/carlwang/.local/share/mini-program-ci-cli/index.mjs";
const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);

const child = spawn("node", [cliPath, command, projectRoot, ...extraArgs], {
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: package scripts 暴露最短命令**

```json
{
  "scripts": {
    "mp:preview": "node scripts/mini-ci.mjs preview",
    "mp:upload": "node scripts/mini-ci.mjs upload"
  }
}
```

- [ ] **Step 4: 添加本地 CI 配置示例**

```env
MINI_PROGRAM_APPID=wx0b5cef0e7f1af280
MINI_PROGRAM_PRIVATE_KEY_PATH=./private.wx0b5cef0e7f1af280.key
MINI_PROGRAM_CI_ROBOT=1
MINI_PROGRAM_BUILD_SCRIPT=build:mp-weixin
```

- [ ] **Step 5: README 补使用说明**

```md
## 微信 CI 上传

1. 复制 `.env.ci.local.example` 为 `.env.ci.local`
2. 填入本机的小程序上传私钥路径
3. 执行：

```bash
bun run mp:preview
bun run mp:upload
```

临时覆盖机器人：

```bash
bun run mp:upload -- --robot 2
```
```

- [ ] **Step 6: 同步根目录和 mini 工作文档**

更新本轮“微信小程序 CI 上传工具”相关目标、发现、进度和验证计划。

### Task 5: 接入 football_insight_mini

**Files:**
- Modify: `/Users/carlwang/football_insight/football_insight_mini/package.json`
- Create: `/Users/carlwang/football_insight/football_insight_mini/scripts/mini-ci.mjs`
- Create: `/Users/carlwang/football_insight/football_insight_mini/.env.ci.local.example`
- Modify: `/Users/carlwang/football_insight/football_insight_mini/README.md`
- Modify: `/Users/carlwang/football_insight/task_plan.md`
- Modify: `/Users/carlwang/football_insight/findings.md`
- Modify: `/Users/carlwang/football_insight/progress.md`
- Modify: `/Users/carlwang/football_insight/football_insight_mini/task_plan.md`
- Modify: `/Users/carlwang/football_insight/football_insight_mini/findings.md`
- Modify: `/Users/carlwang/football_insight/football_insight_mini/progress.md`

- [ ] **Step 1: 添加项目 wrapper**

```js
#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const command = process.argv[2];
const extraArgs = process.argv.slice(3);
const cliPath = "/Users/carlwang/.local/share/mini-program-ci-cli/index.mjs";
const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);

const child = spawn("node", [cliPath, command, projectRoot, ...extraArgs], {
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: package scripts 暴露最短命令**

```json
{
  "scripts": {
    "mp:preview": "node scripts/mini-ci.mjs preview",
    "mp:upload": "node scripts/mini-ci.mjs upload"
  }
}
```

- [ ] **Step 3: 添加本地 CI 配置示例**

```env
MINI_PROGRAM_APPID=wxc61da17a97f6eb1b
MINI_PROGRAM_PRIVATE_KEY_PATH=./private.wxc61da17a97f6eb1b.key
MINI_PROGRAM_CI_ROBOT=1
MINI_PROGRAM_BUILD_SCRIPT=build:mp-weixin
```

- [ ] **Step 4: README 补使用说明**

```md
## 微信 CI 上传

1. 复制 `.env.ci.local.example` 为 `.env.ci.local`
2. 填入本机的小程序上传私钥路径
3. 执行：

```bash
bun run mp:preview
bun run mp:upload
```

如需临时覆盖机器人：

```bash
bun run mp:preview -- --robot 2
```
```

- [ ] **Step 5: 同步 football_insight 根目录和 mini 工作文档**

更新本轮“微信小程序 CI 上传工具”相关目标、发现、进度和验证计划。

### Task 6: 验证共享 CLI 与两个项目接入

**Files:**
- Modify: `/Users/carlwang/registration_system/progress.md`
- Modify: `/Users/carlwang/registration_system/registration_system_mini/progress.md`
- Modify: `/Users/carlwang/football_insight/progress.md`
- Modify: `/Users/carlwang/football_insight/football_insight_mini/progress.md`

- [ ] **Step 1: 验证共享 CLI 自身依赖安装和帮助链路**

Run: `cd /Users/carlwang/.local/share/mini-program-ci-cli && npm install`
Expected: `miniprogram-ci` 和 `dotenv` 安装成功

- [ ] **Step 2: 验证 registration_system_mini 构建与 wrapper**

Run: `cd /Users/carlwang/registration_system/registration_system_mini && bun run type-check && bun run build:mp-weixin && bun run mp:preview`
Expected: 类型检查和构建通过；若缺 `.env.ci.local` 或密钥路径，CLI 给出明确错误，不出现参数解析异常

- [ ] **Step 3: 验证 football_insight_mini 构建与 wrapper**

Run: `cd /Users/carlwang/football_insight/football_insight_mini && bun run type-check && bun run build:mp-weixin && bun run mp:preview`
Expected: 类型检查和构建通过；若缺 `.env.ci.local` 或密钥路径，CLI 给出明确错误

- [ ] **Step 4: 若本机已配置真实 `.env.ci.local` 与私钥，则执行一次真实预览链路验证**

Run: `bun run mp:preview -- --robot 1`
Expected: `miniprogram-ci` 成功返回二维码输出路径

- [ ] **Step 5: 执行 diff 检查并同步进度文档**

Run: `git -C /Users/carlwang/registration_system diff --check`
Run: `git -C /Users/carlwang/football_insight diff --check`
Expected: 无格式错误；文档记录清楚哪些验证因缺私钥仅做到了“失败即正确”层级
