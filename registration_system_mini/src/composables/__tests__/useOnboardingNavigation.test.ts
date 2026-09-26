const { afterAll, beforeEach, expect, mock, test }: any = await import("bun:test");
const { ref } = await import("vue");
const user = ref<{ id: number } | null>(null);
let refresh: () => Promise<void>;
let resumes = 0;
const events: string[] = [];
const routes: string[] = [];
const toasts: string[] = [];
let navigationFails = false;
let hideCount = 0;
const globals = globalThis as typeof globalThis & { uni: UniApp.Uni; getCurrentPages: typeof getCurrentPages };
const previousUni = globals.uni;
const previousPages = globals.getCurrentPages;
mock.module("@/stores/appSession", () => ({
  resumeSessionBootstrap: () => { resumes++; },
  useAppSession: () => ({ currentUser: user, refreshSessionContext: () => refresh() }),
}));
globals.uni = {
  showLoading: () => {},
  hideLoading: () => { hideCount++; },
  showToast: ({ title }: { title: string }) => { toasts.push(title); },
  $emit: (event: string) => { events.push(event); },
  navigateTo: ({ url, success, fail }: { url: string; success: () => void; fail: () => void }) => {
    if (navigationFails) fail(); else { routes.push(url); success(); }
  },
} as unknown as UniApp.Uni;
globals.getCurrentPages = (() => [{ route: "pages/user/help/index" }]) as typeof getCurrentPages;
const { useOnboardingNavigation } = await import("../useOnboardingNavigation");
beforeEach(() => {
  user.value = null;
  refresh = async () => { user.value = { id: 1 }; };
  resumes = 0;
  navigationFails = false;
  hideCount = 0;
  events.length = routes.length = toasts.length = 0;
});
afterAll(() => { globals.uni = previousUni; globals.getCurrentPages = previousPages; });

test("explicit guest action resumes a logged-out session and continues to its target", async () => {
  const action = useOnboardingNavigation();
  expect(await action.navigateTo("/pages/teams/join/index")).toBe(true);
  expect(resumes).toBe(1);
  expect(routes).toEqual(["/pages/teams/join/index"]);
  expect(events).toEqual(["session:login-completed"]);
  expect(hideCount).toBe(1);
  expect(action.busy.value).toBe(false);
});
test("H5 remaining guest neither navigates nor emits login completion", async () => {
  refresh = async () => {};
  const action = useOnboardingNavigation();
  expect(await action.navigateTo("/pages/teams/create/index")).toBe(false);
  expect(routes).toEqual([]);
  expect(events).toEqual([]);
  expect(toasts[0]).toContain("微信小程序");
  expect(action.busy.value).toBe(false);
});
test("authenticated users navigate without starting another login", async () => {
  user.value = { id: 1 };
  expect(await useOnboardingNavigation().navigateTo("/pages/teams/join/index")).toBe(true);
  expect(resumes).toBe(0);
  expect(events).toEqual([]);
});
test("duplicate taps are blocked during login and a login failure permits retry", async () => {
  let rejectLogin!: (error: Error) => void;
  refresh = () => new Promise((_resolve, reject) => { rejectLogin = reject; });
  const action = useOnboardingNavigation();
  const first = action.navigateTo("/pages/teams/join/index");
  expect(await action.navigateTo("/pages/teams/create/index")).toBe(false);
  rejectLogin(new Error("网络错误"));
  expect(await first).toBe(false);
  expect(hideCount).toBe(1);
  expect(action.busy.value).toBe(false);
  refresh = async () => { user.value = { id: 1 }; };
  expect(await action.navigateTo("/pages/teams/join/index")).toBe(true);
});
test("failed navigation reports failure and releases the busy state", async () => {
  user.value = { id: 1 };
  navigationFails = true;
  const action = useOnboardingNavigation();
  expect(await action.navigateTo("/pages/teams/join/index")).toBe(false);
  expect(action.busy.value).toBe(false);
  expect(toasts).toEqual(["页面打开失败，请重试"]);
});
export {};
