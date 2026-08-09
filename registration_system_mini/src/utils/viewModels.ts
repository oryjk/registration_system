import type {
  BackendActivity,
  BackendBillingFlowResult,
  BackendChallengeSummary,
  BackendNotification,
  BackendRegistration,
  BackendTeam,
  BackendTeamCreditTransaction,
  BackendTeamDetail,
  BackendUserAccount,
  BackendUserActivityRecord,
  BackendUserAttendanceRecord,
  BackendUser,
} from "@/types/backend";
import type {
  AttendanceSummaryViewModel,
  BillingSummaryViewModel,
  ChallengeCardViewModel,
  HomeMatchCardViewModel,
  NotificationItemViewModel,
  TeamProfileViewModel,
} from "@/types/viewModels";
import type { AppMatchUiPhase } from "@/types/match";
import {
  formatDateLabel,
  formatDayNumberLabel,
  formatMonthDayLabel,
  formatTimeRangeLabel,
  formatWeekdayLabel,
} from "@/utils/datetime";

function toRoleLabel(role: string): string {
  switch (role) {
    case "captain":
      return "队长";
    case "leader":
      return "领队";
    case "vice_captain":
      return "副队长";
    default:
      return "队员";
  }
}

function pickFirstNonEmpty(values: Array<string | null | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

type VisibleHomeMatchPhase = Exclude<AppMatchUiPhase, "excluded">;

function attachLegacyHomeMatchMeta<T extends HomeMatchCardViewModel>(
  card: T,
): T {
  Object.defineProperties(card, {
    phase: { value: card.phase, enumerable: false, writable: true, configurable: true },
    dateNote: { value: card.dateNote, enumerable: false, writable: true, configurable: true },
    showRegistrationProgress: {
      value: card.showRegistrationProgress,
      enumerable: false,
      writable: true,
      configurable: true,
    },
    showParticipantAvatars: {
      value: card.showParticipantAvatars,
      enumerable: false,
      writable: true,
      configurable: true,
    },
    canOpenDetail: { value: card.canOpenDetail, enumerable: false, writable: true, configurable: true },
  });
  return card;
}

function toLegacyHomeMatchPhase(status: number): VisibleHomeMatchPhase {
  if (status === 1) return "ongoing";
  if (status === 2 || status === 3) return "ended";
  return "upcoming";
}

export function toStandLabel(stand: number): string {
  switch (stand) {
    case 1:
      return "参加";
    case 2:
      return "请假";
    case 3:
      return "缺席";
    default:
      return "待定";
  }
}

export function toActivityStatusLabel(status: number): string {
  switch (status) {
    case 1:
      return "进行中";
    case 2:
      return "已结束";
    case 3:
      return "已取消";
    default:
      return "报名中";
  }
}

function formatCurrency(value: string | number | null | undefined): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return `¥${amount.toFixed(2)}`;
}

function formatCompactCurrency(value: string | number | null | undefined): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  if (Number.isInteger(amount)) {
    return `¥${amount.toFixed(0)}`;
  }
  return `¥${amount.toFixed(2).replace(/\.?0+$/, "")}`;
}

export function formatDateTimeLabel(isoText: string | null | undefined): string {
  if (!isoText) return "未开通";
  return formatDateLabel(isoText);
}

function avatarTone(userId: number): string {
  const palette = ["#111111", "#2a4cff", "#0f766e", "#7c3aed", "#ea580c", "#16a34a", "#be123c"];
  return palette[userId % palette.length];
}

export function resolveUserDisplayName(user: BackendUser | null | undefined): string {
  if (!user) {
    return "未登录";
  }

  return pickFirstNonEmpty([user.real_name, user.nickname, user.username]) || `用户 ${user.id}`;
}

export function resolveUserDisplayHandle(user: BackendUser | null | undefined): string {
  if (!user) {
    return "点击重试登录和刷新资料";
  }

  const nickname = pickFirstNonEmpty([user.nickname]);
  if (nickname) {
    return `@${nickname}`;
  }

  const username = pickFirstNonEmpty([user.username]);
  if (username) {
    return username;
  }

  return "已登录，待补充昵称或姓名";
}

