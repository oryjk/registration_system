const bunTest: any = await import("bun:test");
const { describe, expect, mock, test } = bunTest;
const { computed, ref } = await import("vue");
import type { BackendTeamMember, BackendUser } from "@/types/backend";

// 行为级验证（B3 返工）：资料更新 / 搜索用户 / 添加成员三条管理流程，
// 通过真实 teamManageActions 层打到被 mock 的 API 边界，校验请求负载与页面状态流转。

type Recorder = ((...args: any[]) => Promise<any>) & {
  calls: any[][];
  impl: ((...args: any[]) => any) | undefined;
};

function recorder(impl?: (...args: unknown[]) => unknown): Recorder {
  const calls: any[][] = [];
  const fn = Object.assign(
    async (...args: any[]) => {
      calls.push(args);
      return fn.impl?.(...args);
    },
    { calls, impl },
  );
  return fn;
}

const updateTeamMock = recorder(async () => ({ id: 7 }));
const updateTeamJoinPasswordMock = recorder(async () => undefined);
const updateTeamMemberMock = recorder(async () => undefined);
const updateTeamMemberPaidMembershipMock = recorder(async () => undefined);
const rechargeTeamMemberFundMock = recorder(async () => ({
  balance_cents: 3000,
  transaction_id: 11,
}));
const consumeTeamMemberFundMock = recorder(async () => ({
  balance_cents: -1000,
  transaction_id: 12,
}));
const addTeamMemberMock = recorder(async () => ({ ok: true }));
const searchUsersMock = recorder(async () => [] as BackendUser[]);

mock.module("@/api/team", () => ({
  addTeamMember: addTeamMemberMock,
  consumeTeamMemberFund: consumeTeamMemberFundMock,
  createTeam: async () => ({ id: 7 }),
  deleteTeam: async () => undefined,
  getTeamDissolveBlockers: async () => ({ matches: [], applications: [] }),
  getTeamMatchAttendance: async () => null,
  getTeamMemberAttendance: async () => null,
  getTeamPasswordInfo: async () => ({ team_id: 7, requires_password: true }),
  joinTeam: async () => undefined,
  rechargeTeamMemberFund: rechargeTeamMemberFundMock,
  removeTeamMember: async () => undefined,
  searchTeams: async () => [],
  setTeamMemberActive: async () => undefined,
  updateTeam: updateTeamMock,
  updateTeamJoinPassword: updateTeamJoinPasswordMock,
  updateTeamMember: updateTeamMemberMock,
  updateTeamMemberPaidMembership: updateTeamMemberPaidMembershipMock,
  uploadTeamLogo: async () => "logo.png",
}));
mock.module("@/api/user", () => ({
  listUsers: async () => [] as BackendUser[],
  searchUsers: searchUsersMock,
}));

const toastTitles: string[] = [];
(globalThis as { uni?: unknown }).uni = {
  showToast: (options: { title: string }) => toastTitles.push(options.title),
};

const { useTeamProfile } = await import("../useTeamProfile");
const { useTeamJoinPassword } = await import("../useTeamJoinPassword");
const { useTeamMembership } = await import("../useTeamMembership");

const team = { id: 7, name: "银河联队", canManageTeam: true };

interface MembershipOptions {
  /** 当前登录用户：用于自降级等涉及操作者自身的场景。 */
  currentUser?: BackendUser | null;
  /** refreshSessionContext 后是否收回管理权限（模拟角色降级生效）。 */
  demoteOnRefresh?: boolean;
}

