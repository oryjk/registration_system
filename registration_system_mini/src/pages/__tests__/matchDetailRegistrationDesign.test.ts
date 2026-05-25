import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("match detail registration design", () => {
  test("uses an in-page segmented layout for individual and team registration", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();
    const pageLogic = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/useMatchDetailPage.ts",
    ).text();

    expect(pageLogic.includes("const registrationMode = ref<\"individual\" | \"team\">(\"individual\");")).toEqual(true);
    expect(source.includes("个人报名")).toEqual(true);
    expect(source.includes("球队报名")).toEqual(true);
    expect(source.includes("registration-segment")).toEqual(true);
    expect(source.includes("registrationMode === 'individual'")).toEqual(true);
    expect(source.includes("registrationMode === 'team'")).toEqual(true);
  });

  test("renders the individual registration view with countdown, guide card, interest cards, and a primary CTA", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();
    const individual = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/MatchIndividualRegistration.vue",
    ).text();
    const countdown = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/IndividualCountdownCard.vue",
    ).text();
    const info = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/IndividualInfoCard.vue",
    ).text();
    const interest = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/InterestMatchGrid.vue",
    ).text();

    expect(source.includes("MatchIndividualRegistration")).toEqual(true);
    expect(individual.includes("IndividualCountdownCard")).toEqual(true);
    expect(countdown.includes("报名截止")).toEqual(true);
    expect(interest.includes("你可能感兴趣")).toEqual(true);
    expect(info.includes("比赛说明")).toEqual(true);
    expect(countdown.includes("individual-cta-button")).toEqual(true);
    expect(source.includes("interestCards")).toEqual(true);
  });

  test("uses activity registration deadline for the countdown and holding date for match clock", async () => {
    const pageLogic = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/useMatchDetailPage.ts",
    ).text();
    const datetime = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/utils/datetime.ts",
    ).text();

    expect(pageLogic.includes("const registrationDeadlineTimestamp = computed")).toEqual(true);
    expect(pageLogic.includes("parseDateValue(match.value.end_time || match.value.holding_date).getTime()")).toEqual(true);
    expect(pageLogic.includes("formatCountdown(registrationDeadlineTimestamp.value - nowTick.value)")).toEqual(true);
    expect(pageLogic.includes("formatClock(match.value.holding_date)")).toEqual(true);
    expect(pageLogic.includes("formatClock(match.value.start_time)")).toEqual(false);
    expect(datetime.includes('if (distance <= 0) return "已截止";')).toEqual(true);
  });

  test("renders the team registration view with versus header, registration form, and a team submit bar", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();
    const team = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/MatchTeamRegistration.vue",
    ).text();
    const teamHero = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/TeamRegistrationHero.vue",
    ).text();
    const teamForm = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/TeamRegistrationFormCard.vue",
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
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();
    const pageLogic = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/useMatchDetailPage.ts",
    ).text();
    const actions = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detailActions.ts",
    ).text();

    expect(pageLogic.includes("submitTeamRegistrationForMatch")).toEqual(true);
    expect(pageLogic.includes("submitMatchCheckIn")).toEqual(true);
    expect(actions.includes("submitTeamRegistration")).toEqual(true);
    expect(actions.includes("submitActivityCheckIn")).toEqual(true);
    expect(pageLogic.includes("ensureCurrentLocation")).toEqual(true);
    expect(source.includes("队长代报名接口待接入")).toEqual(false);
  });

  test("lets team managers choose the team registration size before submitting", async () => {
    const pageLogic = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/useMatchDetailPage.ts",
    ).text();
    const actions = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detailActions.ts",
    ).text();

    expect(pageLogic.includes("const teamRegistrationCount = ref(5);")).toEqual(true);
    expect(pageLogic.includes("const teamRegistrationCountOptions = Array.from")).toEqual(true);
    expect(pageLogic.includes("submitTeamRegistrationForMatch")).toEqual(true);
    expect(actions.includes("registration_count: registrationCount")).toEqual(true);
    expect(actions.includes("submitTeamRegistration")).toEqual(true);
  });

  test("lets individual users cancel an existing registration from the primary CTA", async () => {
    const pageLogic = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/useMatchDetailPage.ts",
    ).text();

    expect(pageLogic.includes('currentStatus.value === "参加" ? "取消报名" : "立即报名"')).toEqual(true);
    expect(pageLogic.includes("handleCancelIndividualSignup")).toEqual(true);
    expect(pageLogic.includes("cancelIndividualRegistration")).toEqual(true);
    expect(pageLogic.includes('title: "已取消报名"')).toEqual(true);
    expect(pageLogic.includes("你已经报过名了")).toEqual(false);
  });

  test("confirms individual signup and cancellation before submitting", async () => {
    const pageLogic = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/useMatchDetailPage.ts",
    ).text();

    expect(pageLogic.includes("function confirmRegistrationAction")).toEqual(true);
    expect(pageLogic.includes('title: "确认报名"')).toEqual(true);
    expect(pageLogic.includes('title: "确认取消报名"')).toEqual(true);
    expect(pageLogic.includes("const confirmed = await confirmRegistrationAction")).toEqual(true);
    expect(pageLogic.includes("if (!confirmed) return;")).toEqual(true);
  });

  test("updates individual registration locally instead of reloading the whole page", async () => {
    const pageLogic = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/useMatchDetailPage.ts",
    ).text();

    expect(pageLogic.includes("function applyIndividualRegistrationState")).toEqual(true);
    expect(pageLogic.includes("applyIndividualRegistrationState(1, 1)")).toEqual(true);
    expect(pageLogic.includes("applyIndividualRegistrationState(0, 0)")).toEqual(true);
    expect(pageLogic.includes("currentStatus.value = toStandLabel(stand);")).toEqual(true);
  });

  test("uses a custom confirm dialog for team member registration choices", async () => {
    const detail = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();
    const individual = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/MatchIndividualRegistration.vue",
    ).text();
    const board = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/TeamMemberRegistrationBoard.vue",
    ).text();

    expect(detail.includes("<page-meta")).toEqual(true);
    expect(detail.includes("teamMemberDialogVisible ? 'overflow: hidden;' : ''")).toEqual(true);
    expect(individual.includes('@dialog-visibility-change="handleTeamMemberDialogVisibilityChange"')).toEqual(true);
    expect(individual.includes('emit("dialogVisibilityChange", visible);')).toEqual(true);
    expect(board.includes("member-floating-action")).toEqual(true);
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
    const board = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/TeamMemberRegistrationBoard.vue",
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
    expect(board.includes("v-for=\"member in activeSection.members\"")).toEqual(true);
    expect(board.includes("selectedMember?.group === activeSection.key")).toEqual(true);
    expect(board.includes("member-panel")).toEqual(true);
    expect(board.includes("member-panel-title")).toEqual(true);
    expect(board.includes("member-panel-count")).toEqual(true);
    expect(board.includes("member-status-column")).toEqual(false);
  });

  test("shows required players as the minimum threshold without capping signups", async () => {
    const pageLogic = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/useMatchDetailPage.ts",
    ).text();
    const countdown = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/IndividualCountdownCard.vue",
    ).text();

    expect(pageLogic.includes("requiredPlayers.value + 2")).toEqual(false);
    expect(pageLogic.includes("isAtRegistrationCapacity")).toEqual(false);
    expect(pageLogic.includes('title: "本场已满员"')).toEqual(false);
    expect(pageLogic.includes("joinedRegistrations.value.map((item) =>")).toEqual(true);
    expect(pageLogic.includes("joinedRegistrations.value.slice(0, 5)")).toEqual(false);
    expect(countdown.includes("countdown-progress-meta")).toEqual(true);
    expect(countdown.includes("avatar-wall")).toEqual(true);
    expect(countdown.includes("handleSelectParticipant")).toEqual(true);
    expect(countdown.includes("selectedParticipant")).toEqual(true);
    expect(countdown.includes("mini-avatar-selected")).toEqual(true);
    expect(countdown.includes("countdown-selected-participant")).toEqual(true);
    expect(countdown.includes("countdown-selected-name")).toEqual(true);
    expect(countdown.includes("countdown-selected-avatar")).toEqual(false);
    const state = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detailState.ts",
    ).text();
    expect(state.includes('"已达成行人数"')).toEqual(true);
    expect(state.includes("overflowVisualWidth")).toEqual(true);
  });

  test("renders team member status avatars without selection borders", async () => {
    const board = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/TeamMemberRegistrationBoard.vue",
    ).text();

    expect(board.includes("member-avatar-selected")).toEqual(true);
    expect(board.includes("border: 4rpx solid #ffffff")).toEqual(false);
    expect(board.includes("border-color: #171717")).toEqual(false);
    expect(board.includes("member-avatar-current .member-avatar")).toEqual(false);
  });

  test("keeps match information visible after manual logout and gates only signup", async () => {
    const pageLogic = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/useMatchDetailPage.ts",
    ).text();
    const individual = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/components/IndividualCountdownCard.vue",
    ).text();

    expect(pageLogic.includes('import { hasManualLogout } from "@/utils/authStorage";')).toEqual(true);
    expect(pageLogic.includes('const isGuestMode = ref(false);')).toEqual(true);
    expect(pageLogic.includes('if (isGuestMode.value) return "登录后报名";')).toEqual(true);
    expect(individual.includes('<text v-if="!isGuestMode" class="individual-cta-side">免费</text>')).toEqual(true);
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
    const matchDetail = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();
    const matchPageLogic = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/useMatchDetailPage.ts",
    ).text();
    const challengeDetail = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/challenges/detail.vue",
    ).text();
    const shareUtils = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/utils/share.ts",
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
    const individualRegistration = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/challenges/components/ChallengeIndividualRegistration.vue",
    ).text();

    expect(individualRegistration.includes("开场倒计时")).toEqual(true);
    expect(individualRegistration.includes("报名截止")).toEqual(false);
  });
});
