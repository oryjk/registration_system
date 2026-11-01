const bunTest: any = await import("bun:test");
const { afterAll, afterEach, beforeEach, expect, test } = bunTest;
import { nextTick, ref } from "vue";
import { useHomeOnboardingTour } from "../useHomeOnboardingTour";
import { consumeHomeOnboardingTourRequest, requestHomeOnboardingTour } from "@/utils/onboardingTourStorage";

const storage = new Map<string, unknown>();
const globals = globalThis as typeof globalThis & { uni: UniApp.Uni };
const originalUni = globals.uni;
let flow: ReturnType<typeof useHomeOnboardingTour> | undefined;

beforeEach(() => {
  storage.clear();
  consumeHomeOnboardingTourRequest();
  globals.uni = {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
  } as typeof uni;
});
afterEach(() => { flow?.dispose(); flow = undefined; globals.uni = originalUni; });
afterAll(() => { globals.uni = originalUni; });

function createFlow(overrides: { ready?: boolean; visible?: boolean; skip?: boolean; userId?: number | null } = {}) {
  const userId = ref<number | null>(overrides.userId === undefined ? 1 : overrides.userId);
  const ready = ref(overrides.ready ?? true);
  const pageVisible = ref(overrides.visible ?? true);
  const skipAutomatic = ref(overrides.skip ?? false);
  const errorMessage = ref("");
  flow = useHomeOnboardingTour({ userId, ready, pageVisible, skipAutomatic, errorMessage });
  return { flow, userId, ready, pageVisible, errorMessage };
}

test("waits for successful home loading and a visible page before starting", async () => {
  const state = createFlow({ ready: false, visible: false });
  expect(state.flow.active.value).toBe(false);
  state.ready.value = true;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
  state.pageVisible.value = true;
  await nextTick();
  expect(state.flow.active.value).toBe(true);
});

test("finishing or skipping prevents another automatic tour after reopening home", async () => {
  const state = createFlow();
  expect(state.flow.active.value).toBe(true);
  state.flow.finish();
  expect(state.flow.active.value).toBe(false);
  state.flow.dispose();
  const reopened = createFlow();
  expect(reopened.flow.active.value).toBe(false);
  reopened.flow.requestReplay();
  await nextTick();
  expect(reopened.flow.active.value).toBe(true);
});

test("completion records are isolated between accounts and guests", async () => {
  const state = createFlow();
  state.flow.finish();
  state.userId.value = 2;
  await nextTick();
  expect(state.flow.active.value).toBe(true);
  state.flow.finish();
  state.userId.value = null;
  await nextTick();
  expect(state.flow.active.value).toBe(true);
  state.flow.finish();
  state.userId.value = 1;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
});

test("a hidden or failed home removes the overlay without recording completion", async () => {
  const state = createFlow();
  state.pageVisible.value = false;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
  state.pageVisible.value = true;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
  state.flow.requestReplay();
  await nextTick();
  expect(state.flow.active.value).toBe(true);
  state.ready.value = false;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
  state.flow.dispose();
  expect(createFlow().flow.active.value).toBe(true);
});

test("shared home redirects skip automatic playback but allow explicit replay", async () => {
  const state = createFlow({ skip: true });
  expect(state.flow.active.value).toBe(false);
  state.flow.requestReplay();
  await nextTick();
  expect(state.flow.active.value).toBe(true);
});

test("help replay is consumed once and waits for loading to finish", async () => {
  requestHomeOnboardingTour();
  expect(consumeHomeOnboardingTourRequest()).toBe(true);
  expect(consumeHomeOnboardingTourRequest()).toBe(false);
  const state = createFlow({ ready: false, skip: true });
  state.flow.requestReplay();
  await nextTick();
  expect(state.flow.active.value).toBe(false);
  state.ready.value = true;
  await nextTick();
  expect(state.flow.active.value).toBe(true);
});

test("a target measurement failure stops playback without a retry loop or permanent dismissal", async () => {
  const state = createFlow();
  state.flow.stop();
  state.ready.value = false;
  await nextTick();
  state.ready.value = true;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
  state.flow.dispose();
  expect(createFlow().flow.active.value).toBe(true);
});

test("a replay waits through a cached home refresh failure until a successful retry", async () => {
  const state = createFlow({ ready: false, skip: true });
  state.flow.requestReplay();
  state.errorMessage.value = "首页数据加载失败";
  // 缓存内容仍在，刷新 finally 结束会恢复 ready；这不等于本次刷新成功。
  state.ready.value = true;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
  state.errorMessage.value = "";
  await nextTick();
  expect(state.flow.active.value).toBe(true);
});
