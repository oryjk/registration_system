// 交叉验证：className 属性中引用的类名，在 src/styles/*.css 或构建产物中是否有定义。
// - 只从含 className 的行提取，避开 import 路径 / data-slot / aria 属性等噪音
// - 产物做子串匹配（Tailwind 变体类是转义形式 .hover\:bg-xxx，正则提取会漏）
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

// 1. 用 ripgrep 抓取 src 下所有含 className 的行（排除 .umi 残留与测试文件）
const lines = execSync(
  'rg -N --no-filename -g "*.tsx" -g "!*.test.tsx" -g "!.umi*" "className" src',
  { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

const usedClasses = new Set();
// 从行中提取引号内的连字符类名 token
const tokenPattern = /\b[a-z][a-z0-9]+(?:-[a-z0-9]+)+\b/g;
for (const line of lines.split("\n")) {
  for (const m of line.matchAll(tokenPattern)) {
    const token = m[0];
    // aria-*/data-* 是 JSX 属性（同一行被整行抓入），不是类名；
    // 若需要它们走样式，应通过属性选择器而非类选择器。
    if (token.startsWith("aria-") || token.startsWith("data-")) continue;
    usedClasses.add(token);
  }
}

// 2. src/styles/*.css 定义的类名
const cssDir = join(root, "src/styles");
let cssText = "";
for (const f of readdirSync(cssDir)) {
  if (f.endsWith(".css")) cssText += readFileSync(join(cssDir, f), "utf8");
}
const definedInSrc = new Set();
for (const m of cssText.matchAll(/\.([a-z][a-z0-9-]*)/g)) {
  definedInSrc.add(m[1]);
}

// 3. 构建产物原文（子串匹配用，兼容 Tailwind 转义类名）
const distDir = join(root, "dist/assets");
let distText = "";
for (const f of readdirSync(distDir)) {
  if (f.endsWith(".css")) distText += readFileSync(join(distDir, f), "utf8");
}

// 4. 交叉：className 里用了，但 src CSS 没定义、产物里也没有
const missing = [];
for (const cls of usedClasses) {
  if (definedInSrc.has(cls)) continue;
  if (distText.includes(cls)) continue;
  missing.push(cls);
}

// 5. 定位每个缺失类的引用文件
const report = [];
for (const cls of missing.sort()) {
  let files = "";
  try {
    files = execSync(
      `rg -l -g "*.tsx" -g "!*.test.tsx" -g "!.umi*" "${cls}" src | head -3`,
      { cwd: root, encoding: "utf8" },
    )
      .trim()
      .replaceAll("\n", ", ");
  } catch {
    files = "?";
  }
  report.push(`  .${cls}  <- ${files}`);
}

console.log(`className 行中提取的连字符类名: ${usedClasses.size}`);
console.log(`src/styles 定义: ${definedInSrc.size}`);
console.log(`\n疑似未定义（src CSS 与产物均无）: ${missing.length}`);
console.log(report.join("\n"));
