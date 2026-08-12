import type {
  BackendBillingFlowResult,
  BackendUserAccount,
  BackendUserAttendanceRecord,
} from "@/types/backend";
import type { AttendanceSummaryViewModel, BillingSummaryViewModel } from "@/types/viewModels";
import { formatCurrency } from "./common";

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