export function formatCreditTransactionLabel(
  transaction: BackendTeamCreditTransaction,
): string {
  switch (transaction.transaction_type) {
    case "match_review":
      return `赛后互评 +${transaction.delta}`;
    case "membership_recharge":
      return `会员充值 +${transaction.delta}`;
    case "manual_penalty":
      return `信用罚扣 ${transaction.delta}`;
    default:
      return `信用变动 ${transaction.delta > 0 ? "+" : ""}${transaction.delta}`;
  }
}

export function buildTeamProfiles(
  currentUserId: number,
  teams: BackendTeam[],
  detailsByTeamId: Record<string, BackendTeamDetail>,
): TeamProfileViewModel[] {
  return teams.map((team) => {
    const detail = detailsByTeamId[team.id];
    const selfMember = detail?.members.find((member) => member.user_id === currentUserId);
    const myRole = selfMember?.role ?? team.my_role ?? (team.captain_id === currentUserId ? "captain" : "member");

    return {
      id: team.id,
      name: team.name,
      description: team.description ?? "",
      logoUrl: team.logo_url ?? "",
      status: team.status,
      memberCount: detail?.members.length ?? team.member_count ?? 0,
      myRole,
      myRoleLabel: toRoleLabel(myRole),
      joinedAt: selfMember?.joined_at ?? team.joined_at ?? "",
      isCaptain: myRole === "captain",
      canManageTeam: myRole === "captain" || myRole === "leader",
      creditScore: team.credit_score,
      trustLabel: team.trust_label,
      vipUntil: formatDateTimeLabel(team.vip_until),
      isVip: team.is_vip,
    };
  });
}

export function buildHomeMatchCards({
  teamId,
  activities,
  myActivityRecords,
  registrationsByActivityId,
  teamRegistrationCountsByActivityId,
  usersById,
  limit,
}: {
  teamId: number;
  activities: BackendActivity[];
  myActivityRecords: BackendUserActivityRecord[];
  registrationsByActivityId: Record<string, BackendRegistration[]>;
  teamRegistrationCountsByActivityId?: Record<string, number>;
  usersById?: Record<number, BackendUser>;
  limit?: number;
}): HomeMatchCardViewModel[] {
  const myRecordByActivityId = Object.fromEntries(
    myActivityRecords.map((item) => [item.activity_id, item]),
  );

  return activities
    .filter((activity) => activity.home_team_id === teamId || activity.away_team_id === teamId)
    .sort((left, right) => left.holding_date.localeCompare(right.holding_date))
    .slice(0, limit ?? activities.length)
    .map((activity) => {
      const registrations = registrationsByActivityId[activity.id] ?? [];
      const individualJoinedPlayers = registrations.filter((item) => item.stand === 1).length;
      const teamJoinedPlayers = activity.source_activity_id
        ? 0
        : (teamRegistrationCountsByActivityId?.[activity.id] ?? 0);
      const joinedPlayers = individualJoinedPlayers + teamJoinedPlayers;
      const absentPlayers = registrations.filter((item) => item.stand === 2).length;
      const latePlayers = registrations.filter((item) => item.stand === 3).length;
      const pendingPlayers = registrations.filter((item) => item.stand !== 1 && item.stand !== 2 && item.stand !== 3).length;
      const requiredPlayers = activity.players_per_team ?? 0;
      const signupScope = activity.source_activity_id ? "internal" : "external";
      const myStatus = toStandLabel(myRecordByActivityId[activity.id]?.stand ?? 0);
      const remainingPlayers = Math.max(requiredPlayers - joinedPlayers, 0);
      const phase = toLegacyHomeMatchPhase(activity.status);
      const participantAvatars = registrations
        .filter((item) => item.stand === 1)
        .slice(0, 5)
        .map((item) => {
          const user = usersById?.[item.user_id];
          const displayName = pickFirstNonEmpty([user?.real_name, user?.nickname, user?.username]) || `U${item.user_id}`;
          return {
            userId: item.user_id,
            avatarUrl: user?.avatar_url ?? "",
            displayText: displayName.slice(0, 1),
            tone: avatarTone(item.user_id),
          };
        });

      return attachLegacyHomeMatchMeta({
        id: activity.id,
        detailUrl: `/pages/matches/detail?id=${activity.id}`,
        title: activity.name,
        dateLabel: formatDateLabel(activity.holding_date),
        phase,
        dateNote: phase === "ended" ? "比赛已结束" : phase === "ongoing" ? "报名已结束" : "截止报名",
        showRegistrationProgress: phase !== "ended",
        showParticipantAvatars: phase !== "ended",
        canOpenDetail: true,
        stage: toActivityStatusLabel(activity.status),
        signupScope,
        signupScopeLabel: signupScope === "internal" ? "队内报名" : "比赛报名",
        venue: activity.location,
        opponent: activity.opposing?.trim() || "待定",
        formatLabel: requiredPlayers > 0 ? `${requiredPlayers} 人制` : "人数待定",
        requiredPlayers,
        maxPlayers: Math.max(activity.team_capacity_limit ?? requiredPlayers, requiredPlayers),
        joinedPlayers,
        absentPlayers,
        latePlayers,
        pendingPlayers,
        myStatus,
        highlight:
          requiredPlayers > 0
            ? remainingPlayers > 0
              ? `当前 ${joinedPlayers} 人参加，还差 ${remainingPlayers} 人成行`
              : "已达成行人数，仍可继续报名"
            : `当前 ${joinedPlayers} 人参加`,
        participantAvatars,
        remainingPlayersLabel: remainingPlayers > 0 ? `还差 ${remainingPlayers} 人成行` : "已达成行",
        canRegister: true,
      });
    });
}

