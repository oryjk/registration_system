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
    const toolbar = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/components/ActivitiesToolbar.vue",
    ).text();
    const publishTypeSheet = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/components/PublishTypeSheet.vue",
    ).text();

    expect(source.includes("function openPublishTypeSheet")).toEqual(true);
    expect(source.includes("shouldHideCreationEntrances")).toEqual(true);
    expect(source.includes("const canPublish = computed(() => !!currentIdentity.value && !shouldHideCreationEntrances.value);")).toEqual(true);
    expect(publishTypeSheet.includes("publish-menu-overlay")).toEqual(true);
    expect(publishTypeSheet.includes("publish-menu-overlay-open")).toEqual(true);
    expect(publishTypeSheet.includes("publish-menu-action")).toEqual(true);
    expect(publishTypeSheet.includes("cubic-bezier(0.22, 1, 0.36, 1)")).toEqual(true);
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
    expect(toolbar.includes("v-if=\"canPublish\"")).toEqual(true);
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
    expect(source.includes("now.setDate(now.getDate() + 1)")).toEqual(false);
    expect(source.includes("form.date = defaultPublishDate();")).toEqual(true);
    expect(source.includes('host_team_id: currentIdentity.value?.kind === "team" ? currentIdentity.value.teamId : undefined')).toEqual(true);
    expect(source.includes("请先在我的页面选择球队或场馆身份")).toEqual(true);
    expect(source.includes("散人约队同一时间只能接一场")).toEqual(true);
    expect(source.includes('import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview"')).toEqual(true);
    expect(source.includes("async function guardReviewMode")).toEqual(true);
    expect(source.includes("await preloadMiniReviewStatus();")).toEqual(true);
    expect(source.includes("if (!shouldHideCreationEntrances.value) return false;")).toEqual(true);
    expect(source.includes("审核状态下暂不开放散人约球")).toEqual(true);
    expect(source.includes("审核状态下暂不开放球队约队")).toEqual(true);
    expect(source.includes("uni.navigateBack")).toEqual(true);
    expect(source.includes('uni.switchTab({ url: "/pages/home/index" });')).toEqual(true);
  });

  test("supports map location picking when creating an individual challenge", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/challenges/create-individual/index.vue",
    ).text();

    expect(source.includes("function handleChooseLocation")).toEqual(true);
    expect(source.includes("uni.chooseLocation")).toEqual(true);
    expect(source.includes("function handleLocationInput")).toEqual(true);
    expect(source.includes("@input=\"handleLocationInput\"")).toEqual(true);
    expect(source.includes("@tap=\"handleChooseLocation\"")).toEqual(true);
    expect(source.includes("create-location-row")).toEqual(true);
    expect(source.includes("grid-template-columns: minmax(0, 1fr) 150rpx")).toEqual(true);
    expect(source.includes("create-location-head")).toEqual(false);
    expect(source.includes("locationLatitude: null as number | null")).toEqual(true);
    expect(source.includes("locationLongitude: null as number | null")).toEqual(true);
    expect(source.includes("location_latitude: form.locationLatitude ?? undefined")).toEqual(true);
    expect(source.includes("location_longitude: form.locationLongitude ?? undefined")).toEqual(true);
    expect(source.includes("已选择地图位置，详情页可直接打开地图。")).toEqual(true);
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

  test("enables sharing for the challenge hall with the default share cover", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/index.vue",
    ).text();

    expect(source.includes("onShareAppMessage")).toEqual(true);
    expect(source.includes("onShareTimeline")).toEqual(true);
    expect(source.includes('const shareTitle = "约队大厅：看看可报名的散人局";')).toEqual(true);
    expect(source.includes('const sharePath = "/pages/activities/index";')).toEqual(true);
    expect(source.includes("imageUrl: DEFAULT_SHARE_IMAGE_URL")).toEqual(true);
  });

  test("loads public challenge hall data as guest and logs in only for actions", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/index.vue",
    ).text();

    expect(source.includes('import { getAccessToken } from "@/utils/authStorage";')).toEqual(true);
    expect(source.includes("const isGuestMode = computed(() => !getAccessToken());")).toEqual(true);
    expect(source.includes("if (!isGuestMode.value)")).toEqual(true);
    expect(source.includes("teamId: isGuestMode.value ? undefined : currentTeam.value?.id")).toEqual(true);
    expect(source.includes("auth: !isGuestMode.value")).toEqual(true);
    expect(source.includes("async function requireLoginForHallAction")).toEqual(true);
    expect(source.includes("await ensureSessionReady(true);")).toEqual(true);
    expect(source.includes("const loggedIn = await requireLoginForHallAction();")).toEqual(true);
  });
});
