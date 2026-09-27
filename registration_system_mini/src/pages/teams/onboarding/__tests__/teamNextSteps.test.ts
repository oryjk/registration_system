export {};
// Bun 的 module mock 会跨测试文件共享；独立进程保护其他页面测试的依赖。
if (!(globalThis as any).process.env.ONBOARDING_TEAM_CASES) {
  const { test, expect }: any = await import("bun:test");
  test("team onboarding behavior in isolated module context", () => {
    const runtime = (globalThis as any).Bun;
    const proc = (globalThis as any).process;
    const result = runtime.spawnSync({
      cmd: [proc.execPath, "test", decodeURIComponent(new URL(import.meta.url).pathname)],
      env: { ...proc.env, ONBOARDING_TEAM_CASES: "1" },
      stdout: "pipe", stderr: "pipe",
    });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    expect(result.exitCode).toBe(0);
  });
} else {
const { describe, test, expect, mock, beforeEach } = await import("bun:test") as any;
const { ref, nextTick } = await import("vue");
const user = ref<{ id: number } | null>({ id: 1 });
let manualLogout = false;
const currentTeam = ref<{ id: number } | null>(null);
const myTeams = ref<{ id: number }[]>([]);
const hide = ref(false);
let refreshFails = false;
let switchWorks = true;
let createCalls = 0;
let joinCalls = 0;
let gate: () => Promise<boolean> = async () => true;
let passwordCheck: (id: number) => Promise<boolean> = async () => false;
const urls: string[] = [];
const toasts: string[] = [];
let load: ((options: any) => void) | undefined;
mock.module("@/utils/authStorage", () => ({ hasManualLogout: () => manualLogout }));
mock.module("@dcloudio/uni-app", () => ({ onLoad: (fn: any) => { load = fn; }, onShow: () => {} }));
mock.module("@/composables/usePageRefresh", () => ({ usePageRefresh: () => {} }));
mock.module("@/utils/customNav", () => ({ getCustomNavMetrics: () => ({ pageTopPadding: 0 }) }));
mock.module("@/stores/teamContext", () => ({ useTeamContext: () => ({
  currentUser: user, currentTeam, myTeams, ensureSessionReady: async () => { if (!refreshFails && !manualLogout && !user.value) user.value = { id: 1 }; },
  refreshSessionContext: async () => { if (refreshFails) { user.value = null; await nextTick(); throw new Error("offline"); } },
  switchTeam: (id: number) => { if (switchWorks) currentTeam.value = { id }; },
}) }));
mock.module("@/stores/miniReview", () => ({ preloadMiniReviewStatus: async () => {}, useMiniReviewStatus: () => ({ reviewMode: ref(false), shouldHideCreationEntrances: hide }) }));
mock.module("../../teamSelfActions", () => ({
  createTeamFromForm: async () => { createCalls++; return { id: 42 }; },
  joinTeamFromForm: async () => { joinCalls++; },
  searchTeamsByKeyword: async () => [],
  checkTeamRequiresPassword: (id: number) => passwordCheck(id),
}));
mock.module("../../useProfileCompletionGate", () => ({ useProfileCompletionGate: () => ({
  ensureProfileComplete: () => gate(), profileGateVisible: ref(false), handleProfileGateCancel: () => {}, handleProfileGateCompleted: () => {},
}) }));
mock.module("@/api/team", () => ({
  uploadTeamLogo: async () => {},
  joinTeam: async () => { joinCalls++; },
  resolveTeamInviteCode: async () => ({ team_id: 42, name: "新球队", is_member: false, requires_password: false }),
}));
(globalThis as any).uni = {
  showToast: ({ title }: any) => toasts.push(title),
  navigateTo: async ({ url }: any) => { urls.push(url); },
  redirectTo: ({ url }: any) => urls.push(url),
  switchTab: ({ url }: any) => urls.push(url),
};
const { useTeamCreatePage } = await import("../../create/useTeamCreatePage");
const { useTeamJoinPage } = await import("../../join/useTeamJoinPage");
const { useTeamInvitePage } = await import("../../invite/useTeamInvitePage");
beforeEach(async () => {
  manualLogout = false; user.value = { id: 1 }; await nextTick();
  switchWorks = true; refreshFails = false; hide.value = false; createCalls = 0; joinCalls = 0;
  myTeams.value = []; currentTeam.value = null; urls.length = 0; toasts.length = 0;
  gate = async () => true; passwordCheck = async () => false;
});
describe("球队成功后的下一步", () => {
  test("创建成功即锁定表单，刷新失败不误报失败、不重复建队", async () => {
    const page = useTeamCreatePage(); page.createForm.name = "新球队"; refreshFails = true;
    await page.handleCreateTeam(); await page.handleCreateTeam();
    expect(createCalls).toBe(1); expect(page.createdTeamId.value).toBe(42);
    expect(toasts.some(t => t.includes("创建球队失败"))).toBe(false);
    await page.goInviteTeam(); expect(urls).toHaveLength(0);
    await page.goArrangeMatch(); expect(urls).toHaveLength(0);
    refreshFails = false; await page.goInviteTeam();
    expect(urls.at(-1)).toBe("/pages/teams/detail/index?teamId=42");
    await page.goArrangeMatch();
    expect(currentTeam.value?.id).toBe(42); expect(urls.at(-1)).toBe("/pages/matches/create/index");
  });
  test("会话临时丢失后的成功记录不会泄露给新账号，主动退出会清理", async () => {
    const create = useTeamCreatePage(); create.createForm.name = "新球队"; refreshFails = true;
    await create.handleCreateTeam(); expect(create.createdTeamId.value).toBe(42);
    user.value = { id: 2 }; await nextTick(); expect(create.createdTeamId.value).toBe(null);
    await create.goInviteTeam(); expect(urls).toHaveLength(0);
    refreshFails = false;
    const join = useTeamJoinPage(); await join.handleSelectTeam({ id: 42 } as any); await join.handleJoinTeam();
    manualLogout = true; user.value = null; await nextTick(); expect(join.joinedTeam.value).toBe(null);
  });
  test("审核隐藏时不导航到创建比赛", async () => {
    const page = useTeamCreatePage(); page.createForm.name = "新球队"; await page.handleCreateTeam();
    hide.value = true; await page.goArrangeMatch(); expect(urls).toHaveLength(0);
  });
  test("新球队未进入上下文时不使用旧球队安排比赛", async () => {
    const page = useTeamCreatePage(); page.createForm.name = "新球队"; await page.handleCreateTeam();
    currentTeam.value = { id: 7 }; switchWorks = false;
    await page.goArrangeMatch(); expect(urls).toHaveLength(0);
    expect(currentTeam.value?.id).toBe(7);
  });
  test("搜索加入在资料 gate 前锁定提交，刷新失败保留成功", async () => {
    const page = useTeamJoinPage(); await page.handleSelectTeam({ id: 42 } as any);
    let finish!: (value: boolean) => void; gate = () => new Promise(resolve => { finish = resolve; });
    const pending = page.handleJoinTeam(); await page.handleJoinTeam();
    expect(page.submitting.value).toBe(true); refreshFails = true; finish(true); await pending;
    expect(joinCalls).toBe(1); expect(page.joinedTeam.value?.id).toBe(42);
    await page.handleJoinTeam(); expect(joinCalls).toBe(1);
    await page.goJoinedTeam(); expect(urls).toHaveLength(0);
    refreshFails = false; await page.goJoinedTeam();
    expect(urls.at(-1)).toBe("/pages/teams/detail/index?teamId=42");
  });
  test("密码结果未返回时不能提交，切换选择后忽略旧密码结果", async () => {
    const page = useTeamJoinPage(); let finish!: (value: boolean) => void;
    passwordCheck = () => new Promise(resolve => { finish = resolve; });
    const pending = page.handleSelectTeam({ id: 42 } as any);
    await page.handleJoinTeam(); expect(joinCalls).toBe(0);
    myTeams.value = [{ id: 9 }]; await page.handleSelectTeam({ id: 9 } as any);
    finish(true); await pending; expect(page.selectedTeamRequiresPassword.value).toBe(false);
    await page.handleJoinTeam(); expect(urls.at(-1)).toBe("/pages/teams/detail/index?teamId=9");
  });
  test("资料补全等待期间换账号不继续原加入", async () => {
    const page = useTeamJoinPage(); await page.handleSelectTeam({ id: 42 } as any);
    let finish!: (value: boolean) => void; gate = () => new Promise(resolve => { finish = resolve; });
    const pending = page.handleJoinTeam(); user.value = { id: 2 }; await nextTick(); finish(true); await pending;
    expect(joinCalls).toBe(0); expect(page.joinedTeam.value).toBe(null);
  });
  test("邀请直接加入，刷新失败仍成功且不能重复加入", async () => {
    const page = useTeamInvitePage(); load?.({ code: "invite" }); await page.resolveInvite();
    refreshFails = true; await page.handleJoin(); await page.handleJoin();
    expect(joinCalls).toBe(1); expect(page.joined.value).toBe(true);
    await page.goTeamDetail(); expect(urls).toHaveLength(0);
    refreshFails = false; await page.goTeamDetail(); expect(urls.at(-1)).toBe("/pages/teams/detail/index?teamId=42");
    await page.goFindMatches(); expect(urls.at(-1)).toBe("/pages/activities/index");
    user.value = { id: 2 }; await nextTick(); expect(page.joined.value).toBe(false);
  });
  test("会话已为空后主动退出也不能通过下一步恢复旧操作", async () => {
    const page = useTeamCreatePage(); page.createForm.name = "新球队"; refreshFails = true;
    await page.handleCreateTeam(); expect(user.value).toBe(null);
    manualLogout = true; refreshFails = false;
    await page.goInviteTeam(); expect(page.createdTeamId.value).toBe(null);
    expect(user.value).toBe(null); expect(urls).toHaveLength(0);
  });
});

}