export function buildPublicHomeMatchCards({
  activities,
  myActivityRecords,
  registrationsByActivityId,
  teamRegistrationCountsByActivityId,
  usersById,
  defaultStatusLabel = "待登录",
  limit,
}: {
  activities: BackendActivity[];
  myActivityRecords?: BackendUserActivityRecord[];
  registrationsByActivityId: Record<string, BackendRegistration[]>;
  teamRegistrationCountsByActivityId?: Record<string, number>;
  usersById?: Record<number, BackendUser>;
  defaultStatusLabel?: string;
  limit?: number;
}): HomeMatchCardViewModel[] {
  const myRecordByActivityId = Object.fromEntries(
    (myActivityRecords ?? []).map((item) => [item.activity_id, item]),
  );

  return activities
    .sort((left, right) => left.holding_date.localeCompare(right.holding_date))
    .slice(0, limit ?? activities.length)
    .map((activity) => {
      const registrations = registrationsByActivityId[activity.id] ?? [];
      const individualJoinedPlayers = registrations.filter((item) => item.stand === 1).length;
      const teamJoinedPlayers = activity.source_activity_id
        ? 0
        : (teamRegistrationCountsByActivityId?.[activity.id] ?? 0);
      const joinedPlayers = individualJoinedPlayers + teamJoinedPlayers;
      const absentPlayers = registrations.filter((item) => item.stand === 2).length;
      const latePlayers = registrations.filter((item) => item.stand === 3).length;
      const pendingPlayers = registrations.filter((item) => item.stand !== 1 && item.stand !== 2 && item.stand !== 3).length;
      const requiredPlayers = activity.players_per_team ?? 0;
      const signupScope = activity.source_activity_id ? "internal" : "external";
      const myRecord = myRecordByActivityId[activity.id];
      const myStatus = myRecord ? toStandLabel(myRecord.stand) : defaultStatusLabel;
      const remainingPlayers = Math.max(requiredPlayers - joinedPlayers, 0);
      const phase = toLegacyHomeMatchPhase(activity.status);
      const participantAvatars = registrations
        .filter((item) => item.stand === 1)
        .slice(0, 5)
        .map((item) => {
          const user = usersById?.[item.user_id];
          const displayName = pickFirstNonEmpty([user?.real_name, user?.nickname, user?.username]) || `U${item.user_id}`;
          return {
            userId: item.user_id,
            avatarUrl: user?.avatar_url ?? "",
            displayText: displayName.slice(0, 1),
            tone: avatarTone(item.user_id),
          };
        });

      return attachLegacyHomeMatchMeta({
        id: activity.id,
        detailUrl: `/pages/matches/detail?id=${activity.id}`,
        title: activity.name,
        dateLabel: formatDateLabel(activity.holding_date),
        phase,
        dateNote: phase === "ended" ? "比赛已结束" : phase === "ongoing" ? "报名已结束" : "截止报名",
        showRegistrationProgress: phase !== "ended",
        showParticipantAvatars: phase !== "ended",
        canOpenDetail: true,
        stage: toActivityStatusLabel(activity.status),
        signupScope,
        signupScopeLabel: signupScope === "internal" ? "队内报名" : "比赛报名",
        venue: activity.location,
        opponent: activity.opposing?.trim() || "待定",
        formatLabel: requiredPlayers > 0 ? `${requiredPlayers} 人制` : "人数待定",
        requiredPlayers,
        maxPlayers: requiredPlayers,
        joinedPlayers,
        absentPlayers,
        latePlayers,
        pendingPlayers,
        myStatus,
        highlight:
          requiredPlayers > 0
            ? remainingPlayers > 0
              ? `当前 ${joinedPlayers} 人参加，还差 ${remainingPlayers} 人成行`
              : "已达成行人数，仍可继续报名"
            : `当前 ${joinedPlayers} 人参加`,
        participantAvatars,
        remainingPlayersLabel: remainingPlayers > 0 ? `还差 ${remainingPlayers} 人成行` : "已达成行",
        canRegister: true,
      });
    });
}

