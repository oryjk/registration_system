import { describe, expect, test } from "bun:test";
import { createApiRouter } from "../apiRouter";

const primary = "https://oryjk.cn:18443/regist-v3/api/v1/app";
const backup = "https://backup.oryjk.cn:19443/regist-v3/api/v1/app";
const unavailable = new Error("gateway unavailable");
const isUnavailable = (error: unknown) => error === unavailable;

describe("App API failover", () => {
  test("a safe read switches to backup and checks primary again after the cooldown", async () => {
    let time = 0;
    let primaryUp = false;
    const calls: string[] = [];
    const router = createApiRouter(primary, backup, isUnavailable, () => time);
    const send = async (base: string) => {
      calls.push(base);
      if (base === primary && !primaryUp) throw unavailable;
      return base;
    };

    expect(await router.read(send)).toEqual(backup);
    expect(await router.read(send)).toEqual(backup);
    expect(calls).toEqual([primary, backup, backup]);

    primaryUp = true;
    time = 60_001;
    expect(await router.read(send)).toEqual(primary);
    expect(await router.read(send)).toEqual(primary);
    expect(calls.slice(-2)).toEqual([primary, primary]);
  });

  test("does not fail over for an application rejection", async () => {
    const rejection = new Error("unauthorized");
    const calls: string[] = [];
    const router = createApiRouter(primary, backup, isUnavailable);

    const outcome = await router.read(async (base) => {
      calls.push(base);
      throw rejection;
    }).catch((error) => error);
    expect(outcome === rejection).toEqual(true);
    expect(calls).toEqual([primary]);
  });

  test("selects a route with read-only probes before the first write and sends it once", async () => {
    const probes: string[] = [];
    const writes: string[] = [];
    const router = createApiRouter(primary, backup, isUnavailable);

    const outcome = await router.write(async (base) => {
      writes.push(base);
      throw unavailable;
    }, async (base) => {
      probes.push(base);
      if (base === primary) throw unavailable;
    }).catch((error) => error);

    expect(outcome === unavailable).toEqual(true);
    expect(probes).toEqual([primary, backup]);
    expect(writes).toEqual([backup]);
  });

  test("a known write never retries on the other host", async () => {
    const calls: string[] = [];
    const router = createApiRouter(primary, backup, isUnavailable);
    await router.read(async (base) => base);

    const outcome = await router.write(async (base) => {
      calls.push(base);
      throw unavailable;
    }, async () => { throw new Error("unexpected health probe"); }).catch((error) => error);

    expect(outcome === unavailable).toEqual(true);
    expect(calls).toEqual([primary]);
  });

  test("coalesces concurrent cold health checks", async () => {
    const probes: string[] = [];
    const router = createApiRouter(primary, backup, isUnavailable);
    const probe = async (base: string) => { probes.push(base); };
    const send = async (base: string) => base;

    expect(await Promise.all([router.write(send, probe), router.write(send, probe)])).toEqual([primary, primary]);
    expect(probes).toEqual([primary]);
  });
});
