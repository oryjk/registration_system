import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadProductionEnvironment,
  normalizeReleaseApiBase,
  runMiniRelease,
  verifyReleaseBundle,
} from "./mini-release.mjs";

const productionApi = "https://api.example.com:82/regist-v3/api/v1/app";
const localApi = "http://127.0.0.1:18080/api/v1/app";
const roots = [];

function fixture(api = productionApi) {
  const root = mkdtempSync(path.join(tmpdir(), "mini-release-test-"));
  roots.push(root);
  writeFileSync(path.join(root, ".env.production"), `VITE_API_BASE_URL=${productionApi}\nVITE_PRODUCTION_ONLY=yes\n`);
  writeFileSync(path.join(root, ".env.development"), `VITE_API_BASE_URL=${localApi}\nVITE_USE_MOCK=true\n`);
  writeFileSync(path.join(root, ".env.local"), `VITE_API_BASE_URL=${localApi}\nVITE_USE_MOCK=true\n`);
  const dist = path.join(root, "dist/build/mp-weixin");
  mkdirSync(path.join(dist, "config"), { recursive: true });
  writeFileSync(path.join(dist, "app.json"), "{}");
  writeFileSync(path.join(dist, "config/apiBase.js"), `exports.getApiBaseUrl = () => ${JSON.stringify(api)};`);
  return root;
}

function recordingRunner(failScript) {
  const steps = [];
  return {
    steps,
    runStep: async (cmd, options) => {
      steps.push({ cmd, env: options.env });
      return cmd.some(arg => arg.endsWith(failScript || "<no failure>")) ? 1 : 0;
    },
  };
}

