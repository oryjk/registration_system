import { expect, test } from "bun:test";
import { createMinioImageCache } from "../minioImageCache";
import { isMinioImageUrl, isImmutableMinioImage } from "../minioImagePolicy";

const ordinary = "https://oryjk.cn:82/registration/static/home/banner.png";
const hashed = "https://oryjk.cn:82/registration/static/share/v3/home/48a81eeaec54e66f.jpg";
const day = 86400000;
function fixture() {
  const f = { now: 1000, downloads: 0, saves: 0, aborts: 0, failDownload: false, failSave: false,
    removed: [] as string[], storage: {} as Record<string, any>, files: new Map<string, number>() };
  (globalThis as any).uni = {
    getStorageSync: (key: string) => f.storage[key], setStorageSync: (key: string, value: any) => { f.storage[key] = structuredClone(value); },
    getFileSystemManager: () => ({
      getFileInfo: ({ filePath, success, fail }: any) => f.files.has(filePath) ? success({ size: f.files.get(filePath) }) : fail({}),
      saveFile: ({ tempFilePath, success, fail }: any) => {
        f.saves++; if (f.failSave) { fail({}); return; }
        const path = "saved-" + tempFilePath; f.files.set(path, f.files.get(tempFilePath)!); f.files.delete(tempFilePath); success({ savedFilePath: path });
      },
      removeSavedFile: ({ filePath, success }: any) => { f.removed.push(filePath); f.files.delete(filePath); success({}); },
    }),
    downloadFile: ({ success, fail }: any) => {
      f.downloads++; if (f.failDownload) fail({});
      else { const path = "tmp-" + f.downloads; f.files.set(path, 100); success({ statusCode: 200, tempFilePath: path }); }
      return { abort: () => { f.aborts++; } };
    },
  };
  return f;
}
test("recognizes only owned MinIO buckets and content hash filenames", () => {
  expect(isMinioImageUrl(ordinary)).toEqual(true);
  expect(isMinioImageUrl("https://match.oryjk.cn/seat-images/a.jpg")).toEqual(true);
  for (const src of ["/static/icon.png", "wxfile://saved/a", "https://oryjk.cn.evil/registration/a.png", "https://oryjk.cn/registration-fake/a.png", "https://cdn.example.com/a.png"]) expect(isMinioImageUrl(src)).toEqual(false);
  expect(isImmutableMinioImage(hashed)).toEqual(true);
  expect(isImmutableMinioImage(ordinary)).toEqual(false);
});
test("coalesces simultaneous downloads and persists across cache instances", async () => {
  const f = fixture(), cache = createMinioImageCache();
  expect(await Promise.all([cache.get(hashed), cache.get(hashed)])).toEqual(["saved-tmp-1", "saved-tmp-1"]);
  expect(await createMinioImageCache().get(hashed)).toEqual("saved-tmp-1");
  expect(f.downloads).toEqual(1); expect(f.saves).toEqual(1);
});
test("ordinary files expire at seven days while hash files keep their cache", async () => {
  const f = fixture(), cache = createMinioImageCache({ now: () => f.now });
  await cache.get(ordinary); await cache.get(hashed);
  f.now += 7 * day - 1; expect(await cache.get(ordinary)).toEqual("saved-tmp-1");
  f.now++; expect(await cache.get(ordinary)).toEqual("saved-tmp-3");
  f.now += 100 * day; expect(await cache.get(hashed)).toEqual("saved-tmp-2");
  expect(f.downloads).toEqual(3);
});
test("missing files and new URLs redownload", async () => {
  const f = fixture(), cache = createMinioImageCache();
  await cache.get(hashed); f.files.clear();
  expect(await cache.get(hashed)).toEqual("saved-tmp-2");
  expect(await cache.get(hashed.replace("48a81eeaec54e66f", "aaaaaaaaaaaaaaaa"))).toEqual("saved-tmp-3");
});
test("failed refresh retains a valid stale file and later retries", async () => {
  const f = fixture(), cache = createMinioImageCache({ now: () => f.now });
  await cache.get(ordinary); f.now += 8 * day; f.failDownload = true;
  expect(await cache.get(ordinary)).toEqual("saved-tmp-1");
  f.failDownload = false; expect(await cache.get(ordinary)).toEqual("saved-tmp-3");
});
test("a failed refresh cannot return a stale file evicted by another image", async () => {
  const f = fixture(), cache = createMinioImageCache({ now: () => f.now, maxEntries: 1 });
  await cache.get(ordinary); f.now += 8 * day;
  const original = uni.downloadFile;
  let failRefresh!: () => void, markStarted!: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  (uni as any).downloadFile = (options: any) => {
    if (options.url !== ordinary) return original(options);
    failRefresh = () => options.fail({}); markStarted(); return { abort: () => {} };
  };
  const refresh = cache.get(ordinary); await started;
  await cache.get(hashed); expect(f.files.has("saved-tmp-1")).toEqual(false);
  failRefresh(); expect(await refresh).toEqual(ordinary);
});
test("quota failure reuses a temporary file without saving it again", async () => {
  const f = fixture(); f.failSave = true; const cache = createMinioImageCache();
  expect(await cache.get(ordinary)).toEqual("tmp-1");
  expect(await cache.get(ordinary)).toEqual("tmp-1"); expect(f.downloads).toEqual(1);
});
test("LRU eviction respects both file count and byte budget", async () => {
  const f = fixture(), cache = createMinioImageCache({ now: () => ++f.now, maxEntries: 2, maxBytes: 200 });
  await cache.get(ordinary); await cache.get(hashed); await cache.get(ordinary);
  await cache.get(ordinary + "?new=1");
  expect(f.removed.includes("saved-tmp-2")).toEqual(true);
  expect(f.removed.includes("saved-tmp-1")).toEqual(false);
});
test("different concurrent URLs still enforce the storage limit", async () => {
  const f = fixture(), cache = createMinioImageCache({ maxEntries: 2, maxBytes: 200 });
  await Promise.all([cache.get(ordinary), cache.get(hashed), cache.get(ordinary + "?v=2")]);
  expect(f.removed.length).toEqual(1);
});
test("mounted image leases keep their files while new images use temporary space", async () => {
  const f = fixture(), cache = createMinioImageCache({ now: () => f.now, maxEntries: 1 });
  const release = cache.retain(ordinary);
  const path = await cache.get(ordinary);
  expect(await cache.get(hashed)).toEqual("tmp-2");
  expect(f.files.has(path)).toEqual(true); expect(f.saves).toEqual(1);
  f.now += 8 * day;
  expect(await cache.get(ordinary)).toEqual("tmp-3");
  expect(f.files.has(path)).toEqual(true);
  release(); await cache.get(hashed + "?new=1");
  expect(f.files.has(path)).toEqual(false);
});
test("index quota failure cannot accumulate untracked saved files across restarts", async () => {
  const f = fixture(); (uni as any).setStorageSync = () => { throw new Error("quota"); };
  for (let index = 0; index < 3; index++) {
    expect(await createMinioImageCache({ maxEntries: 1 }).get(ordinary)).toEqual("tmp-" + (index + 1));
  }
  expect(f.saves).toEqual(0);
  expect([...f.files.keys()].filter(path => path.startsWith("saved-")).length).toEqual(0);
});
test("a saved file is removed if committing its index fails", async () => {
  const f = fixture();
  (uni as any).setStorageSync = (_key: string, value: any) => {
    if (Object.keys(value.files).length) throw new Error("quota");
    f.storage[_key] = structuredClone(value);
  };
  expect(await createMinioImageCache().get(ordinary)).toEqual(ordinary);
  expect([...f.files.keys()].filter(path => path.startsWith("saved-")).length).toEqual(0);
});
test("download deadline aborts and ignores late callbacks", async () => {
  const f = fixture(); let late: any;
  (uni as any).downloadFile = (options: any) => { late = options; return { abort: () => { f.aborts++; } }; };
  const cache = createMinioImageCache({ timeoutMs: 5 });
  expect(await cache.get(ordinary)).toEqual(ordinary); expect(f.aborts).toEqual(1);
  expect(late.timeout).toEqual(5);
  late.success({ statusCode: 200, tempFilePath: "late-file" }); expect(f.saves).toEqual(0);
});
test("old honor cache files migrate without downloading again", async () => {
  const f = fixture(); f.storage["honor-background-files-v1"] = { [hashed]: "legacy-file" }; f.files.set("legacy-file", 100);
  expect(await createMinioImageCache().get(hashed)).toEqual("legacy-file"); expect(f.downloads).toEqual(0);
});
test("external sources pass through and HTTP errors are never persisted", async () => {
  const f = fixture(), cache = createMinioImageCache();
  expect(await cache.get("https://example.com/logo.jpg")).toEqual("https://example.com/logo.jpg"); expect(f.downloads).toEqual(0);
  (uni as any).downloadFile = ({ success }: any) => success({ statusCode: 404, tempFilePath: "error.html" });
  expect(await cache.get(ordinary)).toEqual(ordinary); expect(f.saves).toEqual(0);
});

