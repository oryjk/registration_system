import { expect, test } from "bun:test";
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
  const cover = useShareCover("team", () => new Promise(resolve => { pending.push(resolve); }));
  expect(cover.shareCoverUrl.value).toEqual(DEFAULT_SHARE_COVERS.team);
  const first = cover.refreshShareCover(); pending[0]!(config("https://cdn.example.com/a.png")); await first;
  expect(cover.shareCoverUrl.value).toEqual("https://cdn.example.com/a.png");
  const stale = cover.refreshShareCover(); const clear = cover.refreshShareCover();
  pending[2]!(config("")); await clear;
  pending[1]!(config("https://cdn.example.com/stale.png")); await stale;
  expect(cover.shareCoverUrl.value).toEqual(DEFAULT_SHARE_COVERS.team);
});

test("runtime failure leaves a usable cover without throwing in the page", async () => {
  const cover = useShareCover("match", async () => { throw new Error("offline"); });
  await cover.refreshShareCover();
  expect(cover.shareCoverUrl.value).toEqual(DEFAULT_SHARE_COVERS.match);
});
