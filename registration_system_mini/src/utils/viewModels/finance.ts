import type { BackendTeamFundBalance, BackendTeamFundTransaction, BackendUserAttendanceRecord } from "@/types/backend";
import type { AttendanceSummaryViewModel } from "@/types/viewModels";

export function buildAttendanceSummary(records: BackendUserAttendanceRecord[]): AttendanceSummaryViewModel {
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

/** 队费金额展示：负数标注为欠款。 */
export function teamFundCentsLabel(cents: number) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}¥${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** 流水来源中文标签。 */
export function teamFundSourceLabel(source: string) {
  switch (source) {
    case "membership_payment":
      return "队费充值";
    case "match_settlement":
      return "比赛扣费";
    case "settlement_reversal":
      return "结算冲正";
    case "admin_credit":
      return "后台充值";
    default:
      return "队费变动";
  }
}

/** 我在各球队的队费余额汇总文案；欠款（负数）单独计数。 */
export function buildTeamFundBalanceSummary(balances: BackendTeamFundBalance[]) {
  let totalCents = 0;
  let debtTeamCount = 0;
  for (const balance of balances) {
    totalCents += balance.balance_cents;
    if (balance.balance_cents < 0) {
      debtTeamCount += 1;
    }
  }
  return { totalCents, debtTeamCount, teamCount: balances.length };
}

export function buildTeamFundTransactionMeta(transaction: BackendTeamFundTransaction) {
  const scopeLabel = transaction.match_name || transaction.team_name;
  return `${teamFundSourceLabel(transaction.source)} · ${scopeLabel}`;
}
