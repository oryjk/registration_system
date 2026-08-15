import type { AppMatchSummary } from "@/types/match";
import type { AppWalletAccount } from "@/types/wallet";
import { formatDateLabel, parseDateValue } from "@/utils/datetime";
import { resolveMatchPhase } from "@/pages/home/homeMatchState";
import { attendanceStatusTone } from "@/utils/statusTone";
import type { MineMatchSummary } from "./mineTypes";

const DEFAULT_MATCH_DURATION_HOURS = 2;
const MAX_REASONABLE_MATCH_DURATION_HOURS = 6;

function toStatusTone(status: string): MineMatchSummary["statusTone"] {
  switch (attendanceStatusTone(status)) {
    case "join":
      return "green";
    case "leave":
      return "muted";
    case "late":
      return "amber";
    default:
      return "blue";
  }
}

export interface MineOverviewState {
  activityCount: number;
  totalHoursLabel: string;
  matches: MineMatchSummary[];
  walletSummary: {
    balanceLabel: string;
    totalExpenseLabel: string;
    latestExpenseLabel: string;
  };
}

function formatCents(value: number): string {
  return `¥${(value / 100).toFixed(2)}`;
}

function formatHours(matches: AppMatchSummary[]): string {
  const totalHours = matches.reduce((sum, match) => {
    const durationHours =
      (parseDateValue(match.end_time).getTime() - parseDateValue(match.start_time).getTime()) / 3_600_000;
    const matchHours =
      durationHours > 0 && durationHours <= MAX_REASONABLE_MATCH_DURATION_HOURS
        ? durationHours
        : DEFAULT_MATCH_DURATION_HOURS;
    return sum + matchHours;
  }, 0);
  const roundedHours = Math.round(totalHours * 10) / 10;
  return `${roundedHours} h`;
}

export function buildMineOverviewState(
  matches: AppMatchSummary[],
  wallet: AppWalletAccount,
  now = new Date(),
): MineOverviewState {
  const currentYearMatches = matches.filter(
    (match) =>
      resolveMatchPhase(match, now) !== "excluded" &&
      parseDateValue(match.start_time).getFullYear() === now.getFullYear(),
  );
  const upcomingMatches = matches
    .filter((match) => resolveMatchPhase(match, now) === "upcoming")
    .sort((left, right) => parseDateValue(left.start_time).getTime() - parseDateValue(right.start_time).getTime())
    .slice(0, 2)
    .map((match) => ({
      id: match.id,
      title: match.name,
      dateLabel: formatDateLabel(match.start_time),
      venue: match.location,
      statusLabel: "报名中",
      statusTone: toStatusTone("报名中"),
      actionLabel: "查看比赛",
    }));

  return {
    activityCount: currentYearMatches.length,
    totalHoursLabel: formatHours(currentYearMatches),
    matches: upcomingMatches,
    walletSummary: {
      balanceLabel: formatCents(wallet.balance_cents),
      totalExpenseLabel: formatCents(wallet.total_spent_cents),
      latestExpenseLabel: "进入账单查看",
    },
  };
}
