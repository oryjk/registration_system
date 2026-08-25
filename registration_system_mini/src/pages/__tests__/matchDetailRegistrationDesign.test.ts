import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

function sourceFile(path: string) {
  return Bun.file(sourcePath(path));
}

async function matchDetailLogicSource() {
  const paths = [
    "pages/matches/useMatchDetailPage.ts",
    "pages/matches/useMatchGuestLogin.ts",
    "pages/matches/useMatchRegistration.ts",
    "pages/matches/useMatchCheckInReview.ts",
    "pages/matches/useMatchSettlement.ts",
  ];
  return (await Promise.all(paths.map((path) => sourceFile(path).text()))).join("\n");
}

describe("match detail registration design", () => {
  test("keeps the page facade small by composing focused domain workflows", async () => {
    const facade = await sourceFile("pages/matches/useMatchDetailPage.ts").text();

    expect(facade.includes('from "./useMatchRegistration"')).toEqual(true);
    expect(facade.includes('from "./useMatchCheckInReview"')).toEqual(true);
    expect(facade.includes('from "./useMatchSettlement"')).toEqual(true);
    expect(facade.split("\n").length < 650).toEqual(true);
  });

  test("uses an in-page segmented layout for individual and team registration", async () => {
    const source = await sourceFile(
      "pages/matches/detail.vue",
    ).text();
    const pageLogic = await matchDetailLogicSource();

    expect(pageLogic.includes("const registrationMode = ref<\"individual\" | \"team\">(\"individual\");")).toEqual(true);
    expect(source.includes("个人报名")).toEqual(true);
    expect(source.includes("球队报名")).toEqual(true);
    expect(source.includes("NeoSegmentedControl")).toEqual(true);
    expect(source.includes('v-model="registrationMode"')).toEqual(true);
    expect(source.includes("registrationMode === 'individual'")).toEqual(true);
    expect(source.includes("registrationMode === 'team'")).toEqual(true);
  });

  test("renders the individual registration view with countdown, guide card, and a primary CTA", async () => {
    const source = await sourceFile(
      "pages/matches/detail.vue",
    ).text();
    const individual = await sourceFile(
      "pages/matches/components/MatchIndividualRegistration.vue",
    ).text();
    const statusCard = await sourceFile(
      "pages/matches/components/MatchRegistrationStatusCard.vue",
    ).text();
    const info = await sourceFile(
      "pages/matches/components/IndividualInfoCard.vue",
    ).text();

    expect(source.includes("MatchIndividualRegistration")).toEqual(true);
    expect(individual.includes("MatchRegistrationStatusCard")).toEqual(true);
    expect(statusCard.includes("报名进度")).toEqual(true);
    expect(info.includes("比赛说明")).toEqual(true);
    expect(statusCard.includes("NeoProgress")).toEqual(true);
    expect(statusCard.includes("NeoAvatarStack")).toEqual(true);
    expect(statusCard.includes("NeoStickyActionBar")).toEqual(true);
    expect(source.includes("interestCards")).toEqual(false);
    expect(individual.includes("IndividualPromoBanner")).toEqual(false);
    expect(individual.includes("InterestMatchGrid")).toEqual(false);
  });

  test("uses the active registration boundary for the countdown and holding date for match clock", async () => {
    const pageLogic = await matchDetailLogicSource();
    const datetime = await sourceFile(
      "utils/datetime.ts",
    ).text();

    expect(pageLogic.includes("const registrationWindow = computed")).toEqual(true);
    expect(pageLogic.includes("registrationStartAt: sourceMatch.value.registration_start_at")).toEqual(true);
    expect(pageLogic.includes("registrationEndAt: sourceMatch.value.registration_end_at")).toEqual(true);
    // legacy 活动仍使用原有 end_time 语义；Go 比赛缺失截止时间时不再回退比赛开始时间。
    expect(pageLogic.includes("match.value.registration_end_at || match.value.end_time || match.value.holding_date")).toEqual(true);
    expect(pageLogic.includes('window.state === "not_started" ? `距开放 ${countdown}` : `距截止 ${countdown}`')).toEqual(true);
    expect(pageLogic.includes("formatClock(match.value.holding_date)")).toEqual(true);
    expect(pageLogic.includes("formatClock(match.value.start_time)")).toEqual(false);
    expect(datetime.includes('if (distance <= 0) return "已截止";')).toEqual(true);
  });

  test("renders the team registration view with versus header, registration form, and a team submit bar", async () => {
    const source = await sourceFile(
      "pages/matches/detail.vue",
    ).text();
    const team = await sourceFile(
      "pages/matches/components/MatchTeamRegistration.vue",
    ).text();
    const teamHero = await sourceFile(
      "pages/matches/components/TeamRegistrationHero.vue",
    ).text();
    const teamForm = await sourceFile(
      "pages/matches/components/TeamRegistrationFormCard.vue",
    ).text();

    expect(source.includes("MatchTeamRegistration")).toEqual(true);
    expect(team.includes("TeamRegistrationHero")).toEqual(true);
    expect(teamHero.includes("team-vs-card")).toEqual(true);
    expect(teamForm.includes("team-registration-form")).toEqual(true);
    expect(source.includes("teamRegistrationCountOptions")).toEqual(true);
    expect(source.includes("teamRegistrationCount")).toEqual(true);
    expect(source.includes("teamSubmitLabel")).toEqual(true);
  });

  test("submits team registration and check-in through real activity api wrappers", async () => {
    const source = await sourceFile(
      "pages/matches/detail.vue",
    ).text();
    const pageLogic = await matchDetailLogicSource();
    const actions = await sourceFile(
      "pages/matches/detailActions.ts",
    ).text();

    expect(pageLogic.includes("submitTeamRegistrationForMatch")).toEqual(true);
    expect(pageLogic.includes("submitMatchCheckIn")).toEqual(true);
    expect(actions.includes("submitTeamRegistration")).toEqual(true);
    expect(actions.includes("submitActivityCheckIn")).toEqual(true);
    expect(pageLogic.includes("ensureCurrentLocation")).toEqual(true);
    expect(source.includes("队长代报名接口待接入")).toEqual(false);
  });

  test("lets team managers choose the team registration size before submitting", async () => {
    const pageLogic = await matchDetailLogicSource();
    const actions = await sourceFile(
      "pages/matches/detailActions.ts",
    ).text();

    expect(pageLogic.includes("const teamRegistrationCount = ref(5);")).toEqual(true);
    expect(pageLogic.includes("const teamRegistrationCountOptions = Array.from")).toEqual(true);
    expect(pageLogic.includes("submitTeamRegistrationForMatch")).toEqual(true);
    expect(actions.includes("registration_count: registrationCount")).toEqual(true);
    expect(actions.includes("submitTeamRegistration")).toEqual(true);
  });

  test("lets individual users cancel an existing registration from the primary CTA", async () => {    const pageLogic = await matchDetailLogicSource();

    // 散人约球（pickup）已报名走「调整人数」面板；其余模式保持 CTA 取消报名。
    expect(pageLogic.includes('if (isPickupMatch.value && isMatchApiDetail.value) return myRegistrationPaid.value ? "已报名" : "调整人数";')).toEqual(true);
    expect(pageLogic.includes('return "取消报名";')).toEqual(true);
    expect(pageLogic.includes("handleCancelIndividualSignup")).toEqual(true);
    expect(pageLogic.includes("cancelIndividualRegistration")).toEqual(true);
    expect(pageLogic.includes('title: "已取消报名"')).toEqual(true);
    expect(pageLogic.includes("你已经报过名了")).toEqual(false);
  });

  test("pickup matches sign up with a headcount sheet and per-head fee", async () => {
    const pageLogic = await matchDetailLogicSource();
    const detail = await sourceFile("pages/matches/detail.vue").text();
    const sheet = await sourceFile("pages/matches/components/MatchSignupCountSheet.vue").text();
    const payment = await sourceFile("pages/matches/useMatchRegistrationPayment.ts").text();
    const actions = await sourceFile("pages/matches/detailActions.ts").text();

    // 散人约球报名走人数选择面板，提交携带所选人数。
    expect(pageLogic.includes('sourceMatch.value?.publication_mode === "online_pickup"')).toEqual(true);
    expect(pageLogic.includes("openSignupSheet")).toEqual(true);
    expect(pageLogic.includes("handleSignupSheetConfirm")).toEqual(true);
    expect(detail.includes("<MatchSignupCountSheet")).toEqual(true);
    expect(sheet.includes("wd-input-number")).toEqual(true);
    expect(actions.includes("registrationCount = 1")).toEqual(true);
    // 待支付金额按人数合计；已支付后锁定修改与取消。
    expect(payment.includes("myRegistrationCount")).toEqual(true);
    expect(payment.includes("* Math.max(myRegistrationCount.value, 1)")).toEqual(true);
    expect(pageLogic.includes('"已支付的报名不可修改或取消"')).toEqual(true);
    expect(pageLogic.includes('"已支付的报名不可修改"')).toEqual(false);
  });

  test("confirms individual signup and cancellation before submitting", async () => {
    const pageLogic = await matchDetailLogicSource();
    const detail = await sourceFile(
      "pages/matches/detail.vue",
    ).text();

    expect(pageLogic.includes("function confirmRegistrationAction")).toEqual(true);
    expect(pageLogic.includes("useNeoConfirmDialog")).toEqual(true);
    expect(pageLogic.includes("uni.showModal")).toEqual(false);
    expect(detail.includes("<NeoConfirmDialog")).toEqual(true);
    expect(pageLogic.includes('title: "确认报名"')).toEqual(true);
    expect(pageLogic.includes('title: "确认取消报名"')).toEqual(true);
    expect(pageLogic.includes("const confirmed = await confirmRegistrationAction")).toEqual(true);
    expect(pageLogic.includes("if (!confirmed) return;")).toEqual(true);
    expect(pageLogic.includes("highlight: match.value.name")).toEqual(true);
    expect(detail.includes(':highlight="confirmDialogState.highlight"')).toEqual(true);
  });

  test("updates individual registration locally instead of reloading the whole page", async () => {
    const pageLogic = await matchDetailLogicSource();

    expect(pageLogic.includes("function applyIndividualRegistrationState")).toEqual(true);
    expect(pageLogic.includes("applyIndividualRegistrationState(1, 1)")).toEqual(true);
    expect(pageLogic.includes("applyIndividualRegistrationState(0, 0)")).toEqual(true);
    expect(pageLogic.includes("currentStatus.value = toStandLabel(stand);")).toEqual(true);
  });

  test("loads the team roster for match API details so the member status board renders", async () => {
    const facade = await sourceFile("pages/matches/useMatchDetailPage.ts").text();

    expect(facade.includes("if (isMatchApiDetail.value) {")).toEqual(false);
    expect(facade.includes("currentTeamMembers.value = context.currentTeamMembers;")).toEqual(true);
  });

  test("uses a custom confirm dialog for team member registration choices", async () => {
    const detail = await sourceFile(
      "pages/matches/detail.vue",
    ).text();
    const individual = await sourceFile(
      "pages/matches/components/MatchIndividualRegistration.vue",
    ).text();
    const board = await sourceFile(
      "pages/matches/components/TeamMemberRegistrationBoard.vue",
    ).text();

    expect(detail.includes("<page-meta")).toEqual(true);
    // 主题变量覆盖与弹窗滚动锁定合并进同一个 metaPageStyle computed。
    expect(detail.includes("const metaPageStyle = computed(() =>")).toEqual(true);
    expect(detail.includes("teamMemberDialogVisible.value || confirmDialogVisible.value || finishDialogVisible.value || cancelDialogVisible.value || signupSheetVisible.value")).toEqual(true);
    expect(detail.includes('"overflow: hidden;"')).toEqual(true);
    expect(individual.includes('@dialog-visibility-change="handleTeamMemberDialogVisibilityChange"')).toEqual(true);
    expect(individual.includes('emit("dialogVisibilityChange", visible);')).toEqual(true);
    expect(board.includes("NeoStickyActionBar")).toEqual(true);
    expect(board.includes("NeoButton")).toEqual(true);
    expect(board.includes("statusDialogMode")).toEqual(true);
    expect(board.includes("statusDialogConfig")).toEqual(true);
    expect(board.includes("team-member-dialog-mask")).toEqual(true);
    expect(board.includes("team-member-dialog-actions")).toEqual(true);
    expect(board.includes('emit("dialogVisibilityChange", true);')).toEqual(true);
    expect(board.includes('emit("dialogVisibilityChange", false);')).toEqual(true);
    expect(board.includes('title: "选择报名状态"')).toEqual(true);
    expect(board.includes('secondaryText: "请假"')).toEqual(true);
    expect(board.includes('primaryText: "报名"')).toEqual(true);
    expect(board.includes('primaryText: "取消报名"')).toEqual(true);
    expect(board.includes("handleDialogPrimaryAction")).toEqual(true);
    expect(board.includes("handleDialogSecondaryAction")).toEqual(true);
    expect(board.includes("handleSelectStand(2)")).toEqual(true);
    expect(board.includes('import { useDialog } from "@wot-ui/ui";')).toEqual(false);
    expect(board.includes("<wd-dialog")).toEqual(false);
    expect(board.includes(".confirm({")).toEqual(false);
    expect(board.includes("wd-message-box")).toEqual(false);
  });

  test("turns the lower team member area into a switchable status operation panel", async () => {
    const board = await sourceFile(
      "pages/matches/components/TeamMemberRegistrationBoard.vue",
    ).text();

    expect(board.includes('const selectedGroup = ref<MemberGroupKey>("joined");')).toEqual(true);
    expect(board.includes("selectedGroup.value = value;")).toEqual(true);
    expect(board.includes("const memberSummaryLabel = computed")).toEqual(true);
    expect(board.includes('return `${total}人`;')).toEqual(true);
    expect(board.includes('<text class="section-title">队员状态</text>')).toEqual(true);
    expect(board.includes("member-segment")).toEqual(true);
    expect(board.includes("member-segment-item")).toEqual(true);
    expect(board.includes("member-segment-item-active")).toEqual(true);
    expect(board.includes("handleSelectGroup(section.key)")).toEqual(true);
    expect(board.includes("const activeSection = computed")).toEqual(true);
    expect(board.includes("activeSection.members.length")).toEqual(true);
    expect(board.includes("activeMemberAvatarItems")).toEqual(true);
    expect(board.includes("selectedMember?.group === activeSection.key")).toEqual(true);
    expect(board.includes("member-panel")).toEqual(true);
    expect(board.includes("member-panel-title")).toEqual(true);
    expect(board.includes("member-panel-count")).toEqual(true);
    expect(board.includes("member-status-column")).toEqual(false);
  });

  test("shows required players as the minimum threshold without capping signups", async () => {
    const pageLogic = await matchDetailLogicSource();
    const statusCard = await sourceFile(
      "pages/matches/components/MatchRegistrationStatusCard.vue",
    ).text();

    expect(pageLogic.includes("requiredPlayers.value + 2")).toEqual(false);
    expect(pageLogic.includes("isAtRegistrationCapacity")).toEqual(false);
    expect(pageLogic.includes('title: "本场已满员"')).toEqual(false);
    expect(pageLogic.includes("maxPlayersForActivity")).toEqual(false);
    expect(pageLogic.includes("joinedRegistrations.value.map((item) =>")).toEqual(false);
    expect(pageLogic.includes("joinedRegistrations.value.slice(0, 5)")).toEqual(false);
    expect(pageLogic.includes("const maxPlayers = computed")).toEqual(true);
    expect(pageLogic.includes("buildRegistrationProgress")).toEqual(false);
    expect(statusCard.includes(':max="maxPlayers"')).toEqual(true);
    expect(statusCard.includes("handleSelectParticipant")).toEqual(true);
    expect(statusCard.includes("selectedParticipant")).toEqual(true);
    expect(statusCard.includes("NeoProgress")).toEqual(true);
    expect(statusCard.includes("NeoAvatarStack")).toEqual(true);
    const state = await sourceFile(
      "pages/matches/detailState.ts",
    ).text();
    expect(state.includes('"已达成行人数"')).toEqual(true);
    expect(state.includes("maxPlayers?: number")).toEqual(true);
    expect(state.includes("const target =")).toEqual(true);
    expect(state.includes("overflowVisualWidth")).toEqual(false);
    expect(state.includes("const splitPercent = 82")).toEqual(false);
  });

  test("orders match registration avatars by registration time consistently", async () => {
    const pageLogic = await matchDetailLogicSource();
    const state = await sourceFile(
      "pages/matches/detailState.ts",
    ).text();

    expect(state.includes("export function byRegistrationTimeAsc")).toEqual(true);
    expect(state.includes("operation_time")).toEqual(true);
    expect(pageLogic.includes("joinedRegistrations.value.map((item) =>")).toEqual(false);
    expect(pageLogic.includes("sort(byRegistrationTimeAsc).map((item) =>")).toEqual(true);
    expect(pageLogic.includes("activeTeamMembers.value.filter((member) => registrationByUserId.value[member.user_id]?.stand === 1).map(toCard)")).toEqual(false);
    expect(state.includes(".sort(byMemberRegistrationTimeAsc)")).toEqual(true);
    expect(pageLogic.includes("buildTeamMemberRegistrationGroups({")).toEqual(true);
  });

  test("renders team member status avatars without selection borders", async () => {
    const board = await sourceFile(
      "pages/matches/components/TeamMemberRegistrationBoard.vue",
    ).text();

    expect(board.includes("NeoAvatarStack")).toEqual(true);
    expect(board.includes("border: 4rpx solid #ffffff")).toEqual(false);
    expect(board.includes("border-color: #171717")).toEqual(false);
    expect(board.includes("member-avatar-current .member-avatar")).toEqual(false);
  });

  test("keeps match information visible after manual logout and gates only signup", async () => {
    const pageLogic = await matchDetailLogicSource();
    const statusCard = await sourceFile(
      "pages/matches/components/MatchRegistrationStatusCard.vue",
    ).text();

    expect(pageLogic.includes('import { hasManualLogout } from "@/utils/authStorage";')).toEqual(true);
    expect(pageLogic.includes('const isGuestMode = ref(false);')).toEqual(true);
    expect(pageLogic.includes('if (isGuestMode.value) return "登录后报名";')).toEqual(true);
    expect(statusCard.includes("isGuestMode")).toEqual(true);
    expect(pageLogic.indexOf("const publicData = await loadPublicMatchDetailData(matchId.value);") < pageLogic.indexOf("await ensureSessionReady();")).toEqual(
      true,
    );
    expect(pageLogic.includes("async function handleGuestLogin")).toEqual(true);
    expect(pageLogic.includes("resumeSessionBootstrap();")).toEqual(true);
    expect(pageLogic.includes("await refreshSessionContext();")).toEqual(true);
    expect(pageLogic.includes('uni.switchTab({ url: "/pages/user/index" });')).toEqual(true);
    expect(pageLogic.includes("await handleGuestLogin();")).toEqual(true);
  });

  test("enables WeChat sharing for match and challenge registration detail pages", async () => {
    const matchDetail = await sourceFile(
      "pages/matches/detail.vue",
    ).text();
    const matchPageLogic = await matchDetailLogicSource();
    const challengeDetail = await sourceFile(
      "pages/challenges/detail.vue",
    ).text();
    const shareUtils = await sourceFile(
      "utils/share.ts",
    ).text();

    expect(matchDetail.includes("onShareAppMessage")).toEqual(true);
    expect(matchDetail.includes("onShareTimeline")).toEqual(true);
    expect(matchDetail.includes("path: sharePath.value")).toEqual(true);
    expect(matchDetail.includes("imageUrl: DEFAULT_SHARE_IMAGE_URL")).toEqual(true);
    expect(matchDetail.includes("query: `id=${matchId.value || match.value?.id || \"\"}`")).toEqual(true);
    expect(matchPageLogic.includes("matchId,")).toEqual(true);
    expect(challengeDetail.includes("onShareAppMessage")).toEqual(true);
    expect(challengeDetail.includes("onShareTimeline")).toEqual(true);
    expect(challengeDetail.includes("path: sharePath.value")).toEqual(true);
    expect(challengeDetail.includes("imageUrl: DEFAULT_SHARE_IMAGE_URL")).toEqual(true);
    expect(challengeDetail.includes("query: `id=${challengeId.value || card.value?.id || \"\"}`")).toEqual(true);
    expect(shareUtils.includes('"/static/share/share-cover.png"')).toEqual(true);
  });

  test("labels individual challenge countdown by match start because challenge has no registration deadline field", async () => {
    const individualRegistration = await sourceFile(
      "pages/challenges/components/ChallengeIndividualRegistration.vue",
    ).text();

    expect(individualRegistration.includes("开场倒计时")).toEqual(true);
    expect(individualRegistration.includes("报名截止")).toEqual(false);
  });

  test("blocks new individual signup when the activity team capacity limit is full", async () => {
    const pageLogic = await matchDetailLogicSource();
    const state = await sourceFile(
      "pages/matches/detailState.ts",
    ).text();
    const statusCard = await sourceFile(
      "pages/matches/components/MatchRegistrationStatusCard.vue",
    ).text();

    expect(state.includes("resolveRegistrationCapacityState")).toEqual(true);
    expect(state.includes("teamCapacityLimit")).toEqual(true);
    expect(pageLogic.includes("const registrationCapacityState = computed")).toEqual(true);
    expect(pageLogic.includes("match.value?.team_capacity_limit")).toEqual(true);
    expect(pageLogic.includes("registrationCapacityState.value.isFull")).toEqual(true);
    expect(pageLogic.includes('title: "报名人数已满"')).toEqual(true);
    expect(pageLogic.includes("canSubmitIndividualRegistration")).toEqual(true);
    expect(statusCard.includes(":disabled=\"ctaDisabled\"")).toEqual(true);
  });

  test("decouples team application management from the team registration tab", async () => {
    const pageLogic = await sourceFile("pages/matches/useMatchDetailPage.ts").text();
    const detailData = await sourceFile("pages/matches/detailData.ts").text();
    const detailPage = await sourceFile("pages/matches/detail.vue").text();
    const applications = await sourceFile(
      "pages/matches/useMatchTeamApplications.ts",
    ).text();

    // 申请管理是主队管理功能：只看 canManageApplications，不再依赖“球队报名”标签（Go 比赛没有该标签）。
    expect(detailPage.includes('v-if="registrationMode === \'team\' && canManageApplications"')).toEqual(false);
    expect(detailPage.includes('v-if="canManageApplications"')).toEqual(true);
    // 数据层把新比赛接口的原始对象带出来，供 publication_mode / opponent_state 判定。
    expect(detailData.includes("sourceMatch: AppMatchSummary | null")).toEqual(true);
    expect(detailData.includes("sourceMatch: matchDetail.match")).toEqual(true);
    expect(detailData.includes("sourceMatch: null")).toEqual(true);
    expect(pageLogic.includes("sourceMatch.value = publicData.sourceMatch")).toEqual(true);
    expect(detailPage.includes("useMatchTeamApplications(sourceMatch, loadPageData, confirmRegistrationAction)")).toEqual(true);
    expect(applications.includes("isRecruitingTeamMatchSource(sourceMatch.value)")).toEqual(true);
  });

  test("hides registration status actions after the registration deadline", async () => {
    const pageLogic = await sourceFile("pages/matches/useMatchDetailPage.ts").text();
    const detailPage = await sourceFile("pages/matches/detail.vue").text();
    const individual = await sourceFile("pages/matches/components/MatchIndividualRegistration.vue").text();
    const board = await sourceFile("pages/matches/components/TeamMemberRegistrationBoard.vue").text();

    // 未开始或截止后都不支持修改报名状态：报名/取消报名/状态调整入口全部隐藏。
    expect(pageLogic.includes("const isRegistrationClosed = computed")).toEqual(true);
    expect(pageLogic.includes("const registrationWindowState = computed")).toEqual(true);
    expect(pageLogic.includes('isRegistering: sourceMatch.value.status === "registering"')).toEqual(true);
    expect(pageLogic.includes('registrationWindowState.value !== "open"')).toEqual(true);
    expect(detailPage.includes(":registration-closed=\"isRegistrationClosed\"")).toEqual(true);
    expect(detailPage.includes("canUseTeamRegistration && !isRegistrationClosed")).toEqual(true);
    expect(individual.includes(":show-cta=\"!showTeamMemberRegistrationBoard && !registrationClosed\"")).toEqual(true);
    expect(individual.includes(':registration-closed="registrationClosed"')).toEqual(true);
    expect(board.includes('<NeoStickyActionBar v-if="!registrationClosed">')).toEqual(true);
  });

  test("labels the hosting team from the match itself, not the current team", async () => {
    const pageLogic = await sourceFile("pages/matches/useMatchDetailPage.ts").text();

    // 接约进入别人的线上约队时，主队必须是发起方（host_team_name），不能显示当前球队。
    expect(pageLogic.includes("sourceMatch.value?.host_team_name || currentTeam.value?.name || \"主队\"")).toEqual(true);
    // 刚报名时接口数据里还没有自己，头像/昵称回退到会话资料，报名成功立即可见。
    expect(pageLogic.includes("item.user_id === currentUser.value?.id ? currentUser.value : undefined")).toEqual(true);
  });

  test("shows both team progress bars for online team matches", async () => {
    const pageLogic = await sourceFile("pages/matches/useMatchDetailPage.ts").text();
    const detailData = await sourceFile("pages/matches/detailData.ts").text();
    const detailPage = await sourceFile("pages/matches/detail.vue").text();
    const individual = await sourceFile("pages/matches/components/MatchIndividualRegistration.vue").text();
    const statusCard = await sourceFile("pages/matches/components/MatchRegistrationStatusCard.vue").text();

    // 数据链路：主/客队分组从接口带到页面（host_team + guest_team）。
    expect(detailData.includes("toTeamGroupSummaries")).toEqual(true);
    expect(detailData.includes('group.kind === "host_team" || group.kind === "guest_team"')).toEqual(true);
    expect(detailData.includes("teamGroups: []")).toEqual(true);
    expect(pageLogic.includes("matchTeamGroups.value = publicData.teamGroups")).toEqual(true);
    expect(pageLogic.includes('match.publication_mode !== "online_team"')).toEqual(true);
    expect(pageLogic.includes("group.kind === \"host_team\"")).toEqual(true);
    expect(detailPage.includes(':team-progress="teamProgressItems"')).toEqual(true);
    expect(individual.includes(':team-progress="teamProgress"')).toEqual(true);
    // 状态卡：双边进度替代单条进度与“已报”计数。
    expect(statusCard.includes('v-for="team in teamProgress"')).toEqual(true);
    expect(statusCard.includes('v-if="!hasTeamProgress" class="status-total"')).toEqual(true);
    expect(statusCard.includes('v-else\n        :value="joinedCount"')).toEqual(true);
  });
});
