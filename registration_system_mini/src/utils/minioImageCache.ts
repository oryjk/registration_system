import { isMinioImageUrl, isImmutableMinioImage, MINIO_IMAGE_DOWNLOAD_TIMEOUT, MINIO_IMAGE_TTL, MINIO_IMAGE_MAX_BYTES, MINIO_IMAGE_MAX_ENTRIES } from "./minioImagePolicy";

export const MINIO_IMAGE_STORAGE_KEY = "minio-image-files-v1";
type Entry = { path: string; size: number; savedAt: number; lastUsed: number };
type Options = { now?: () => number; timeoutMs?: number; maxBytes?: number; maxEntries?: number };

/** Shared by native images, share callbacks and canvas; never changes API URLs. */
export function createMinioImageCache(options: Options = {}) {
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? MINIO_IMAGE_DOWNLOAD_TIMEOUT;
  const maxBytes = options.maxBytes ?? MINIO_IMAGE_MAX_BYTES;
  const maxEntries = options.maxEntries ?? MINIO_IMAGE_MAX_ENTRIES;
  const saved: Record<string, Entry> = Object.create(null);
  const temporary = new Map<string, Entry>();
  const pending = new Map<string, Promise<string>>();
  const retained = new Map<string, number>();
  let writes: Promise<unknown> = Promise.resolve();
  let downloading = 0;
  const waiting: Array<() => void> = [];
  function acquire() {
    return new Promise<void>(resolve => {
      if (downloading < 4) { downloading++; resolve(); } else waiting.push(resolve);
    });
  }
  function release() { const next = waiting.shift(); if (next) next(); else downloading--; }
  try {
    const stored = uni.getStorageSync(MINIO_IMAGE_STORAGE_KEY);
    if (stored?.version === 1 && stored.files && typeof stored.files === "object") {
      for (const [url, value] of Object.entries(stored.files)) {
        const entry = value as Entry;
        if (isMinioImageUrl(url) && entry && typeof entry.path === "string" && entry.path &&
          Number.isFinite(entry.size) && entry.size >= 0 && Number.isFinite(entry.savedAt) && Number.isFinite(entry.lastUsed)) saved[url] = { ...entry };
      }
    } else {
      // Keep already downloaded honor presets; importing paths does not copy files.
      const legacy = uni.getStorageSync("honor-background-files-v1");
      if (legacy && typeof legacy === "object") for (const [url, path] of Object.entries(legacy)) {
        if (isMinioImageUrl(url) && typeof path === "string" && path) saved[url] = { path, size: 0, savedAt: now(), lastUsed: now() };
      }
    }
  } catch { /* Storage failure must not prevent image display. */ }
  function persist(): boolean {
    try { uni.setStorageSync(MINIO_IMAGE_STORAGE_KEY, { version: 1, files: { ...saved } }); return true; }
    catch { return false; }
  }
  async function sizeOf(path: string): Promise<number | null> {
    try {
      return await new Promise<number | null>(resolve => uni.getFileSystemManager().getFileInfo({
        filePath: path, success: result => resolve(result.size > 0 ? result.size : null), fail: () => resolve(null),
      }));
    } catch { return null; }
  }
  async function remove(path: string) {
    try {
      await new Promise<void>(resolve => uni.getFileSystemManager().removeSavedFile({ filePath: path, success: () => resolve(), fail: () => resolve() }));
    } catch { /* It may already have been removed by the platform. */ }
  }
  function fresh(url: string, entry: Entry) { return isImmutableMinioImage(url) || now() - entry.savedAt < MINIO_IMAGE_TTL; }
  async function download(url: string): Promise<string> {
    await acquire();
    try { return await new Promise<string>((resolve, reject) => {
      let finished = false;
      let task: UniApp.DownloadTask | undefined;
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        reject(new Error("图片下载超时"));
        try { task?.abort(); } catch { /* Deadline is already settled. */ }
      }, timeoutMs);
      function done(path?: string) {
        if (finished) return;
        finished = true; clearTimeout(timer);
        if (path) resolve(path); else reject(new Error("图片下载失败"));
      }
      try {
        task = uni.downloadFile({ url, timeout: timeoutMs,
          success: result => done(result.statusCode === 200 ? result.tempFilePath : undefined), fail: () => done(),
        });
      } catch { done(); }
    }); } finally { release(); }
  }
  async function evict(incomingBytes: number, incomingCount: number, exclude?: string) {
    const entries = () => Object.entries(saved);
    const total = () => entries().reduce((sum, [, entry]) => sum + entry.size, 0);
    for (const [url, entry] of entries().sort((a, b) => a[1].lastUsed - b[1].lastUsed)) {
      if (entries().length + incomingCount <= maxEntries && total() + incomingBytes <= maxBytes) break;
      if (url === exclude || retained.has(url)) continue;
      // Remove only files recorded by this cache, never other features' files.
      await remove(entry.path); delete saved[url]; persist();
    }
    return entries().length + incomingCount <= maxEntries && total() + incomingBytes <= maxBytes;
  }
  async function store(url: string, path: string, size: number): Promise<string> {
    const action = async () => {
      const entry: Entry = { path, size, savedAt: now(), lastUsed: now() };
      const previous = saved[url];
      // Mounted native images keep their paths. Refreshes/new files can remain
      // temporary when every persisted slot is still in use.
      if (size <= maxBytes && maxEntries > 0 && !(previous && retained.has(url)) && persist() &&
        await evict(Math.max(0, size - (previous?.size ?? 0)), previous ? 0 : 1, url)) {
        try {
          const local = await new Promise<string>((resolve, reject) => uni.getFileSystemManager().saveFile({
            tempFilePath: path, success: result => result.savedFilePath ? resolve(result.savedFilePath) : reject(new Error("缓存保存失败")), fail: reject,
          }));
          saved[url] = { ...entry, path: local };
          if (!persist()) {
            if (previous) saved[url] = previous; else delete saved[url];
            await remove(local);
            throw new Error("缓存索引保存失败");
          }
          temporary.delete(url);
          if (previous && previous.path !== local) await remove(previous.path);
          return local;
        } catch { /* Quota/storage failure keeps the downloaded temporary file. */ }
      }
      if (await sizeOf(path) === null) throw new Error("临时图片文件不可用");
      temporary.set(url, entry);
      if (temporary.size > maxEntries) temporary.delete(temporary.keys().next().value!);
      return path;
    };
    // Saving/removing files is serialized even when downloads finish together.
    const work = writes.then(action, action); writes = work.catch(() => undefined); return work;
  }
  async function load(url: string): Promise<string> {
    const cached = temporary.get(url) ?? saved[url];
    let stale: string | undefined;
    if (cached) {
      const size = await sizeOf(cached.path);
      if (size !== null) {
        cached.size = size; cached.lastUsed = now();
        if (fresh(url, cached)) { if (saved[url] === cached) persist(); return cached.path; }
        stale = cached.path;
      } else {
        if (saved[url] === cached) { delete saved[url]; persist(); }
        temporary.delete(url);
      }
    }
    try {
      const path = await download(url), size = await sizeOf(path);
      if (size === null) throw new Error("图片文件不可用");
      return await store(url, path, size);
    } catch {
      // Another completed download may have evicted this file during refresh.
      return stale && await sizeOf(stale) !== null ? stale : url;
    }
  }
  return { retain(url: string): () => void {
    if (!isMinioImageUrl(url)) return () => {};
    retained.set(url, (retained.get(url) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return; released = true;
      const count = retained.get(url) ?? 0;
      if (count <= 1) retained.delete(url); else retained.set(url, count - 1);
    };
  }, get(url: string): Promise<string> {
    if (!isMinioImageUrl(url)) return Promise.resolve(url);
    const existing = pending.get(url); if (existing) return existing;
    const task = load(url).finally(() => { if (pending.get(url) === task) pending.delete(url); });
    pending.set(url, task); return task;
  } };
}

let shared: ReturnType<typeof createMinioImageCache> | undefined;
export function canCacheMinioImages(): boolean {
  // #ifdef MP-WEIXIN
  if (typeof uni !== "undefined" && typeof uni.downloadFile === "function" && typeof uni.getFileSystemManager === "function") return true;
  // #endif
  return false;
}
export function resolveMinioImage(url: string): Promise<string> {
  // #ifdef MP-WEIXIN
  if (isMinioImageUrl(url) && canCacheMinioImages()) {
    shared ??= createMinioImageCache(); return shared.get(url);
  }
  // #endif
  // H5 and external/packaged images continue using their existing HTTP cache.
  return Promise.resolve(url);
}

/** Keep paths used by mounted native image components safe from LRU removal. */
export function retainMinioImage(url: string): () => void {
  // #ifdef MP-WEIXIN
  if (isMinioImageUrl(url) && canCacheMinioImages()) {
    shared ??= createMinioImageCache(); return shared.retain(url);
  }
  // #endif
  return () => {};
}