test("oversized images remain temporary and do not evict valid saved files", async () => {
  const f = fixture(), cache = createMinioImageCache({ maxBytes: 50 });
  expect(await cache.get(hashed)).toEqual("tmp-1");
  expect(await cache.get(hashed)).toEqual("tmp-1"); expect(f.saves).toEqual(0); expect(f.removed).toEqual([]);
});

test("at most four network downloads start simultaneously", async () => {
  const f = fixture(); let active = 0, peak = 0;
  const complete: Array<() => void> = [];
  (uni as any).downloadFile = ({ success }: any) => {
    f.downloads++; const path = "tmp-" + f.downloads;
    peak = Math.max(peak, ++active);
    complete.push(() => { active--; f.files.set(path, 100); success({ statusCode: 200, tempFilePath: path }); });
    return { abort: () => {} };
  };
  const cache = createMinioImageCache();
  const all = Promise.all(Array.from({ length: 6 }, (_, index) => cache.get(ordinary + "?v=" + index)));
  await Promise.resolve(); expect(f.downloads).toEqual(4);
  for (const done of complete.slice()) done();
  await new Promise(resolve => setTimeout(resolve, 0));
  for (const done of complete.slice(4)) done();
  await all; expect(f.downloads).toEqual(6); expect(peak).toEqual(4);
});
