import { expect, test } from "bun:test";
import { composeTeamInviteShareImage } from "../shareCompose";

test("team share composition downloads the configured cover and draws the badge on it", async () => {
  const previous = (globalThis as any).uni;
  const downloads: string[] = [];
  const draws: unknown[][] = [];
  const context = new Proxy({ drawImage: (...args: unknown[]) => { draws.push(args); } }, {
    get: (target, key) => (target as any)[key] || (() => {}),
    set: () => true,
  });
  const canvas = {
    width: 0, height: 0,
    getContext: () => context,
    createImage: () => {
      const img: any = { width: 1000, height: 800, onload: null };
      Object.defineProperty(img, "src", { set: () => { img.onload(); } });
      return img;
    },
    toTempFilePath: ({ success }: any) => success({ tempFilePath: "/tmp/composed.jpg" }),
  };
  const query: any = { in: () => query, select: () => query, fields: () => {}, exec: (fn: any) => fn([{ node: canvas }]) };
  (globalThis as any).uni = {
    createSelectorQuery: () => query,
    getImageInfo: ({ src, success }: any) => { downloads.push(src); success({ path: src }); },
  };
  try {
    expect(await composeTeamInviteShareImage("share", {}, "https://cdn.example.com/logo.png", "https://cdn.example.com/custom.png")).toEqual("/tmp/composed.jpg");
    expect(downloads).toEqual(["https://cdn.example.com/custom.png", "https://cdn.example.com/logo.png"]);
    expect(draws.length).toEqual(2);
    expect([canvas.width, canvas.height]).toEqual([1000, 800]);
    draws.length = 0;
    let cancelled = false;
    try {
      await composeTeamInviteShareImage("share", {}, "https://cdn.example.com/logo.png", "https://cdn.example.com/stale.png", () => false);
    } catch { cancelled = true; }
    expect(cancelled).toEqual(true);
    expect(draws.length).toEqual(0);
  } finally { (globalThis as any).uni = previous; }
});
