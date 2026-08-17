import { describe, expect, test } from "bun:test";
import { sourcePath, workspacePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

async function teamManageSource() {
  const paths = [
    "pages/teams/manage/index.vue",
    "pages/teams/manage/useTeamManagePage.ts",
    "pages/teams/manage/useTeamProfile.ts",
    "pages/teams/manage/useTeamMembership.ts",
    "pages/teams/manage/useTeamAttendance.ts",
  ];
  return (await Promise.all(paths.map((path) => Bun.file(sourcePath(path)).text()))).join("\n");
}

describe("team manage real backend integration", () => {
  test("keeps the SFC as a composition layer over focused team workflows", async () => {
    const page = await Bun.file(sourcePath("pages/teams/manage/index.vue")).text();
    const pageScript = page.slice(0, page.indexOf("</script>"));

    expect(page.includes('from "./useTeamManagePage"')).toEqual(true);
    expect(pageScript.split("\n").length < 200).toEqual(true);
    expect(page.includes("useTeamManagePage()")).toEqual(true);
  });

  test("bottom tab routes create team action to the real team manage page", async () => {
    const source = await Bun.file(sourcePath("components/BottomTabBar.vue")).text();

    expect(source.includes('url: "/pages/teams/manage/index"')).toEqual(true);
    expect(source.includes("创建球队表单尚未接入")).toEqual(false);
    expect(source.includes("待接入")).toEqual(false);
  });

  test("pages config registers the team manage page", async () => {
    const source = await Bun.file(sourcePath("pages.json")).text();

    expect(source.includes('"path": "pages/teams/manage/index"')).toEqual(true);
    expect(source.includes('"navigationBarTitleText": "球队管理"')).toEqual(true);
  });

  test("team api wraps create search join and password-info backend endpoints", async () => {
    const source = await Bun.file(sourcePath("api/team.ts")).text();

    expect(source.includes("export function createTeam")).toEqual(true);
    expect(source.includes('url: "/teams"')).toEqual(true);
    expect(source.includes("export function searchTeams")).toEqual(true);
    expect(source.includes('url: `/teams/search')).toEqual(true);
    expect(source.includes("export function joinTeam")).toEqual(true);
    expect(source.includes('url: "/teams/join"')).toEqual(true);
    expect(source.includes("export function getTeamPasswordInfo")).toEqual(true);
    expect(source.includes('url: `/teams/${teamId}/password-info`')).toEqual(true);
    expect(source.includes("export function updateTeam")).toEqual(true);
    expect(source.includes('url: `/teams/${teamId}`')).toEqual(true);
    expect(source.includes('method: "PATCH"')).toEqual(true);
  });

  test("team manage page creates and joins teams through api wrappers", async () => {
    const source = await teamManageSource();
    const state = await Bun.file(sourcePath("pages/teams/manage/teamManageState.ts")).text();

    expect(source.includes("createTeam")).toEqual(true);
    expect(source.includes("searchTeams")).toEqual(true);
    expect(source.includes("joinTeam")).toEqual(true);
    expect(source.includes("refreshSessionContext")).toEqual(true);
    expect(source.includes("shouldHideCreationEntrances")).toEqual(true);
    expect(source.includes("const canShowCreateTeamEntry = computed(() => !shouldHideCreationEntrances.value);")).toEqual(true);
    expect(source.includes('...(canShowCreateTeamEntry.value ? [{ label: "创建球队", value: "create" }] : [])')).toEqual(true);
    expect(state.includes("allowCreateTeamMode = true")).toEqual(true);
    expect(state.includes('return allowCreateTeamMode ? "create" : "join";')).toEqual(true);
  });

  test("team management entry points open the team detail page first", async () => {
    const bottomTabBar = await Bun.file(sourcePath("components/BottomTabBar.vue")).text();
    const minePage = await Bun.file(sourcePath("pages/user/useMinePage.ts")).text();
    const detailPage = await Bun.file(sourcePath("pages/teams/detail/useTeamDetailPage.ts")).text();

    expect(bottomTabBar.includes('url: "/pages/teams/manage/index"')).toEqual(true);
    // 「我的」页球队入口先进入球队二级页（队费充值所在），管理入口再从二级页进入。
    expect(minePage.includes("function openTeamDetail(teamId?: number)")).toEqual(true);
    expect(minePage.includes('`/pages/teams/detail/index?teamId=${targetId}`')).toEqual(true);
    expect(detailPage.includes('url: "/pages/teams/manage/index"')).toEqual(true);
  });

  test("team manage page edits team profile and searches users before adding members", async () => {
    const source = await teamManageSource();
    const memberManager = await Bun.file(sourcePath("pages/teams/manage/components/TeamMemberManager.vue")).text();
    const candidateSearch = await Bun.file(sourcePath("pages/teams/manage/components/MemberCandidateSearch.vue")).text();
    const userApi = await Bun.file(sourcePath("api/user.ts")).text();
    const backendUserService = await Bun.file(workspacePath("registration_system_rs/src/user/application/service.rs")).text();
    const backendUserRoutes = await Bun.file(workspacePath("registration_system_rs/src/user/adapters/web/routes.rs")).text();
    const searchUsersBlock = backendUserService.slice(
      backendUserService.indexOf("pub async fn search_users"),
      backendUserService.indexOf("pub async fn update_profile"),
    );

    expect(source.includes("updateTeam")).toEqual(true);
    expect(source.includes("handleUpdateTeamProfile")).toEqual(true);
    expect(source.includes("activeMode === 'profile'")).toEqual(true);
    expect(source.includes("teamProfileForm.logoUrl")).toEqual(true);
    expect(source.includes("handleSearchUsers")).toEqual(true);
    expect(source.includes("userSearchResults")).toEqual(true);
    expect(source.includes("TeamMemberManager")).toEqual(true);
    expect(candidateSearch.includes("candidate.avatar_url")).toEqual(true);
    expect(source.includes("handleCandidateTap")).toEqual(true);
    expect(source.includes('@candidate-tap="handleCandidateTap"')).toEqual(true);
    expect(userApi.includes("export function searchUsers")).toEqual(true);
    expect(userApi.includes('url: `/user/search')).toEqual(true);
    expect(backendUserRoutes.includes('.route("/search", get(search_users_handler))')).toEqual(true);
    expect(searchUsersBlock.includes("ActorKind::Admin")).toEqual(false);
  });

  test("team member manager delegates candidate search and member sections to focused components", async () => {
    const memberManager = await Bun.file(sourcePath("pages/teams/manage/components/TeamMemberManager.vue")).text();
    const candidateSearch = await Bun.file(sourcePath("pages/teams/manage/components/MemberCandidateSearch.vue")).text();
    const memberSection = await Bun.file(sourcePath("pages/teams/manage/components/TeamMemberSection.vue")).text();

    expect(memberManager.includes("MemberCandidateSearch")).toEqual(true);
    expect(memberManager.includes("TeamMemberSection")).toEqual(true);
    expect(memberManager.includes("v-for=\"candidate in userSearchResults\"")).toEqual(false);
    expect(candidateSearch.includes('emit("candidateTap", candidate)')).toEqual(true);
    expect(memberSection.includes('emit("openMemberAttendance", member)')).toEqual(true);
    expect(memberSection.includes('emit("removeMember", member)')).toEqual(true);
  });

  test("mine page exposes managed teams as cards that open the team detail page", async () => {
    const minePage = await Bun.file(sourcePath("pages/user/useMinePage.ts")).text();
    const identityPanel = await Bun.file(sourcePath("pages/user/components/MineTeamIdentityPanel.vue")).text();

    expect(identityPanel.includes("mine-manage-list")).toEqual(true);
    expect(identityPanel.includes("manageableTeams")).toEqual(true);
    expect(identityPanel.includes("team.canManageTeam")).toEqual(true);
    expect(identityPanel.includes("@tap=\"emit('manageTeam', team.id)\"")).toEqual(true);
    expect(minePage.includes("function openTeamDetail(teamId?: number)")).toEqual(true);
    expect(minePage.includes("function openTeamManage(teamId?: number)")).toEqual(true);
  });

  test("team manage page includes match attendance tab and panel", async () => {
    const source = await teamManageSource();
    const panel = await Bun.file(sourcePath("pages/teams/manage/components/TeamActivityAttendancePanel.vue")).text();

    expect(source.includes("TeamActivityAttendancePanel")).toEqual(true);
    expect(source.includes("activeMode === 'attendance'")).toEqual(true);
    expect(source.includes("比赛出勤")).toEqual(true);
    expect(source.includes("loadTeamActivityAttendanceSummaries")).toEqual(true);
    expect(panel.includes("参加")).toEqual(true);
    expect(panel.includes("请假")).toEqual(true);
    expect(panel.includes("未打卡")).toEqual(true);
  });
});
