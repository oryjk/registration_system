import { describe, expect, test } from "bun:test";
import { defaultMiniAppRuntimeConfig } from "@/config/runtimeConfigDefaults";
import type { MiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { createRuntimeConfigCycle } from "../homeRuntimeConfigCycle";
import { useHomeNextMatchSocialImage } from "../useHomeNextMatchSocialImage";

function configWithSocialImage(url: string): MiniAppRuntimeConfig {
  return {
    ...defaultMiniAppRuntimeConfig,
    home: { ...defaultMiniAppRuntimeConfig.home, next_match_social_image_url: url },
  };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });
  return { promise, resolve, reject };
}

// 缓存语义验证：runtime config 的共享只发生在「同一轮首页加载周期」内，
// reset 后允许重新请求（换图生效、失败重试），而不是 App 生命周期只请求一次。
describe("home runtime config cycle", () => {
  test("coalesces concurrent consumers within one load cycle into a single request", async () => {
    let calls = 0;
    const cycle = createRuntimeConfigCycle(async () => {
      calls += 1;
      return configWithSocialImage("https://cdn.example.com/a.png");
    });

    const [first, second] = await Promise.all([cycle.load(), cycle.load()]);
    expect(calls).toEqual(1);
    expect(first === second).toEqual(true);
    expect(first.home.next_match_social_image_url).toEqual("https://cdn.example.com/a.png");
  });

  test("reset starts a fresh request on the next cycle", async () => {
    let calls = 0;
    let url = "https://cdn.example.com/a.png";
    const cycle = createRuntimeConfigCycle(async () => {
      calls += 1;
      return configWithSocialImage(url);
    });

    await cycle.load();
    url = "https://cdn.example.com/b.png";
    cycle.reset();
    const next = await cycle.load();

    expect(calls).toEqual(2);
    expect(next.home.next_match_social_image_url).toEqual("https://cdn.example.com/b.png");
  });

  test("a failed cycle can be retried after reset", async () => {
    let calls = 0;
    let shouldFail = true;
    const cycle = createRuntimeConfigCycle(async () => {
      calls += 1;
      if (shouldFail) {
        throw new Error("network down");
      }
      return configWithSocialImage("https://cdn.example.com/ok.png");
    });

    let caught: unknown = null;
    await cycle.load().catch((error: unknown) => {
      caught = error;
    });
    expect(caught instanceof Error).toEqual(true);
    expect((caught as Error).message).toEqual("network down");

    shouldFail = false;
    cycle.reset();
    const retried = await cycle.load();
    expect(calls).toEqual(2);
    expect(retried.home.next_match_social_image_url).toEqual("https://cdn.example.com/ok.png");
  });

  test("ignores a stale previous-cycle response that resolves after the current cycle", async () => {
    const requestA = createDeferred<MiniAppRuntimeConfig>();
    const requestB = createDeferred<MiniAppRuntimeConfig>();
    let calls = 0;
    const cycle = createRuntimeConfigCycle(() => {
      calls += 1;
      return calls === 1 ? requestA.promise : requestB.promise;
    });

    const staleLoad = cycle.load();
    cycle.reset();
    const freshLoad = cycle.load();

    // B（新周期）先返回 NEW，A（旧周期）后返回 OLD。
    requestB.resolve(configWithSocialImage("https://cdn.example.com/new.png"));
    requestA.resolve(configWithSocialImage("https://cdn.example.com/old.png"));

    // 旧消费者也必须拿到新周期的结果，而不是旧值。
    expect((await staleLoad).home.next_match_social_image_url).toEqual("https://cdn.example.com/new.png");
    expect((await freshLoad).home.next_match_social_image_url).toEqual("https://cdn.example.com/new.png");
    // 当前周期已有 in-flight 结果时，stale 不允许再触发额外请求。
    expect(calls).toEqual(2);
  });

  test("a stale result with no active cycle resolves waiting consumers with one fresh fetch", async () => {
    const requestA = createDeferred<MiniAppRuntimeConfig>();
    const requestB = createDeferred<MiniAppRuntimeConfig>();
    let calls = 0;
    const cycle = createRuntimeConfigCycle(() => {
      calls += 1;
      return calls === 1 ? requestA.promise : requestB.promise;
    });

    const staleLoad = cycle.load();
    cycle.reset();
    // reset 后没有新的 load：旧消费者仍在等待，stale 检测应补一次（且仅一次）最新请求。
    requestA.resolve(configWithSocialImage("https://cdn.example.com/old.png"));
    requestB.resolve(configWithSocialImage("https://cdn.example.com/new.png"));

    expect((await staleLoad).home.next_match_social_image_url).toEqual("https://cdn.example.com/new.png");
    expect(calls).toEqual(2);
  });
});

