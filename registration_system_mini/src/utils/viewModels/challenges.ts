import type { BackendChallengeSummary } from "@/types/backend";
import type { ChallengeCardViewModel } from "@/types/viewModels";
import {
  formatDateLabel,
  formatDayNumberLabel,
  formatMonthDayLabel,
  formatTimeRangeLabel,
  formatWeekdayLabel,
} from "@/utils/datetime";
import { formatCompactCurrency, formatCurrency } from "./common";

function toChallengeStatusLabel(kind: "team" | "individual", status: string): string {
  if (status === "matched") return kind === "individual" ? "已成行" : "已约成";
  if (status === "cancelled") return "已取消";
  return kind === "individual" ? "可报名" : "可接约";
}

function toChallengeRelationLabel(summary: BackendChallengeSummary): string {
  const { challenge, current_team_relation: relation, current_user_joined: currentUserJoined } = summary;
  if (challenge.kind === "individual") {
    if (currentUserJoined) return "我已报名";
    if (relation === "host") return challenge.status === "matched" ? "我发起的散人局" : "我发布的散人局";
    return challenge.status === "matched" ? "已成行" : "可报名";
  }
  if (relation === "host") {
    return challenge.host_team_id && challenge.accepted_by_user_id && !challenge.guest_team_id
      ? "等待对手"
      : challenge.status === "matched" ? "我发起的约队" : "我发布的约队";
  }
  if (relation === "guest") return "我已接约";
  return challenge.status === "matched" ? "约成可报名" : "可接约";
}

function toChallengeTone(status: string): "open" | "matched" | "cancelled" {
  if (status === "matched") return "matched";
  if (status === "cancelled") return "cancelled";
  return "open";
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
    if (summary.current_user_joined) return "取消报名";
    if (summary.can_accept || summary.challenge.status === "open") return "去报名";
    return "看详情";
  }
  if (summary.challenge.activity_id && summary.challenge.status === "matched") return "去报名";
  if (summary.challenge.host_team_id && summary.challenge.accepted_by_user_id && !summary.challenge.guest_team_id) {
    return summary.current_team_relation === "host" ? "等待对手" : "去应战";
  }
  if (summary.can_accept) return "去接约";
  if (summary.challenge.status === "matched") return "看赛程";
  return "看详情";
}

export function buildChallengeCards(summaries: BackendChallengeSummary[]): ChallengeCardViewModel[] {
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
      feeLabel: summary.challenge.fee_per_person ? `预计 ${formatCurrency(summary.challenge.fee_per_person)}/人` : "费用待定",
      priceLabel: summary.challenge.fee_per_person ? `${formatCompactCurrency(summary.challenge.fee_per_person)}/人` : "费用待定",
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
  if (scope === "open") return summaries.filter((summary) => summary.challenge.status === "open");
  if (scope === "mine") return summaries.filter((summary) => summary.current_team_relation !== "viewer");
  return summaries;
}