function scriptNames(steps) {
  return steps.map(({ cmd }) => path.basename(cmd[3]));
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("production release environment", () => {
  test("replaces inherited development variables with the explicit production file", () => {
    const root = fixture();
    const inherited = {
      ...process.env,
      NODE_ENV: "development",
      VITE_API_BASE_URL: localApi,
      VITE_USE_MOCK: "true",
      VITE_DEV_ONLY: "must-not-leak",
      UNI_INPUT_DIR: "/wrong/source",
      MINI_CI_PRIVATE_KEY_PATH: "/test/private.key",
    };
    const env = loadProductionEnvironment(root, inherited);
    expect(env.NODE_ENV).toBe("production");
    expect(env.VITE_API_BASE_URL).toBe(productionApi);
    expect(env.VITE_PRODUCTION_ONLY).toBe("yes");
    expect(env.VITE_USE_MOCK).toBe("false");
    expect(env.VITE_DEV_ONLY).toBeUndefined();
    expect(env.UNI_INPUT_DIR).toBeUndefined();
    expect(env.MINI_CI_PRIVATE_KEY_PATH).toBe("/test/private.key");
    expect(inherited.VITE_API_BASE_URL).toBe(localApi);
  });

  test("fails without an explicit production file instead of falling back to localhost", () => {
    const root = fixture();
    rmSync(path.join(root, ".env.production"));
    expect(() => loadProductionEnvironment(root)).toThrow(".env.production");
  });

  test("fails when the production file omits its API or enables mock mode", () => {
    const root = fixture();
    writeFileSync(path.join(root, ".env.production"), "VITE_OTHER=value\n");
    expect(() => loadProductionEnvironment(root)).toThrow("VITE_API_BASE_URL");
    writeFileSync(path.join(root, ".env.production"), `VITE_API_BASE_URL=${productionApi}\nVITE_USE_MOCK=true\n`);
    expect(() => loadProductionEnvironment(root)).toThrow("Mock");
  });

  test("accepts production HTTPS with a reverse-proxy prefix and explicit port", () => {
    expect(normalizeReleaseApiBase(` ${productionApi}/ `)).toBe(productionApi);
  });

  for (const api of [localApi, "https://localhost/api/v1/app", "https://192.168.1.8/api/v1/app", "https://[::1]/api/v1/app", "https://dev.local/api/v1/app", "https://api.example.com/api", "https://api.example.com/api/v1/app?debug=1", "https://user:password@api.example.com/api/v1/app"]) {
    test(`rejects an unsafe or malformed release endpoint: ${api.replace("user:password@", "<credentials>@")}`, () => {
      expect(() => normalizeReleaseApiBase(api)).toThrow();
    });
  }
});

describe("compiled release API guard", () => {
  test("evaluates the actual getter, allowing an unused local fallback string", () => {
    const root = fixture();
    writeFileSync(path.join(root, "dist/build/mp-weixin/config/apiBase.js"), `const fallback = ${JSON.stringify(localApi)}; exports.getApiBaseUrl = () => ${JSON.stringify(productionApi)} || fallback;`);
    expect(verifyReleaseBundle(root, productionApi)).toBe(productionApi);
  });

  test("rejects a local getter even when the production URL occurs elsewhere in the file", () => {
    const root = fixture(localApi);
    writeFileSync(path.join(root, "dist/build/mp-weixin/config/apiBase.js"), `const unusedProduction = ${JSON.stringify(productionApi)}; exports.getApiBaseUrl = () => ${JSON.stringify(localApi)};`);
    expect(() => verifyReleaseBundle(root, productionApi)).toThrow();
  });

  test("rejects a different public backend", () => {
    const root = fixture("https://wrong.example.com/api/v1/app");
    expect(() => verifyReleaseBundle(root, productionApi)).toThrow("不一致");
  });

  test("rejects a missing bundle or missing API getter", () => {
    const root = fixture();
    writeFileSync(path.join(root, "dist/build/mp-weixin/config/apiBase.js"), "exports.other = 1;");
    expect(() => verifyReleaseBundle(root, productionApi)).toThrow("getApiBaseUrl");
    rmSync(path.join(root, "dist/build/mp-weixin/app.json"));
    expect(() => verifyReleaseBundle(root, productionApi)).toThrow("app.json");
  });

  test("direct mini-ci invocation rejects a local bundle before loading the WeChat SDK", () => {
    const root = fixture(localApi);
    mkdirSync(path.join(root, "scripts"));
    mkdirSync(path.join(root, "src"));
    mkdirSync(path.join(root, "node_modules"));
    // Only JSON5 is available in this fixture: an accidental SDK load fails instead of contacting WeChat.
    const require = createRequire(import.meta.url);
    symlinkSync(path.dirname(require.resolve("json5/package.json")), path.join(root, "node_modules/json5"), "dir");
    for (const file of ["mini-ci.mjs", "mini-release.mjs"]) {
      writeFileSync(path.join(root, "scripts", file), readFileSync(new URL(file, import.meta.url)));
    }
    writeFileSync(path.join(root, "src/manifest.json"), JSON.stringify({ "mp-weixin": { appid: "wx-test-only" }, versionName: "0.0.1" }));
    const privateKeyPath = path.join(root, "private.test.key");
    writeFileSync(privateKeyPath, "not-a-real-key");
    const result = Bun.spawnSync([process.execPath, "--no-env-file", "--bun", "scripts/mini-ci.mjs", "upload"], {
      cwd: root, env: { ...process.env, MINI_CI_PRIVATE_KEY_PATH: privateKeyPath }, stdout: "pipe", stderr: "pipe",
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("生产 VITE_API_BASE_URL");
    expect(result.stderr.toString()).not.toContain("Cannot find package");
    expect(result.stdout.toString()).not.toContain("上传完成");
  });
});

describe("Bun release pipeline", () => {
  test("allocates once, builds production, checks components, then uploads with the requested slot and description", async () => {
    const root = fixture();
    const runner = recordingRunner();
    await runMiniRelease("upload", ["--", "--robot", "2", "--desc", "报名修复，含空格 and symbols"], { projectRoot: root, env: { ...process.env, MINI_REVIEW_SKIP: "1", VITE_API_BASE_URL: localApi }, ...runner });
    expect(scriptNames(runner.steps)).toEqual(["sync-manifest-version.mjs", "uni.js", "verify-mp-component-registrations.mjs", "mini-ci.mjs"]);
    for (const { cmd, env } of runner.steps) {
      expect(cmd.slice(0, 3)).toEqual([process.execPath, "--no-env-file", "--bun"]);
      expect(env.NODE_ENV).toBe("production");
      expect(env.VITE_API_BASE_URL).toBe(productionApi);
      expect(env.MINI_REVIEW_SKIP).toBe("0");
    }
    expect(runner.steps[1].cmd.slice(4)).toEqual(["build", "-p", "mp-weixin", "--mode", "production"]);
    expect(runner.steps[3].cmd.slice(4)).toEqual(["upload", "--robot", "2", "--desc", "报名修复，含空格 and symbols"]);
  });

  test("build-only retains the offline version flag and never uploads", async () => {
    const root = fixture();
    const runner = recordingRunner();
    await runMiniRelease("build", [], { projectRoot: root, env: { ...process.env, MINI_REVIEW_SKIP: "1" }, ...runner });
    expect(scriptNames(runner.steps)).toEqual(["sync-manifest-version.mjs", "uni.js", "verify-mp-component-registrations.mjs"]);
    expect(runner.steps[0].env.MINI_REVIEW_SKIP).toBe("1");
  });

  test("never reaches upload when the compiled API is local", async () => {
    const root = fixture(localApi);
    const runner = recordingRunner();
    await expect(runMiniRelease("upload", [], { projectRoot: root, ...runner })).rejects.toThrow();
    expect(scriptNames(runner.steps)).not.toContain("mini-ci.mjs");
  });

  for (const failed of ["sync-manifest-version.mjs", "uni.js", "verify-mp-component-registrations.mjs"]) {
    test(`stops on ${failed} failure instead of uploading stale output`, async () => {
      const root = fixture();
      const runner = recordingRunner(failed);
      await expect(runMiniRelease("upload", [], { projectRoot: root, ...runner })).rejects.toThrow();
      expect(scriptNames(runner.steps).at(-1)).toBe(failed);
      expect(scriptNames(runner.steps)).not.toContain("mini-ci.mjs");
    });
  }

  test("preview checks the existing bundle without allocating or rebuilding", async () => {
    const root = fixture();
    const runner = recordingRunner();
    await runMiniRelease("preview", ["--desc", "预览"], { projectRoot: root, ...runner });
    expect(scriptNames(runner.steps)).toEqual(["mini-ci.mjs"]);
    const badRoot = fixture(localApi);
    const blocked = recordingRunner();
    await expect(runMiniRelease("preview", [], { projectRoot: badRoot, ...blocked })).rejects.toThrow();
    expect(blocked.steps).toEqual([]);
  });

  test("verify is read-only and invokes no build, version registration or upload", async () => {
    const root = fixture();
    const runner = recordingRunner();
    const before = readFileSync(path.join(root, ".env.production"), "utf8");
    await runMiniRelease("verify", [], { projectRoot: root, ...runner });
    expect(runner.steps).toEqual([]);
    expect(readFileSync(path.join(root, ".env.production"), "utf8")).toBe(before);
  });

  test("rejects mode overrides and invalid robot values before any side effects", async () => {
    const root = fixture();
    for (const args of [["--mode", "development"], ["--robot", "0"], ["--robot"], ["--desc"]]) {
      const runner = recordingRunner();
      await expect(runMiniRelease("upload", args, { projectRoot: root, ...runner })).rejects.toThrow();
      expect(runner.steps).toEqual([]);
    }
  });
});