function toIndividualChallengeStageLabel(status: string): string {
  switch (status) {
    case "matched":
      return "已成行";
    case "cancelled":
      return "已取消";
    default:
      return "报名中";
  }
}

export function buildJoinedIndividualHomeMatchCards({
  summaries,
  limit,
}: {
  summaries: BackendChallengeSummary[];
  limit?: number;
}): HomeMatchCardViewModel[] {
  return summaries
    .filter((summary) => summary.challenge.kind === "individual" && summary.current_user_joined && summary.challenge.status !== "cancelled")
    .sort((left, right) => left.challenge.holding_date.localeCompare(right.challenge.holding_date))
    .slice(0, limit ?? summaries.length)
    .map((summary) => {
      const minPlayers = challengeMinSignupPlayers(summary);
      const capacity = challengeSignupCapacity(summary);
      const joinedPlayers = summary.accepted_count;
      const remainingPlayers = Math.max(minPlayers - joinedPlayers, 0);
      const phase: VisibleHomeMatchPhase = summary.challenge.status === "matched" ? "ongoing" : "upcoming";

      return attachLegacyHomeMatchMeta({
        id: summary.challenge.id,
        detailUrl: `/pages/challenges/detail?id=${summary.challenge.id}`,
        title: summary.challenge.title,
        dateLabel: formatDateLabel(summary.challenge.holding_date),
        phase,
        dateNote: phase === "ongoing" ? "比赛进行中" : "截止报名",
        showRegistrationProgress: true,
        showParticipantAvatars: false,
        canOpenDetail: true,
        stage: toIndividualChallengeStageLabel(summary.challenge.status),
        signupScope: "external",
        signupScopeLabel: "散人报名",
        venue: summary.challenge.location,
        opponent: "散人局",
        formatLabel: `${summary.challenge.players_per_team} 人制`,
        requiredPlayers: minPlayers,
        maxPlayers: capacity,
        joinedPlayers,
        absentPlayers: 0,
        latePlayers: 0,
        pendingPlayers: 0,
        myStatus: "已报名",
        highlight: remainingPlayers > 0 ? `当前 ${joinedPlayers} 人报名，还差 ${remainingPlayers} 人成行` : "已成行",
        participantAvatars: [],
        remainingPlayersLabel: remainingPlayers > 0 ? `还差 ${remainingPlayers} 人` : "已成行",
        canRegister: true,
        actionLabel: "去查看",
      });
    });
}

