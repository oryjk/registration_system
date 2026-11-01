const bunTest: any = await import("bun:test");
const { afterAll, afterEach, beforeEach, expect, test } = bunTest;
import { nextTick, ref } from "vue";
import { useHomeOnboardingTour } from "../useHomeOnboardingTour";
import { consumeHomeOnboardingTourRequest, markHomeOnboardingTourSeen, requestHomeOnboardingTour } from "@/utils/onboardingTourStorage";

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

function createFlow(overrides: { ready?: boolean; visible?: boolean; skip?: boolean; userId?: number | null; repeatWithoutTeam?: boolean } = {}) {
  const userId = ref<number | null>(overrides.userId === undefined ? 1 : overrides.userId);
  const ready = ref(overrides.ready ?? true);
  const pageVisible = ref(overrides.visible ?? true);
  const skipAutomatic = ref(overrides.skip ?? false);
  const errorMessage = ref("");
  const repeatWithoutTeam = ref(overrides.repeatWithoutTeam ?? false);
  const entryVersion = ref(0);
  flow = useHomeOnboardingTour({ userId, ready, pageVisible, skipAutomatic, errorMessage,
    ...(overrides.repeatWithoutTeam === undefined ? {} : { repeatWithoutTeam, entryVersion }),
  });
  return { flow, userId, ready, pageVisible, errorMessage, repeatWithoutTeam, entryVersion };
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

test("users without a team see the guide on each app entry even with an old seen record", async () => {
  markHomeOnboardingTourSeen(1);
  const state = createFlow({ repeatWithoutTeam: true });
  expect(state.flow.active.value).toBe(true);
  state.flow.finish();
  state.pageVisible.value = false;
  await nextTick();
  state.pageVisible.value = true;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
  state.entryVersion.value++;
  await nextTick();
  expect(state.flow.active.value).toBe(true);
  state.flow.finish();
  state.flow.dispose();
  expect(createFlow({ repeatWithoutTeam: true }).flow.active.value).toBe(true);
});

test("skip requires a choice and skipping once only lasts for the current app entry", async () => {
  const state = createFlow({ repeatWithoutTeam: true });
  state.flow.requestSkip();
  expect(state.flow.confirmingSkip.value).toBe(true);
  expect(state.flow.active.value).toBe(true);
  state.flow.cancelSkip();
  expect(state.flow.confirmingSkip.value).toBe(false);
  expect(state.flow.active.value).toBe(true);
  state.flow.requestSkip();
  state.flow.skipOnce();
  expect(state.flow.active.value).toBe(false);
  state.entryVersion.value++;
  await nextTick();
  expect(state.flow.active.value).toBe(true);
});

test("only confirmed permanent skipping persists and remains scoped to the current account", async () => {
  const state = createFlow({ repeatWithoutTeam: true });
  state.flow.skipPermanently();
  expect(state.flow.active.value).toBe(true);
  state.flow.requestSkip();
  state.flow.skipPermanently();
  expect(state.flow.active.value).toBe(false);
  state.entryVersion.value++;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
  state.flow.dispose();
  const reopened = createFlow({ repeatWithoutTeam: true });
  expect(reopened.flow.active.value).toBe(false);
  reopened.flow.requestReplay();
  await nextTick();
  expect(reopened.flow.active.value).toBe(true);
  reopened.flow.finish();
  reopened.entryVersion.value++;
  await nextTick();
  expect(reopened.flow.active.value).toBe(false);
  reopened.userId.value = 2;
  await nextTick();
  expect(reopened.flow.active.value).toBe(true);
});

test("users with a team keep one-time onboarding and confirmation closes when the page is hidden", async () => {
  const state = createFlow({ repeatWithoutTeam: false });
  state.flow.finish();
  state.entryVersion.value++;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
  state.repeatWithoutTeam.value = true;
  state.entryVersion.value++;
  await nextTick();
  expect(state.flow.active.value).toBe(true);
  state.flow.requestSkip();
  state.pageVisible.value = false;
  await nextTick();
  expect(state.flow.confirmingSkip.value).toBe(false);
  expect(state.flow.active.value).toBe(false);
});

test("a completed guide stops repeating after the user joins a team", async () => {
  const state = createFlow({ repeatWithoutTeam: true });
  state.flow.finish();
  state.repeatWithoutTeam.value = false;
  state.entryVersion.value++;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
});

test("app reentry waits for the new home refresh rather than consuming cached readiness", async () => {
  const state = createFlow({ repeatWithoutTeam: true });
  state.flow.finish();
  state.entryVersion.value++;
  state.ready.value = false;
  await nextTick();
  expect(state.flow.active.value).toBe(false);
  state.ready.value = true;
  await nextTick();
  expect(state.flow.active.value).toBe(true);
});

test("share-link deferral only applies to its app entry, not a later ordinary reentry", async () => {
  const state = createFlow({ repeatWithoutTeam: true, skip: true });
  expect(state.flow.active.value).toBe(false);
  state.entryVersion.value++;
  await nextTick();
  expect(state.flow.active.value).toBe(true);
});
