const bunTest: any = await import("bun:test");
const { afterAll, afterEach, expect, mock, test } = bunTest;
const { computed, nextTick, ref } = await import("vue");
import type { BackendUser } from "@/types/backend";

const currentUser = ref({ id: 1 } as BackendUser);
const teams = ref([{ id: 11 }]);
// Like appSession, rebuilding profiles on user change must not imply that
// the new user's getMyTeams request has already completed.
const teamProfiles = computed(() => currentUser.value ? teams.value.map((team) => ({
  ...team, userId: currentUser.value.id,
})) : []);
const storage = new Map<string, unknown>();
const globals = globalThis as typeof globalThis & { uni: UniApp.Uni };
const originalUni = globals.uni;
globals.uni = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
  removeStorageSync: (key: string) => { storage.delete(key); },
} as typeof uni;
mock.module("@/stores/teamContext", () => ({
  useTeamContext: () => ({ currentUser, teamProfiles }),
}));
mock.module("@/stores/miniReview", () => ({
  useMiniReviewStatus: () => ({ shouldHideCreationEntrances: ref(false) }),
  preloadMiniReviewStatus: async () => {},
}));
const { clearOnboardingIntent, getOnboardingIntent, setOnboardingIntent } = await import("@/utils/onboardingGuideStorage");
const { useHomeOnboardingGuide } = await import("../useHomeOnboardingGuide");
let guide: ReturnType<typeof useHomeOnboardingGuide> | undefined;

afterEach(() => {
  guide?.dispose();
  guide = undefined;
  storage.clear();
  currentUser.value = { id: 1 } as BackendUser;
  teams.value = [{ id: 11 }];
});
afterAll(() => { globals.uni = originalUni; });

function createGuide() {
  guide = useHomeOnboardingGuide();
  return guide;
}

test("switching accounts with equal team counts clears completed intent in memory before leaving", async () => {
  setOnboardingIntent(2, "captain");
  const flow = createGuide();
  currentUser.value = { id: 2 } as BackendUser;
  await nextTick();
  expect(flow.intent.value).toEqual("captain");

  // loadTeamContext clears the persisted intent before replacing the teams.
  clearOnboardingIntent(2);
  teams.value = [{ id: 22 }];
  await nextTick();
  expect(flow.intent.value).toEqual(null);

  teams.value = [];
  await nextTick();
  expect(flow.intent.value).toEqual(null);
});

test("previous account teams cannot clear a new account's uncompleted intent", async () => {
  setOnboardingIntent(2, "player");
  const flow = createGuide();
  currentUser.value = { id: 2 } as BackendUser;
  await nextTick();
  expect(getOnboardingIntent(2)).toEqual("player");

  teams.value = [];
  await nextTick();
  expect(flow.intent.value).toEqual("player");
  expect(getOnboardingIntent(2)).toEqual("player");
});

test("a user can collapse, restore, and change task without affecting another account", async () => {
  teams.value = [];
  const flow = createGuide();
  flow.setIntent("member");
  flow.collapse();
  expect(flow.collapsed.value).toEqual(true);
  currentUser.value = { id: 2 } as BackendUser;
  await nextTick();
  expect(flow.collapsed.value).toEqual(false);
  expect(flow.intent.value).toEqual(null);
  currentUser.value = { id: 1 } as BackendUser;
  await nextTick();
  expect(flow.collapsed.value).toEqual(true);
  expect(flow.intent.value).toEqual("member");
  flow.resetIntent();
  expect(flow.collapsed.value).toEqual(false);
  expect(flow.intent.value).toEqual(null);
  expect(getOnboardingIntent(1)).toEqual(null);
});