export function buildAttendanceSummary(
  records: BackendUserAttendanceRecord[],
): AttendanceSummaryViewModel {
  const attended = records.filter((item) => item.stand === 1).length;
  const leave = records.filter((item) => item.stand === 2).length;
  const late = records.filter((item) => item.stand === 3).length;
  const pending = records.filter((item) => item.stand !== 1 && item.stand !== 2 && item.stand !== 3).length;
  const total = records.length;

  return {
    total,
    attended,
    leave,
    late,
    pending,
    attendanceRate: `${Math.round((attended / Math.max(total, 1)) * 100)}%`,
  };
}

export function buildBillingSummary(
  account: BackendUserAccount | null | undefined,
  billingFlow: BackendBillingFlowResult | null | undefined,
): BillingSummaryViewModel {
  return {
    balanceLabel: formatCurrency(account?.balance ?? billingFlow?.final_balance ?? 0),
    totalRechargeLabel: formatCurrency(account?.total_recharge ?? 0),
    totalExpenseLabel: formatCurrency(account?.total_expense ?? 0),
    totalPenaltyLabel: formatCurrency(account?.total_penalty ?? 0),
    latestRecordCount: billingFlow?.records.length ?? 0,
  };
}

function toChallengeStatusLabel(kind: "team" | "individual", status: string): string {
  switch (status) {
    case "matched":
      return kind === "individual" ? "已成行" : "已约成";
    case "cancelled":
      return "已取消";
    default:
      return kind === "individual" ? "可报名" : "可接约";
  }
}

function toChallengeRelationLabel(summary: BackendChallengeSummary): string {
  const { challenge, current_team_relation: relation, current_user_joined: currentUserJoined } = summary;
  if (challenge.kind === "individual") {
    if (currentUserJoined) {
      return "我已报名";
    }
    if (relation === "host") {
      return challenge.status === "matched" ? "我发起的散人局" : "我发布的散人局";
    }
    return challenge.status === "matched" ? "已成行" : "可报名";
  }

  if (relation === "host") {
    return challenge.host_team_id && challenge.accepted_by_user_id && !challenge.guest_team_id
      ? "等待对手"
      : challenge.status === "matched" ? "我发起的约队" : "我发布的约队";
  }
  if (relation === "guest") {
    return "我已接约";
  }
  return challenge.status === "matched" ? "约成可报名" : "可接约";
}

function toChallengeTone(status: string): "open" | "matched" | "cancelled" {
  switch (status) {
    case "matched":
      return "matched";
    case "cancelled":
      return "cancelled";
    default:
      return "open";
  }
}

function buildChallengeTags(summary: BackendChallengeSummary, relationLabel: string): string[] {
  if (summary.challenge.kind === "individual") {
    return [
      "散人局",
      `${summary.accepted_count}/${challengeMinSignupPlayers(summary)}成行`,
      `最多${challengeSignupCapacity(summary)}人`,
      relationLabel,
    ].filter((value, index, values) => !!value && values.indexOf(value) === index);
  }

  return [`${summary.challenge.players_per_team} 人制`, summary.host_team_trust_label, relationLabel].filter(
    (value, index, values) => !!value && values.indexOf(value) === index,
  );
}

function toChallengePrimaryActionLabel(summary: BackendChallengeSummary): string {
  if (summary.challenge.kind === "individual") {
    if (summary.current_user_joined) {
      return "取消报名";
    }
    if (summary.can_accept || summary.challenge.status === "open") {
      return "去报名";
    }
    return "看详情";
  }
  if (summary.challenge.activity_id && summary.challenge.status === "matched") {
    return "去报名";
  }
  if (summary.challenge.kind === "team" && summary.challenge.host_team_id && summary.challenge.accepted_by_user_id && !summary.challenge.guest_team_id) {
    return summary.current_team_relation === "host" ? "等待对手" : "去应战";
  }
  if (summary.can_accept) {
    return "去接约";
  }
  if (summary.challenge.status === "matched") {
    return "看赛程";
  }
  return "看详情";
}

function challengeSignupCapacity(summary: BackendChallengeSummary): number {
  return summary.challenge.kind === "individual"
    ? summary.challenge.max_players ?? summary.challenge.players_per_team * 2 + 4
    : summary.challenge.players_per_team;
}

