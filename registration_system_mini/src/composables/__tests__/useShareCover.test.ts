import { expect, test } from "bun:test";
import { effectScope } from "vue";
import { useShareCover } from "../useShareCover";
import { defaultMiniAppRuntimeConfig, type MiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { DEFAULT_SHARE_COVERS, resolveShareCover, type ShareCoverScene } from "@/utils/share";

function config(url: string): MiniAppRuntimeConfig {
  return { ...defaultMiniAppRuntimeConfig, home: { ...defaultMiniAppRuntimeConfig.home, share_team_image_url: url } };
}

test("each share scene has a synchronous fallback and reads only its own configured field", () => {
  for (const scene of ["home", "hall", "team", "match"] as ShareCoverScene[]) {
    expect(resolveShareCover(scene, {})).toEqual(DEFAULT_SHARE_COVERS[scene]);
    expect(resolveShareCover(scene, { [`share_${scene}_image_url`]: " https://cdn.example.com/new.png " })).toEqual("https://cdn.example.com/new.png");
    expect(resolveShareCover(scene, { [`share_${scene}_image_url`]: "" })).toEqual(DEFAULT_SHARE_COVERS[scene]);
    expect(resolveShareCover(scene, { [`share_${scene}_image_url`]: "javascript:alert(1)" })).toEqual(DEFAULT_SHARE_COVERS[scene]);
  }
});

test("clearing a configured cover restores the new default, and a late request cannot restore the old value", async () => {
  const pending: ((value: MiniAppRuntimeConfig) => void)[] = [];
  const cover = useShareCover("team", () => new Promise(resolve => { pending.push(resolve); }), async src => src);
  expect(cover.shareCoverUrl.value).toEqual(DEFAULT_SHARE_COVERS.team);
  const first = cover.refreshShareCover(); pending[0]!(config("https://cdn.example.com/a.png")); await first;
  expect(cover.shareCoverUrl.value).toEqual("https://cdn.example.com/a.png");
  const stale = cover.refreshShareCover(); const clear = cover.refreshShareCover();
  pending[2]!(config("")); await clear;
  pending[1]!(config("https://cdn.example.com/stale.png")); await stale;
  expect(cover.shareCoverUrl.value).toEqual(DEFAULT_SHARE_COVERS.team);
});

test("runtime failure leaves a usable cover without throwing in the page", async () => {
  const cover = useShareCover("match", async () => { throw new Error("offline"); }, async src => src);
  await cover.refreshShareCover();
  expect(cover.shareCoverUrl.value).toEqual(DEFAULT_SHARE_COVERS.match);
});

test("share callbacks receive the cached path while composition keeps the configured URL", async () => {
  const url = "https://oryjk.cn:82/registration/team.png";
  const cover = useShareCover("team", async () => config(url), async () => "wxfile://saved/team.png");
  await cover.refreshShareCover();
  expect(cover.shareCoverUrl.value).toEqual(url);
  expect(cover.shareImageUrl.value).toEqual("wxfile://saved/team.png");
});

test("a late cached image cannot replace a newer configured share cover", async () => {
  let url = "https://cdn.example.com/a.png";
  const pending: Record<string, (path: string) => void> = {};
  const cover = useShareCover("team", async () => config(url), src => new Promise(resolve => { pending[src] = resolve; }));
  const first = cover.refreshShareCover(); await Promise.resolve();
  url = "https://cdn.example.com/b.png";
  const second = cover.refreshShareCover(); await Promise.resolve();
  pending[url]!("wxfile://b"); await second;
  pending["https://cdn.example.com/a.png"]!("wxfile://a"); await first;
  expect(cover.shareImageUrl.value).toEqual("wxfile://b");
});
test("share cover leases change with configuration and are released on unload", async () => {
  const a = "https://oryjk.cn:82/registration/a.png", b = "https://oryjk.cn:82/registration/b.png";
  let url = a; const retained: string[] = [], released: string[] = [];
  const scope = effectScope(), cover = scope.run(() => useShareCover("team", async () => config(url), async src => src, src => {
    retained.push(src); return () => { released.push(src); };
  }))!;
  await cover.refreshShareCover(); await cover.refreshShareCover();
  expect(retained).toEqual([a]);
  url = b; await cover.refreshShareCover();
  expect(retained).toEqual([a, b]); expect(released).toEqual([a]);
  scope.stop(); expect(released).toEqual([a, b]);
});
