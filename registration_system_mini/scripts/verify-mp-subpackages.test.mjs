import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifySubpackages } from "./verify-mp-subpackages.mjs";

const roots = [];
function put(root, file, content) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content));
}
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "mini-subpackages-test-"));
  roots.push(root);
  put(root, "app.json", {
    pages: ["pages/home/index"],
    tabBar: { list: [{ pagePath: "pages/home/index" }] },
    subPackages: [
      { root: "pages/matches", pages: ["detail"] },
      { root: "pages/manage", pages: ["index"] },
    ],
  });
  for (const page of ["pages/home/index", "pages/matches/detail", "pages/manage/index"]) {
    put(root, `${page}.js`, 'require("../../shared.js");');
    put(root, `${page}.json`, {});
    put(root, `${page}.wxml`, "<view />");
  }
  put(root, "shared.js", "exports.value = 1;");
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("accepts subpackage dependencies on the main package and on its own files", () => {
  const root = fixture();
  put(root, "pages/matches/helper.js", "exports.value = 2;");
  put(root, "pages/matches/detail.js", 'require("./helper.js"); require("../../shared.js");');
  expect(() => verifySubpackages(root)).not.toThrow();
});

test("rejects a main-package require of a subpackage module", () => {
  const root = fixture();
  put(root, "shared.js", 'require("./pages/matches/detail.js");');
  expect(() => verifySubpackages(root)).toThrow("shared.js -> pages/matches/detail.js");
});

test("rejects a synchronous require between sibling subpackages", () => {
  const root = fixture();
  put(root, "pages/manage/index.js", 'require("../matches/detail.js");');
  expect(() => verifySubpackages(root)).toThrow("pages/manage/index.js -> pages/matches/detail.js");
});

test("rejects main-package component references into a subpackage", () => {
  const root = fixture();
  put(root, "pages/home/index.json", { usingComponents: { card: "/pages/matches/detail" } });
  expect(() => verifySubpackages(root)).toThrow("pages/home/index.json -> pages/matches/detail.json");
});

test("rejects cross-package stylesheet and template imports", () => {
  const root = fixture();
  put(root, "pages/matches/detail.wxss", "view {}");
  put(root, "pages/home/index.wxss", '@import "../matches/detail.wxss";');
  expect(() => verifySubpackages(root)).toThrow("pages/home/index.wxss -> pages/matches/detail.wxss");
  put(root, "pages/home/index.wxss", "");
  put(root, "pages/home/index.wxml", '<import src="../matches/detail.wxml" />');
  expect(() => verifySubpackages(root)).toThrow("pages/home/index.wxml -> pages/matches/detail.wxml");
});

test("rejects missing route output and missing required modules", () => {
  const root = fixture();
  rmSync(path.join(root, "pages/matches/detail.wxml"));
  expect(() => verifySubpackages(root)).toThrow("pages/matches/detail.wxml");
  put(root, "pages/matches/detail.wxml", "<view />");
  put(root, "shared.js", 'require("./missing.js");');
  expect(() => verifySubpackages(root)).toThrow("missing.js");
});

test("rejects tab pages assigned to subpackages", () => {
  const root = fixture();
  put(root, "app.json", {
    pages: ["pages/home/index"],
    tabBar: { list: [{ pagePath: "pages/matches/detail" }] },
    subPackages: [{ root: "pages/matches", pages: ["detail"] }],
  });
  expect(() => verifySubpackages(root)).toThrow("Tab page must remain in the main package");
});
