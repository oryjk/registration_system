import { describe, expect, test } from "bun:test";
import { createTabBarMotion } from "../tabBarMotion";

describe("底栏跨页面滑块", () => {
  test("目标页面显示后播放，并在再次返回该页面时清除旧动效", () => {
    const motion = createTabBarMotion();
    const id = motion.prepare("home", "mine");
    expect(motion.active.value).toEqual(null);
    motion.show("mine");
    expect(motion.active.value).toEqual({ id, from: "home", to: "mine" });
    motion.show("mine");
    expect(motion.active.value).toEqual(null);
  });

  test("路由失败不会在后续进入时重播，旧请求失败也不取消新切换", () => {
    const motion = createTabBarMotion();
    const failed = motion.prepare("home", "challenge");
    motion.cancel(failed);
    motion.show("challenge");
    expect(motion.active.value).toEqual(null);
    const old = motion.prepare("challenge", "stats");
    const next = motion.prepare("challenge", "mine");
    motion.cancel(old);
    motion.show("mine");
    expect(motion.active.value).toEqual({ id: next, from: "challenge", to: "mine" });
  });

  test("从其他入口进入页面时不沿用未匹配的切换", () => {
    const motion = createTabBarMotion();
    motion.prepare("home", "mine");
    motion.show("stats");
    motion.show("mine");
    expect(motion.active.value).toEqual(null);
  });
});
