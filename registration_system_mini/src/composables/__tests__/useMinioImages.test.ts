import { expect, test } from "bun:test";
import { computed, effectScope, ref } from "vue";
import { useMinioImages } from "../useMinioImages";

const { afterEach }: any = await import("bun:test");
let previousUni: any;
afterEach(() => { (globalThis as any).uni = previousUni; });

const a = "https://oryjk.cn:82/registration/a.jpg", b = "https://oryjk.cn:82/registration/b.jpg";
function nativeRuntime() { previousUni = (globalThis as any).uni; (globalThis as any).uni = { downloadFile: () => {}, getFileSystemManager: () => ({}) }; }
test("first render waits for local path and repeated renders share the request", async () => {
  nativeRuntime(); let finish!: (path: string) => void; let requests = 0;
  const scope = effectScope(), image = scope.run(() => useMinioImages(() => { requests++; return new Promise(resolve => { finish = resolve; }); }))!;
  expect(image.minioImageSrc(a)).toEqual(""); expect(image.minioImageSrc(a)).toEqual(""); expect(requests).toEqual(1);
  finish("wxfile://saved/a.jpg"); await Promise.resolve();
  expect(image.minioImageSrc(a)).toEqual("wxfile://saved/a.jpg"); scope.stop();
});
test("late responses cannot replace a changed source", async () => {
  nativeRuntime(); const pending: Record<string, (path: string) => void> = {};
  const scope = effectScope(), src = ref(a);
  const current = scope.run(() => {
    const image = useMinioImages(url => new Promise(resolve => { pending[url] = resolve; }));
    return computed(() => image.minioImageSrc(src.value));
  })!;
  expect(current.value).toEqual(""); src.value = b; expect(current.value).toEqual("");
  pending[b]!("wxfile://b"); await Promise.resolve(); expect(current.value).toEqual("wxfile://b");
  pending[a]!("wxfile://a"); await Promise.resolve(); expect(current.value).toEqual("wxfile://b"); scope.stop();
});
test("unmounted image scopes ignore downloads that complete later", async () => {
  nativeRuntime(); let finish!: (path: string) => void;
  const scope = effectScope(), image = scope.run(() => useMinioImages(() => new Promise(resolve => { finish = resolve; })))!;
  image.minioImageSrc(a); scope.stop(); finish("wxfile://late"); await Promise.resolve();
  expect(image.minioImageSrc(a)).toEqual("");
});
test("mounted image paths retain one lease each and release them on unload", async () => {
  nativeRuntime(); const retained: string[] = [], released: string[] = [];
  const scope = effectScope(), image = scope.run(() => useMinioImages(async url => "local-" + url, url => {
    retained.push(url); return () => { released.push(url); };
  }))!;
  image.minioImageSrc(a); image.minioImageSrc(a); image.minioImageSrc(b);
  await Promise.resolve(); expect(retained).toEqual([a, b]);
  scope.stop(); expect(released).toEqual([a, b]);
  const other = a + "?new=1"; expect(image.minioImageSrc(other)).toEqual(other);
  expect(retained).toEqual([a, b]);
});
test("external and packaged sources retain immediate native rendering", () => {
  nativeRuntime(); let requests = 0; const image = useMinioImages(async src => { requests++; return src; });
  for (const src of ["/static/icon.png", "wxfile://local", "https://cdn.example.com/avatar.png"]) expect(image.minioImageSrc(src)).toEqual(src);
  expect(requests).toEqual(0);
});
