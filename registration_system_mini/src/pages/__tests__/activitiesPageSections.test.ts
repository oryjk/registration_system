import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("activities page sections", () => {
  test("splits challenge hall into team and individual sections", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/index.vue",
    ).text();
    const sections = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/components/ChallengeHallSections.vue",
    ).text();

    expect(sections.includes("球队约队")).toEqual(true);
    expect(sections.includes("散人约队")).toEqual(true);
    expect(source.includes("const teamHallCards = computed")).toEqual(true);
    expect(source.includes("const individualHallCards = computed")).toEqual(true);
  });

  test("uses team manager permission for accepting team challenges", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/index.vue",
    ).text();
    const sections = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/components/ChallengeHallSections.vue",
    ).text();
    const card = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/components/ChallengeHallCard.vue",
    ).text();

    expect(source.includes("currentTeam.value.canManageTeam")).toEqual(true);
    expect(source.includes('card.kind === "team"')).toEqual(true);
    expect(sections.includes("散人约队同一时间只能接一场")).toEqual(true);
    expect(card.includes('props.variant === "team"')).toEqual(true);
  });

  test("opens a publish type sheet and navigates to challenge create pages with current identity", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/index.vue",
    ).text();
    const publishTypeSheet = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/components/PublishTypeSheet.vue",
    ).text();

    expect(source.includes("function openPublishTypeSheet")).toEqual(true);
    expect(publishTypeSheet.includes("publish-sheet-overlay")).toEqual(true);
    expect(source.includes("handlePublishTeamChallenge")).toEqual(true);
    expect(source.includes("handlePublishIndividualChallenge")).toEqual(true);
    expect(source.includes("<wd-action-sheet")).toEqual(false);
    expect(source.includes('itemList: ["球队约队", "散人约队"]')).toEqual(false);
    expect(source.includes('url: "/pages/matches/create/index"')).toEqual(false);
    expect(source.includes('url: "/pages/challenges/create-individual/index?kind=team"')).toEqual(true);
    expect(source.includes('url: "/pages/challenges/create-individual/index"')).toEqual(true);
    expect(source.includes("createChallenge")).toEqual(false);
    expect(source.includes("<MatchPublishForm")).toEqual(false);
    expect(source.includes("showCreateForm")).toEqual(false);
  });

  test("registers individual challenge creation page", async () => {
    const pages = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages.json",
    ).text();
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/challenges/create-individual/index.vue",
    ).text();

    expect(pages.includes('"path": "pages/challenges/create-individual/index"')).toEqual(true);
    expect(source.includes('createChallenge')).toEqual(true);
    expect(source.includes("challengeKind.value")).toEqual(true);
    expect(source.includes('options?.kind === "team"')).toEqual(true);
    expect(source.includes('host_team_id: currentIdentity.value?.kind === "team" ? currentIdentity.value.teamId : undefined')).toEqual(true);
    expect(source.includes("请先在我的页面选择球队或场馆身份")).toEqual(true);
    expect(source.includes("散人约队同一时间只能接一场")).toEqual(true);
  });

  test("mine profile exposes current identity switch next to team switch", async () => {
    const minePageSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/index.vue",
    ).text();
    const heroSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/user/components/MineHeroProfile.vue",
    ).text();

    expect(minePageSource.includes("availableIdentities")).toEqual(true);
    expect(minePageSource.includes("switchIdentity")).toEqual(true);
    expect(heroSource.includes("当前身份")).toEqual(true);
    expect(heroSource.includes("identity-chip-active")).toEqual(true);
    expect(heroSource.includes('emit("switchIdentity", identityId)')).toEqual(true);
  });

  test("venue-created team challenge detail waits for both teams before showing home side", async () => {
    const progressSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/challenges/components/ChallengeTeamProgressCard.vue",
    ).text();

    expect(progressSource.includes("hostTeamConfirmed")).toEqual(true);
    expect(progressSource.includes("props.detail.summary.challenge.host_team_id != null")).toEqual(true);
    expect(progressSource.includes('hostTeamConfirmed.value ? props.detail.summary.host_team_name : "等待接约"')).toEqual(true);
    expect(progressSource.includes("!hostTeamConfirmed ? 'vs-logo-muted' : ''")).toEqual(true);
  });

  test("individual challenge registration relies on the page header instead of a duplicate tab label", async () => {
    const detailSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/challenges/detail.vue",
    ).text();
    const individualRegistrationSource = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/challenges/components/ChallengeIndividualRegistration.vue",
    ).text();

    expect(detailSource.includes('card.value?.kind === "individual" ? "散人报名" : "约队详情"')).toEqual(true);
    expect(individualRegistrationSource.includes('class="challenge-tabs"')).toEqual(false);
    expect(individualRegistrationSource.includes('class="challenge-tab-active"')).toEqual(false);
  });
});