function challengeMinSignupPlayers(summary: BackendChallengeSummary): number {
  return summary.challenge.kind === "individual"
    ? summary.challenge.min_players ?? summary.challenge.players_per_team * 2
    : summary.challenge.players_per_team;
}

export function buildChallengeCards(
  summaries: BackendChallengeSummary[],
): ChallengeCardViewModel[] {
  return summaries.map((summary) => {
    const relationLabel = toChallengeRelationLabel(summary);
    const isIndividual = summary.challenge.kind === "individual";
    const capacity = challengeSignupCapacity(summary);
    const minPlayers = challengeMinSignupPlayers(summary);

    return {
      id: summary.challenge.id,
      title: summary.challenge.title,
      kind: summary.challenge.kind,
      hostTeamName: isIndividual ? "散人约球" : summary.host_team_name,
      creditScore: summary.host_team_credit_score,
      trustLabel: summary.host_team_trust_label,
      dateLabel: formatDateLabel(summary.challenge.holding_date),
      monthDayLabel: formatMonthDayLabel(summary.challenge.holding_date),
      dayNumberLabel: formatDayNumberLabel(summary.challenge.holding_date),
      weekdayLabel: formatWeekdayLabel(summary.challenge.holding_date),
      timeRangeLabel: formatTimeRangeLabel(summary.challenge.start_time, summary.challenge.end_time),
      venue: summary.challenge.location,
      formatLabel: `${summary.challenge.players_per_team} 人制`,
      feeLabel: summary.challenge.fee_per_person
        ? `预计 ${formatCurrency(summary.challenge.fee_per_person)}/人`
        : "费用待定",
      priceLabel: summary.challenge.fee_per_person
        ? `${formatCompactCurrency(summary.challenge.fee_per_person)}/人`
        : "费用待定",
      statusLabel: toChallengeStatusLabel(summary.challenge.kind, summary.challenge.status),
      statusTone: toChallengeTone(summary.challenge.status),
      relationLabel,
      note: summary.challenge.note ?? "",
      teamInitial: isIndividual ? "散" : summary.host_team_name.slice(0, 1) || "队",
      quickTags: buildChallengeTags(summary, relationLabel),
      primaryActionLabel: toChallengePrimaryActionLabel(summary),
      canAccept: summary.can_accept,
      acceptedCount: summary.accepted_count,
      capacity,
      minPlayers,
      maxPlayers: capacity,
      currentUserJoined: summary.current_user_joined,
      activityId: summary.challenge.activity_id ?? "",
    };
  });
}

export function filterChallengeSummariesByScope(
  summaries: BackendChallengeSummary[],
  scope: "all" | "open" | "mine",
): BackendChallengeSummary[] {
  switch (scope) {
    case "open":
      return summaries.filter((summary) => summary.challenge.status === "open");
    case "mine":
      return summaries.filter((summary) => summary.current_team_relation !== "viewer");
    default:
      return summaries;
  }
}

function toNotificationKindLabel(kind: string): string {
  switch (kind) {
    case "challenge_matched":
      return "约队已约成";
    case "challenge_created":
      return "约队已发布";
    case "challenge_cancelled":
      return "约队已取消";
    default:
      return "系统通知";
  }
}

function toNotificationRelatedPath(notification: BackendNotification): string {
  if (notification.related_type === "challenge" && notification.related_id) {
    return `/pages/challenges/detail?id=${notification.related_id}`;
  }
  if (notification.related_type === "activity" && notification.related_id) {
    return `/pages/matches/detail?id=${notification.related_id}`;
  }
  return "";
}

export function buildNotificationItems(
  notifications: BackendNotification[],
): NotificationItemViewModel[] {
  return notifications.map((item) => ({
    id: item.id,
    title: item.title,
    content: item.content,
    kindLabel: toNotificationKindLabel(item.kind),
    createdAtLabel: formatDateLabel(item.created_at),
    read: !!item.read_at,
    relatedPath: toNotificationRelatedPath(item),
  }));
}
