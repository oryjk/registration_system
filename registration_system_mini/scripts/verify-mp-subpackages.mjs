import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function collectFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(prefix, entry.name);
    return entry.isDirectory()
      ? collectFiles(path.join(directory, entry.name), relative)
      : [relative];
  });
}

// Ordinary subpackages may use their own resources or main-package resources.
// This checks the compiler's static require/component/style/template output;
// it intentionally does not support independent packages or async cross-package imports.
export function verifySubpackages(outputDir) {
  const files = new Set(collectFiles(outputDir));
  const read = (file) => readFileSync(path.join(outputDir, file), "utf8");
  const app = JSON.parse(read("app.json"));
  const packages = app.subPackages ?? app.subpackages ?? [];
  if (packages.some((item) => item.independent)) {
    throw new Error("Independent subpackages need a separate dependency policy");
  }
  const owner = (file) => packages.find((item) => file.startsWith(`${item.root}/`))?.root ?? "main";
  const assertFile = (file) => {
    if (!files.has(file)) throw new Error(`Missing compiled resource: ${file}`);
  };
  const checkReference = (source, reference, extension = "") => {
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(reference)) return;
    const target = path.posix.normalize(reference.startsWith("/")
      ? reference.slice(1)
      : path.posix.join(path.posix.dirname(source), reference));
    const resolved = extension && !target.endsWith(extension) ? `${target}${extension}` : target;
    assertFile(resolved);
    if (owner(resolved) !== "main" && owner(source) !== owner(resolved)) {
      throw new Error(`Invalid synchronous package dependency: ${source} -> ${resolved}`);
    }
  };

  const pages = [
    ...(app.pages ?? []),
    ...packages.flatMap((item) => item.pages.map((page) => `${item.root}/${page}`)),
  ];
  if (new Set(pages).size !== pages.length) throw new Error("Duplicate compiled page route");
  for (const page of pages) {
    for (const extension of [".js", ".json", ".wxml"]) assertFile(`${page}${extension}`);
  }
  for (const tab of app.tabBar?.list ?? []) {
    if (!(app.pages ?? []).includes(tab.pagePath) || owner(tab.pagePath) !== "main") {
      throw new Error(`Tab page must remain in the main package: ${tab.pagePath}`);
    }
  }
  for (const file of files) {
    const extension = path.posix.extname(file);
    if (![".js", ".json", ".wxss", ".wxml"].includes(extension)) continue;
    const content = read(file);
    if (extension === ".js") {
      for (const match of content.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) {
        checkReference(file, match[1], ".js");
      }
    } else if (extension === ".json") {
      for (const reference of Object.values(JSON.parse(content).usingComponents ?? {})) {
        checkReference(file, reference, ".json");
      }
    } else if (extension === ".wxss") {
      for (const match of content.matchAll(/@import\s+["']([^"']+)["']/g)) {
        checkReference(file, match[1]);
      }
    } else {
      for (const match of content.matchAll(/<(?:import|include|wxs)\b[^>]*\bsrc=["']([^"']+)["']/g)) {
        checkReference(file, match[1]);
      }
    }
  }
  console.log(`Verified ${pages.length} page routes and ${packages.length} ordinary subpackages; static dependencies are valid.`);
}

if (import.meta.main) {
  verifySubpackages(fileURLToPath(new URL("../dist/build/mp-weixin/", import.meta.url)));
}