describe("useHomeNextMatchSocialImage", () => {
  test("uses the loader result and picks up a new url after the cycle resets", async () => {
    let url = "https://cdn.example.com/a.png";
    const cycle = createRuntimeConfigCycle(async () => configWithSocialImage(url));
    const { nextMatchSocialImageUrl, ensureSocialImageLoaded } = useHomeNextMatchSocialImage({
      loadRuntimeConfig: cycle.load,
    });

    ensureSocialImageLoaded();
    await cycle.load();
    expect(nextMatchSocialImageUrl.value).toEqual("https://cdn.example.com/a.png");

    // 第二轮首页加载（reset 后）：管理员在后台换图，用户刷新首页能拿到新 URL。
    url = "https://cdn.example.com/b.png";
    cycle.reset();
    ensureSocialImageLoaded();
    await cycle.load();
    expect(nextMatchSocialImageUrl.value).toEqual("https://cdn.example.com/b.png");
  });

  test("late previous-cycle results cannot overwrite the latest social image", async () => {
    const requestA = createDeferred<MiniAppRuntimeConfig>();
    const requestB = createDeferred<MiniAppRuntimeConfig>();
    let calls = 0;
    const cycle = createRuntimeConfigCycle(() => {
      calls += 1;
      return calls === 1 ? requestA.promise : requestB.promise;
    });
    const { nextMatchSocialImageUrl, ensureSocialImageLoaded } = useHomeNextMatchSocialImage({
      loadRuntimeConfig: cycle.load,
    });

    // 周期 A：插画消费者开始等待（request A 在飞）。
    ensureSocialImageLoaded();
    const staleConsumer = cycle.load();
    // 用户刷新：进入周期 B，插画消费者再次等待（request B 在飞）。
    cycle.reset();
    ensureSocialImageLoaded();

    requestB.resolve(configWithSocialImage("https://cdn.example.com/new.png"));
    await cycle.load();
    expect(nextMatchSocialImageUrl.value).toEqual("https://cdn.example.com/new.png");

    // 旧周期 A 这时才返回 OLD：UI 必须仍然是 NEW。
    requestA.resolve(configWithSocialImage("https://cdn.example.com/old.png"));
    await staleConsumer;
    await Promise.resolve();
    expect(nextMatchSocialImageUrl.value).toEqual("https://cdn.example.com/new.png");
  });

  test("a late previous-cycle rejection leaves the current result untouched", async () => {
    const requestA = createDeferred<MiniAppRuntimeConfig>();
    const requestB = createDeferred<MiniAppRuntimeConfig>();
    let calls = 0;
    const cycle = createRuntimeConfigCycle(() => {
      calls += 1;
      return calls === 1 ? requestA.promise : requestB.promise;
    });
    const { nextMatchSocialImageUrl, ensureSocialImageLoaded } = useHomeNextMatchSocialImage({
      loadRuntimeConfig: cycle.load,
    });

    ensureSocialImageLoaded();
    const staleConsumer = cycle.load();
    cycle.reset();
    ensureSocialImageLoaded();

    requestB.resolve(configWithSocialImage("https://cdn.example.com/new.png"));
    await cycle.load();
    expect(nextMatchSocialImageUrl.value).toEqual("https://cdn.example.com/new.png");

    requestA.reject(new Error("late network failure"));
    await staleConsumer.catch(() => {});
    await Promise.resolve();
    expect(nextMatchSocialImageUrl.value).toEqual("https://cdn.example.com/new.png");
  });

  test("stays empty when the very first load fails", async () => {
    const cycle = createRuntimeConfigCycle(async () => {
      throw new Error("offline");
    });
    const { nextMatchSocialImageUrl, ensureSocialImageLoaded } = useHomeNextMatchSocialImage({
      loadRuntimeConfig: cycle.load,
    });

    ensureSocialImageLoaded();
    await cycle.load().catch(() => {});
    expect(nextMatchSocialImageUrl.value).toEqual("");
  });

  test("keeps the previous value silently when a later cycle fails", async () => {
    let shouldFail = false;
    const cycle = createRuntimeConfigCycle(async () => {
      if (shouldFail) {
        throw new Error("network down");
      }
      return configWithSocialImage("https://cdn.example.com/a.png");
    });
    const { nextMatchSocialImageUrl, ensureSocialImageLoaded } = useHomeNextMatchSocialImage({
      loadRuntimeConfig: cycle.load,
    });

    ensureSocialImageLoaded();
    await cycle.load();
    expect(nextMatchSocialImageUrl.value).toEqual("https://cdn.example.com/a.png");

    shouldFail = true;
    cycle.reset();
    ensureSocialImageLoaded();
    await cycle.load().catch(() => {});
    expect(nextMatchSocialImageUrl.value).toEqual("https://cdn.example.com/a.png");
  });
});