function buildMembership(initial: BackendTeamMember[] = [], options: MembershipOptions = {}) {
  const submitting = ref(false);
  const usersById = ref<Record<number, BackendUser>>({});
  // 名单是响应式的：测试可以真实推进服务端状态（例如编辑期间发生新充值）。
  const membersRef = ref<BackendTeamMember[]>(initial);
  const manageFlag = ref(true);
  const refreshTeamDetail = recorder(async () => undefined);
  const refreshSessionContext = recorder(async () => {
    if (options.demoteOnRefresh) manageFlag.value = false;
  });
  const invalidateActivityAttendance = recorder(() => undefined);
  const membership = useTeamMembership({
    currentTeam: computed(() => ({ ...team, canManageTeam: manageFlag.value }) as never),
    currentUser: ref(options.currentUser ?? null),
    currentMembers: computed(() => membersRef.value),
    usersById,
    submitting,
    refreshSessionContext,
    refreshTeamDetail,
    invalidateActivityAttendance,
  });
  return {
    membership, membersRef, manageFlag, usersById,
    refreshTeamDetail, refreshSessionContext, invalidateActivityAttendance,
  };
}

describe("team manage flows (profile / search / add member)", () => {
  test("saving the team profile sends trimmed snake_case payload and re-syncs the form", async () => {
    const submitting = ref(false);
    const refreshSessionContext = recorder(async () => undefined);
    const profile = useTeamProfile({
      currentTeam: computed(() => team as never),
      submitting,
      refreshSessionContext,
    });

    profile.teamProfileForm.name = "  新队名  ";
    profile.teamProfileForm.description = "  周末固定局  ";
    profile.teamProfileForm.logoUrl = "";

    await profile.handleUpdateTeamProfile();

    expect(updateTeamMock.calls.length).toEqual(1);
    expect(updateTeamMock.calls[0][0]).toEqual(7);
    expect(updateTeamMock.calls[0][1]).toEqual({
      name: "新队名",
      description: "周末固定局",
      logo_url: null,
    });
    expect(refreshSessionContext.calls.length).toEqual(1);
    expect(toastTitles.at(-1)).toEqual("球队资料已保存");
    expect(submitting.value).toEqual(false);
  });

  test("saving a changed join password normalizes surrounding whitespace before the API call", async () => {
    const submitting = ref(false);
    const passwordPanel = useTeamJoinPassword({
      currentTeam: computed(() => team as never),
      submitting,
    });
    passwordPanel.joinPasswordForm.password = "  pass123  ";

    const callsBefore = updateTeamJoinPasswordMock.calls.length;
    await passwordPanel.handleUpdateJoinPassword();

    expect(updateTeamJoinPasswordMock.calls.length).toEqual(callsBefore + 1);
    expect(updateTeamJoinPasswordMock.calls.at(-1)).toEqual([7, "pass123"]);
    expect(submitting.value).toEqual(false);
  });

  test("profile save is blocked without a team name and never reaches the API", async () => {
    const profile = useTeamProfile({
      currentTeam: computed(() => team as never),
      submitting: ref(false),
      refreshSessionContext: recorder(async () => undefined),
    });
    profile.teamProfileForm.name = "   ";

    const callsBefore = updateTeamMock.calls.length;
    await profile.handleUpdateTeamProfile();

    expect(updateTeamMock.calls.length).toEqual(callsBefore);
    expect(toastTitles.at(-1)).toEqual("请先补全球队名称");
  });

  test("searching users stores results, merges usersById and resets the searching flag", async () => {
    const candidates: BackendUser[] = [
      { id: 42, nickname: "阿洪", real_name: "", avatar_url: "", open_id: "", username: "", phone_number: "", is_manager: false, is_venue: false } as BackendUser,
      { id: 43, nickname: "阿伟", real_name: "", avatar_url: "", open_id: "", username: "", phone_number: "", is_manager: false, is_venue: false } as BackendUser,
    ];
    searchUsersMock.impl = async () => candidates;

    const { membership, usersById } = buildMembership();
    membership.userSearchKeyword.value = "阿";

    await membership.handleSearchUsers();

    expect(searchUsersMock.calls.at(-1)).toEqual(["阿", 8]);
    expect(membership.userSearchResults.value.map((user) => user.id)).toEqual([42, 43]);
    expect(usersById.value[42]?.nickname).toEqual("阿洪");
    expect(membership.userSearching.value).toEqual(false);
  });

  test("empty keyword is rejected before hitting the user search API", async () => {
    const { membership } = buildMembership();
    membership.userSearchKeyword.value = "   ";
    const callsBefore = searchUsersMock.calls.length;

    await membership.handleSearchUsers();

    expect(searchUsersMock.calls.length).toEqual(callsBefore);
    expect(toastTitles.at(-1)).toEqual("请输入昵称或姓名");
  });

  test("tapping a candidate then adding sends the member payload and refreshes the roster", async () => {
    const { membership, refreshTeamDetail, invalidateActivityAttendance } = buildMembership();
    const candidate: BackendUser = { id: 42, nickname: "阿洪", real_name: "", avatar_url: "", open_id: "", username: "", phone_number: "", is_manager: false, is_venue: false } as BackendUser;

    await membership.handleCandidateTap(candidate);
    expect(membership.memberForm.userId).toEqual("42");
    expect(membership.selectedCandidate.value?.id).toEqual(42);

    await membership.handleAddMember();

    expect(addTeamMemberMock.calls.length).toEqual(1);
    expect(addTeamMemberMock.calls[0]).toEqual([7, { user_id: 42, role: "member" }]);
    // 成员变更后必须重拉球队详情并失效出勤缓存，否则列表一直显示旧名单。
    expect(refreshTeamDetail.calls[0][0]).toEqual(7);
    expect(invalidateActivityAttendance.calls.length).toEqual(1);
    expect(membership.memberForm.userId).toEqual("");
    expect(membership.userSearchResults.value).toEqual([]);
    expect(toastTitles.at(-1)).toEqual("队员已添加");
  });

  test("editing a member submits role and paid flag only; balance is never set here", async () => {
    const member = {
      user_id: 50,
      role: "member",
      is_member: true,
      is_paid_member: false,
      balance_cents: 1200,
      last_recharge_at: null,
      joined_at: "2026-09-01T00:00:00Z",
      status: 1,
      nickname: "阿五",
      avatar_url: null,
      real_name: null,
    } satisfies BackendTeamMember;
    const { membership, refreshTeamDetail } = buildMembership([member]);
    membership.handleEditMember(member);
    membership.editMemberForm.isPaidMember = true;

    const roleCallsBefore = updateTeamMemberMock.calls.length;
    const paidCallsBefore = updateTeamMemberPaidMembershipMock.calls.length;
    await membership.handleUpdateMember();

    expect(updateTeamMemberMock.calls.length).toEqual(roleCallsBefore + 1);
    expect(updateTeamMemberMock.calls.at(-1)).toEqual([7, 50, { role: "member" }]);
    expect(updateTeamMemberPaidMembershipMock.calls.length).toEqual(paidCallsBefore + 1);
    // 只提交付费会员标记：余额与充值时间只能由充值/消费动作改变。
    expect(updateTeamMemberPaidMembershipMock.calls.at(-1)).toEqual([
      7,
      50,
      { is_paid_member: true },
    ]);
    expect(refreshTeamDetail.calls.at(-1)?.[0]).toEqual(7);
    expect(toastTitles.at(-1)).toEqual("队员已更新");
  });

  test("a recharge landing while the popup is open is never overwritten by the save", async () => {
    const member = {
      user_id: 51,
      role: "member",
      is_member: true,
      is_paid_member: false,
      balance_cents: 15000,
      // 带毫秒的真实服务端时间：表单不展示、也不得因保存而回写截断到分钟的值。
      last_recharge_at: "2026-09-18T10:00:23.456Z",
      joined_at: "2026-09-01T00:00:00Z",
      status: 1,
      nickname: "阿六",
      avatar_url: null,
      real_name: null,
    } satisfies BackendTeamMember;
    const { membership, membersRef } = buildMembership([member]);
    membership.handleEditMember(member);

    // 编辑期间真实发生一笔充值：名单（服务端状态）推进到新余额与新充值时间。
    membersRef.value = [
      {
        ...member,
        balance_cents: 20000,
        is_paid_member: true,
        last_recharge_at: "2026-09-19T12:34:56.789Z",
      },
    ];
    membership.editMemberForm.role = "leader";

    const roleCallsBefore = updateTeamMemberMock.calls.length;
    const paidCallsBefore = updateTeamMemberPaidMembershipMock.calls.length;
    const rechargeCallsBefore = rechargeTeamMemberFundMock.calls.length;
    const consumeCallsBefore = consumeTeamMemberFundMock.calls.length;
    await membership.handleUpdateMember();

    expect(updateTeamMemberMock.calls.length).toEqual(roleCallsBefore + 1);
    // 仅改角色：不提交任何财务请求，服务端的最新充值时间与余额原样保留。
    expect(updateTeamMemberPaidMembershipMock.calls.length).toEqual(paidCallsBefore);
    expect(rechargeTeamMemberFundMock.calls.length).toEqual(rechargeCallsBefore);
    expect(consumeTeamMemberFundMock.calls.length).toEqual(consumeCallsBefore);
    expect(toastTitles.at(-1)).toEqual("队员已更新");
    expect(membersRef.value[0]?.last_recharge_at).toEqual("2026-09-19T12:34:56.789Z");
  });

  test("switching or cancelling the edit target is blocked while a save is in flight", async () => {
    const memberA = {
      user_id: 50, role: "member", is_member: true, is_paid_member: false,
      balance_cents: 5000, last_recharge_at: null, joined_at: "2026-09-01T00:00:00Z",
      status: 1, nickname: "阿五", avatar_url: null, real_name: null,
    } satisfies BackendTeamMember;
    const memberB = {
      user_id: 51, role: "member", is_member: true, is_paid_member: true,
      balance_cents: 20000, last_recharge_at: null, joined_at: "2026-09-01T00:00:00Z",
      status: 1, nickname: "阿六", avatar_url: null, real_name: null,
    } satisfies BackendTeamMember;
    const { membership } = buildMembership([memberA, memberB]);
    membership.handleEditMember(memberA);
    membership.editMemberForm.isPaidMember = true;

    // 角色请求挂起期间，尝试取消并打开 B。
    let resolveRoleRequest: (() => void) | undefined;
    const originalImpl = updateTeamMemberMock.impl;
    updateTeamMemberMock.impl = () =>
      new Promise<void>((resolve) => {
        resolveRoleRequest = () => resolve();
      });
    try {
      const savePromise = membership.handleUpdateMember();
      await Promise.resolve();

      membership.closeEditMemberPopup();
      membership.handleEditMember(memberB);
      expect(membership.editingMember.value?.user_id).toEqual(50);
      expect(membership.editMemberPopupVisible.value).toEqual(true);

      resolveRoleRequest?.();
      await savePromise;
    } finally {
      updateTeamMemberMock.impl = originalImpl;
    }

    // 付费标记请求必须仍指向 A（保存开始时固定目标与参数）。
    const paidCall = updateTeamMemberPaidMembershipMock.calls.at(-1);
    expect(paidCall?.[1]).toEqual(50);
    expect(paidCall?.[2]).toEqual({ is_paid_member: true });
  });

  test("fund recharge submits integer cents with an idempotency key and refreshes roster", async () => {
    const member = {
      user_id: 52, role: "member", is_member: true, is_paid_member: false,
      balance_cents: 5000, last_recharge_at: null, joined_at: "2026-09-01T00:00:00Z",
      status: 1, nickname: "阿七", avatar_url: null, real_name: null,
    } satisfies BackendTeamMember;
    const { membership, refreshTeamDetail } = buildMembership([member]);
    membership.handleEditMember(member);
    membership.handleOpenFundAction("recharge");
    membership.fundActionForm.amountYuan = " 88.50 ";
    membership.fundActionForm.note = " 线下现金 ";

    const callsBefore = rechargeTeamMemberFundMock.calls.length;
    await membership.handleSubmitFundAction();

    const call = rechargeTeamMemberFundMock.calls.at(-1);
    expect(rechargeTeamMemberFundMock.calls.length).toEqual(callsBefore + 1);
    expect(call?.[0]).toEqual(7);
    expect(call?.[1]).toEqual(52);
    // 金额以整数分提交，备注去空白，幂等键必带。
    expect(call?.[2]).toMatchObject({ amount_cents: 8850, note: "线下现金" });
    expect(typeof call?.[2]?.idempotency_key).toEqual("string");
    expect(call?.[2]?.idempotency_key.length).toBeGreaterThan(0);
    expect(refreshTeamDetail.calls.at(-1)?.[0]).toEqual(7);
    expect(membership.fundActionMode.value).toEqual(null);
    expect(toastTitles.at(-1)).toEqual("已提交，当前余额 ¥30.00");
  });

  test("failed fund action keeps the idempotency key so retry records once", async () => {
    const member = {
      user_id: 53, role: "member", is_member: true, is_paid_member: true,
      balance_cents: 0, last_recharge_at: null, joined_at: "2026-09-01T00:00:00Z",
      status: 1, nickname: "阿八", avatar_url: null, real_name: null,
    } satisfies BackendTeamMember;
    const { membership } = buildMembership([member]);
    membership.handleEditMember(member);
    membership.handleOpenFundAction("consume");
    membership.fundActionForm.amountYuan = "10";
    membership.fundActionForm.note = "场地分摊";

    const originalImpl = consumeTeamMemberFundMock.impl;
    consumeTeamMemberFundMock.impl = async () => {
      throw new Error("network down");
    };
    await membership.handleSubmitFundAction();
    const failedKey = consumeTeamMemberFundMock.calls.at(-1)?.[2]?.idempotency_key;
    expect(membership.fundActionMode.value).toEqual("consume");

    // 失败后重试沿用同一幂等键：后端同一键只记一笔。
    consumeTeamMemberFundMock.impl = originalImpl;
    await membership.handleSubmitFundAction();
    expect(consumeTeamMemberFundMock.calls.at(-1)?.[2]?.idempotency_key).toEqual(failedKey);
    expect(consumeTeamMemberFundMock.calls.at(-1)?.[2]).toMatchObject({
      amount_cents: 1000,
      note: "场地分摊",
    });
    expect(membership.fundActionMode.value).toEqual(null);
    expect(toastTitles.at(-1)).toEqual("已提交，当前欠款 ¥-10.00");
  });

  test("consume requires a reason and never reaches the API without one", async () => {
    const member = {
      user_id: 54, role: "member", is_member: true, is_paid_member: false,
      balance_cents: 100, last_recharge_at: null, joined_at: "2026-09-01T00:00:00Z",
      status: 1, nickname: "阿九", avatar_url: null, real_name: null,
    } satisfies BackendTeamMember;
    const { membership } = buildMembership([member]);
    membership.handleEditMember(member);
    membership.handleOpenFundAction("consume");
    membership.fundActionForm.amountYuan = "10";
    membership.fundActionForm.note = "   ";

    const callsBefore = consumeTeamMemberFundMock.calls.length;
    await membership.handleSubmitFundAction();

    expect(consumeTeamMemberFundMock.calls.length).toEqual(callsBefore);
    expect(toastTitles.at(-1)).toEqual("请填写消费原因");
  });

  test("leader demoting only their own role submits zero finance requests", async () => {
    const leader = {
      user_id: 42, role: "leader", is_member: true, is_paid_member: true,
      balance_cents: 3000, last_recharge_at: "2026-09-10T08:00:00.123Z",
      joined_at: "2026-09-01T00:00:00Z", status: 1,
      nickname: "领队本人", avatar_url: null, real_name: null,
    } satisfies BackendTeamMember;
    const self = { id: 42, nickname: "领队本人" } as BackendUser;
    const { membership, refreshSessionContext } = buildMembership([leader], {
      currentUser: self,
      demoteOnRefresh: true,
    });
    membership.handleEditMember(leader);
    membership.editMemberForm.role = "member";

    const roleCallsBefore = updateTeamMemberMock.calls.length;
    const paidCallsBefore = updateTeamMemberPaidMembershipMock.calls.length;
    const rechargeCallsBefore = rechargeTeamMemberFundMock.calls.length;
    const consumeCallsBefore = consumeTeamMemberFundMock.calls.length;
    await membership.handleUpdateMember();

    expect(updateTeamMemberMock.calls.length).toEqual(roleCallsBefore + 1);
    // 角色保存不附带任何财务请求：充值时间/余额不可能被顺带改写。
    expect(updateTeamMemberPaidMembershipMock.calls.length).toEqual(paidCallsBefore);
    expect(rechargeTeamMemberFundMock.calls.length).toEqual(rechargeCallsBefore);
    expect(consumeTeamMemberFundMock.calls.length).toEqual(consumeCallsBefore);
    // 成功路径同样刷新会话：降级后的权限立即生效。
    expect(refreshSessionContext.calls.length).toBeGreaterThan(0);
    expect(membership.editMemberPopupVisible.value).toEqual(false);
    expect(toastTitles.at(-1)).toEqual("队员已更新");
  });

  test("role saved but paid toggle rejected refreshes permissions and reports accurately", async () => {
    const { ApiRequestError } = await import("@/utils/request");
    const leader = {
      user_id: 42, role: "leader", is_member: true, is_paid_member: true,
      balance_cents: 3000, last_recharge_at: "2026-09-10T08:00:00.123Z",
      joined_at: "2026-09-01T00:00:00Z", status: 1,
      nickname: "领队本人", avatar_url: null, real_name: null,
    } satisfies BackendTeamMember;
    const self = { id: 42, nickname: "领队本人" } as BackendUser;
    const { membership, refreshTeamDetail, refreshSessionContext } = buildMembership([leader], {
      currentUser: self,
      demoteOnRefresh: true,
    });
    membership.handleEditMember(leader);
    membership.editMemberForm.role = "member";
    membership.editMemberForm.isPaidMember = false;

    // 第一步（角色降级）成功，第二步（付费标记）因降级后 403。
    const originalImpl = updateTeamMemberPaidMembershipMock.impl;
    updateTeamMemberPaidMembershipMock.impl = async () => {
      throw new ApiRequestError("无管理权限", 403);
    };
    const roleCallsBefore = updateTeamMemberMock.calls.length;
    try {
      await membership.handleUpdateMember();
    } finally {
      updateTeamMemberPaidMembershipMock.impl = originalImpl;
    }

    expect(updateTeamMemberMock.calls.length).toEqual(roleCallsBefore + 1);
    // 部分成功后必须刷新名单与会话：页面与真实角色一致，权限降级立即生效。
    expect(refreshTeamDetail.calls.length).toBeGreaterThan(0);
    expect(refreshSessionContext.calls.length).toBeGreaterThan(0);
    expect(membership.canManageMembers.value).toEqual(false);
    expect(membership.editMemberPopupVisible.value).toEqual(false);
    // 提示准确区分：已成功的角色不被笼统报成全部失败。
    expect(toastTitles.at(-1)).toEqual("角色已更新，付费会员状态未保存：无管理权限");

    // 降级后不能再发起管理写操作（即便残留旧弹窗状态）。
    membership.handleEditMember(leader);
    const roleCallsAfterDemotion = updateTeamMemberMock.calls.length;
    await membership.handleUpdateMember();
    expect(updateTeamMemberMock.calls.length).toEqual(roleCallsAfterDemotion);
    expect(membership.editMemberPopupVisible.value).toEqual(false);
  });

  test("adding is a no-op without manage permission", async () => {
    const submitting = ref(false);
    const membership = useTeamMembership({
      currentTeam: computed(() => ({ ...team, canManageTeam: false }) as never),
      currentUser: ref(null),
      currentMembers: computed(() => [] as BackendTeamMember[]),
      usersById: ref({}),
      submitting,
      refreshSessionContext: recorder(async () => undefined),
      refreshTeamDetail: recorder(async () => undefined),
      invalidateActivityAttendance: recorder(() => undefined),
    });
    membership.memberForm.userId = "42";

    const callsBefore = addTeamMemberMock.calls.length;
    await membership.handleAddMember();

    expect(addTeamMemberMock.calls.length).toEqual(callsBefore);
  });
});
