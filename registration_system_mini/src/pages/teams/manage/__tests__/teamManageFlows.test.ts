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
const addTeamMemberMock = recorder(async () => ({ ok: true }));
const searchUsersMock = recorder(async () => [] as BackendUser[]);

mock.module("@/api/team", () => ({
  addTeamMember: addTeamMemberMock,
  deleteTeam: async () => undefined,
  getTeamDissolveBlockers: async () => ({ matches: [], applications: [] }),
  getTeamMatchAttendance: async () => null,
  getTeamMemberAttendance: async () => null,
  removeTeamMember: async () => undefined,
  setTeamMemberActive: async () => undefined,
  updateTeam: updateTeamMock,
  updateTeamJoinPassword: async () => undefined,
  updateTeamMember: async () => undefined,
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
const { useTeamMembership } = await import("../useTeamMembership");

const team = { id: 7, name: "银河联队", canManageTeam: true };

function buildMembership(members: BackendTeamMember[] = []) {
  const submitting = ref(false);
  const usersById = ref<Record<number, BackendUser>>({});
  const refreshTeamDetail = recorder(async () => undefined);
  const refreshSessionContext = recorder(async () => undefined);
  const invalidateActivityAttendance = recorder(() => undefined);
  const membership = useTeamMembership({
    currentTeam: computed(() => team as never),
    currentUser: ref(null),
    currentMembers: computed(() => members),
    usersById,
    submitting,
    refreshSessionContext,
    refreshTeamDetail,
    invalidateActivityAttendance,
  });
  return { membership, usersById, refreshTeamDetail, invalidateActivityAttendance };
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
