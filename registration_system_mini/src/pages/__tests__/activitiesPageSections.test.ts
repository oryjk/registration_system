import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("activities page sections", () => {
  test("renders the match hall with calendar strip and quick filters", async () => {
    const source = await Bun.file(sourcePath("pages/activities/index.vue")).text();
    const state = await Bun.file(sourcePath("pages/activities/hallMatchState.ts")).text();

    expect(source.includes("<HallCalendarStrip")).toEqual(true);
    expect(source.includes("<HallQuickFilters")).toEqual(true);
    expect(source.includes("<HallMatchList")).toEqual(true);
    expect(state.includes('"球队约队"')).toEqual(true);
    expect(state.includes('"散人约局"')).toEqual(true);
    expect(state.includes("registration_groups")).toEqual(true);
  });

  test("navigates hall cards to the match detail page", async () => {
    const source = await Bun.file(sourcePath("pages/activities/index.vue")).text();
    const state = await Bun.file(sourcePath("pages/activities/hallMatchState.ts")).text();
    const card = await Bun.file(sourcePath("pages/activities/components/HallMatchCard.vue")).text();

    expect(source.includes('card.actionKind === "accept" ? card.applyUrl : card.detailUrl')).toEqual(true);
    expect(state.includes("/pages/matches/detail?id=")).toEqual(true);
    expect(state.includes("/pages/matches/apply-team/index?id=")).toEqual(true);
    expect(card.includes("neo-border-strong")).toEqual(true);
    expect(card.includes("NeoProgress")).toEqual(true);
    expect(card.includes(':stop-propagation="false"')).toEqual(true);
    expect(source.includes("acceptChallenge")).toEqual(false);
    expect(source.includes("cancelIndividualChallengeAcceptance")).toEqual(false);
  });

  test("opens a publish type sheet with dual creation entries", async () => {
    const source = await Bun.file(sourcePath("pages/activities/index.vue")).text();
    const publishTypeSheet = await Bun.file(sourcePath("pages/activities/components/PublishTypeSheet.vue")).text();

    expect(source.includes("function openPublishTypeSheet")).toEqual(true);
    expect(source.includes("canPublish")).toEqual(true);
    expect(publishTypeSheet.includes("publish-menu-overlay")).toEqual(true);
    expect(publishTypeSheet.includes("publish-menu-overlay-open")).toEqual(true);
    expect(publishTypeSheet.includes("publish-menu-action")).toEqual(true);
    expect(publishTypeSheet.includes("cubic-bezier(0.22, 1, 0.36, 1)")).toEqual(true);
    expect(source.includes("handlePublishTeamChallenge")).toEqual(true);
    expect(source.includes("handlePublishIndividualChallenge")).toEqual(true);
    expect(source.includes('url: "/pages/matches/create"')).toEqual(true);
    expect(source.includes('url: "/pages/challenges/create-individual"')).toEqual(true);
    expect(source.includes("<MatchPublishForm")).toEqual(false);
    expect(source.includes("showCreateForm")).toEqual(false);
  });

  test("keeps the load-more entry when client filters empty the current page", async () => {
    const source = await Bun.file(sourcePath("pages/activities/index.vue")).text();
    const logic = await Bun.file(sourcePath("pages/activities/useHallPage.ts")).text();

    // 类型/人数是前端过滤，只作用于已加载页；过滤后为空但仍有下一页时，“加载更多”不能消失。
    expect(source.includes('v-if="hasMore && hallCards.length"')).toEqual(false);
    expect(source.includes('v-if="hasMore"')).toEqual(true);
    expect(source.includes("本页没有符合筛选条件的约队")).toEqual(true);
    // 服务端 total=0 表示确实没有数据，避免空大厅出现无效的“加载更多”。
    expect(logic.includes("return pagination.page > 1;")).toEqual(false);
    expect(logic.includes("if (pagination.total === 0) {")).toEqual(true);
  });

  test("registers individual challenge creation page", async () => {
    const pages = await Bun.file(sourcePath("pages.json")).text();
    const source = await Bun.file(sourcePath("pages/challenges/create-individual/index.vue")).text();

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
    expect(source.includes('const reviewGateReady = ref(false);')).toEqual(true);
    expect(source.includes('v-if="reviewGateReady"')).toEqual(true);
    expect(source.includes("async function handleSubmit() {\n  if (await guardReviewMode()) return;")).toEqual(true);
  });

  test("supports map location picking when creating an individual challenge", async () => {
    const source = await Bun.file(sourcePath("pages/challenges/create-individual/index.vue")).text();

    expect(source.includes("function handleChooseLocation")).toEqual(true);
    expect(source.includes("uni.chooseLocation")).toEqual(true);
    expect(source.includes("function handleLocationInput")).toEqual(true);
    expect(source.includes("@input=\"handleLocationInput\"")).toEqual(true);
    expect(source.includes("@tap=\"handleChooseLocation\"")).toEqual(true);
    expect(source.includes("form-location-row")).toEqual(true);
    expect(source.includes("grid-template-columns: minmax(0, 1fr) 150rpx")).toEqual(true);
    expect(source.includes("create-location-head")).toEqual(false);
    expect(source.includes("locationLatitude: null as number | null")).toEqual(true);
    expect(source.includes("locationLongitude: null as number | null")).toEqual(true);
    expect(source.includes("location_latitude: form.locationLatitude ?? undefined")).toEqual(true);
    expect(source.includes("location_longitude: form.locationLongitude ?? undefined")).toEqual(true);
    expect(source.includes("已选择地图位置，详情页可直接打开地图。")).toEqual(true);
  });

  test("mine profile exposes current identity switch next to team switch", async () => {
    const minePageSource = await Bun.file(sourcePath("pages/user/index.vue")).text();
    const minePageComposableSource = await Bun.file(sourcePath("pages/user/useMinePage.ts")).text();
    const identityPanelSource = await Bun.file(sourcePath("pages/user/components/MineTeamIdentityPanel.vue")).text();

    expect(minePageSource.includes("availableIdentities")).toEqual(true);
    expect(minePageComposableSource.includes("switchIdentity")).toEqual(true);
    expect(minePageSource.includes("<MineTeamIdentityPanel")).toEqual(true);
    expect(identityPanelSource.includes('title="球队与身份"')).toEqual(true);
    expect(identityPanelSource.includes("发布身份")).toEqual(true);
    expect(identityPanelSource.includes("mine-switch-chip--active")).toEqual(true);
    expect(identityPanelSource.includes('emit("switchIdentity", identityId)')).toEqual(true);
  });

  test("venue-created team challenge detail waits for both teams before showing home side", async () => {
    const progressSource = await Bun.file(sourcePath("pages/challenges/components/ChallengeTeamProgressCard.vue")).text();

    expect(progressSource.includes("hostTeamConfirmed")).toEqual(true);
    expect(progressSource.includes("props.detail.summary.challenge.host_team_id != null")).toEqual(true);
    expect(progressSource.includes('hostTeamConfirmed.value ? props.detail.summary.host_team_name : "等待接约"')).toEqual(true);
    expect(progressSource.includes("!hostTeamConfirmed ? 'vs-logo-muted' : ''")).toEqual(true);
  });

  test("individual challenge registration relies on the page header instead of a duplicate tab label", async () => {
    const detailSource = await Bun.file(sourcePath("pages/challenges/detail.vue")).text();
    const individualRegistrationSource = await Bun.file(sourcePath("pages/challenges/components/ChallengeIndividualRegistration.vue")).text();

    expect(detailSource.includes('card.value?.kind === "individual" ? "散人报名" : "约队详情"')).toEqual(true);
    expect(individualRegistrationSource.includes('class="challenge-tabs"')).toEqual(false);
    expect(individualRegistrationSource.includes('class="challenge-tab-active"')).toEqual(false);
  });

  test("enables sharing for the challenge hall with the default share cover", async () => {
    const source = await Bun.file(sourcePath("pages/activities/index.vue")).text();

    expect(source.includes("onShareAppMessage")).toEqual(true);
    expect(source.includes("onShareTimeline")).toEqual(true);
    expect(source.includes('const shareTitle = "约队大厅：看看可报名的散人局";')).toEqual(true);
    expect(source.includes('const sharePath = "/pages/activities/index";')).toEqual(true);
    expect(source.includes("imageUrl: DEFAULT_SHARE_IMAGE_URL")).toEqual(true);
  });

  test("match card lists share the card list spacing token", async () => {
    const tokens = await Bun.file(sourcePath("styles/neo-tokens.css")).text();
    const homeList = await Bun.file(sourcePath("pages/home/components/HomeMatchList.vue")).text();
    const hallList = await Bun.file(sourcePath("pages/activities/components/HallMatchList.vue")).text();

    expect(tokens.includes("--neo-card-list-gap: 20rpx;")).toEqual(true);
    expect(tokens.includes("--neo-card-list-offset: 24rpx;")).toEqual(true);
    expect(homeList.includes("gap: var(--neo-card-list-gap);")).toEqual(true);
    expect(hallList.includes("gap: var(--neo-card-list-gap);")).toEqual(true);
  });

  test("requires login before showing the hall list", async () => {    const source = await Bun.file(sourcePath("pages/activities/index.vue")).text();
    const composable = await Bun.file(sourcePath("pages/activities/useHallPage.ts")).text();

    expect(source.includes("登录后查看约队大厅")).toEqual(true);
    expect(source.includes("handleLogin")).toEqual(true);
    expect(composable.includes("hasManualLogout")).toEqual(true);
    expect(composable.includes("isGuestMode")).toEqual(true);
    expect(composable.includes("publicationModes: [")).toEqual(true);
    expect(composable.includes("status: \"registering\"")).toEqual(true);
    expect(composable.includes("startsAfter: new Date()")).toEqual(true);
  });
});
