import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("team manage real backend integration", () => {
  test("bottom tab routes create team action to the real team manage page", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/components/BottomTabBar.vue",
    ).text();

    expect(source.includes('url: "/pages/teams/manage/index"')).toEqual(true);
    expect(source.includes("创建球队表单尚未接入")).toEqual(false);
    expect(source.includes("待接入")).toEqual(false);
  });

  test("pages config registers the team manage page", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages.json",
    ).text();

    expect(source.includes('"path": "pages/teams/manage/index"')).toEqual(true);
    expect(source.includes('"navigationBarTitleText": "球队管理"')).toEqual(true);
  });

  test("team api wraps create search join and password-info backend endpoints", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/api/team.ts",
    ).text();

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
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/teams/manage/index.vue",
    ).text();

    expect(source.includes("createTeam")).toEqual(true);
    expect(source.includes("searchTeams")).toEqual(true);
    expect(source.includes("joinTeam")).toEqual(true);
    expect(source.includes("refreshSessionContext")).toEqual(true);
  });

  test("home team manage action opens the real team manage page instead of mine tab", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/index.vue",
    ).text();

    expect(source.includes('uni.navigateTo({ url: "/pages/teams/manage/index" });')).toEqual(true);
    expect(source.includes('uni.switchTab({ url: "/pages/user/index" });')).toEqual(true);
  });

  test("team manage page edits team profile and searches users before adding members", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/teams/manage/index.vue",
    ).text();
    const userApi = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/api/user.ts",
    ).text();
    const backendUserService = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_rs/src/user/application/service.rs",
    ).text();
    const backendUserRoutes = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_rs/src/user/adapters/web/routes.rs",
    ).text();
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
    expect(source.includes("candidate.avatar_url")).toEqual(true);
    expect(source.includes("handleSelectCandidate")).toEqual(true);
    expect(userApi.includes("export function searchUsers")).toEqual(true);
    expect(userApi.includes('url: `/user/search')).toEqual(true);
    expect(backendUserRoutes.includes('.route("/search", get(search_users_handler))')).toEqual(true);
    expect(searchUsersBlock.includes("ActorKind::Admin")).toEqual(false);
  });
});
