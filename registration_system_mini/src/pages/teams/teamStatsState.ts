import { formatDateLabel, formatYearLabel } from "@/utils/datetime";
import { toStandLabel } from "@/utils/viewModels";
import type { BackendTeamAttendanceRankingItem, BackendTeamMemberAttendanceRecord } from "@/types/backend";

export interface TeamStatsSummary {
  total: number;
  attended: number;
  leave: number;
  late: number;
  unregistered: number;
  rate: string;
}

export interface AttendanceRecordGroup {
  year: string;
  records: BackendTeamMemberAttendanceRecord[];
  total: number;
  attended: number;
  leave: number;
  unregistered: number;
  collapsed: boolean;
}

export function buildRecordSummary(records: BackendTeamMemberAttendanceRecord[]): TeamStatsSummary {
  const attended = records.filter((item) => item.registered && item.stand === 1).length;
  const leave = records.filter((item) => item.registered && item.stand === 2).length;
  const late = records.filter((item) => item.registered && item.stand === 3).length;
  const unregistered = records.filter((item) => !item.registered).length;
  const total = records.length;

  return {
    total,
    attended,
    leave,
    late,
    unregistered,
    rate: `${Math.round((attended / Math.max(total, 1)) * 100)}%`,
  };
}

export function buildAttendanceGroups(
  records: BackendTeamMemberAttendanceRecord[],
  collapsedYears: string[],
): AttendanceRecordGroup[] {
  const groups: AttendanceRecordGroup[] = [];

  for (const record of records) {
    const year = formatYearLabel(record.holding_date);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.year === year) {
      appendRecordToGroup(lastGroup, record);
      continue;
    }

    const group: AttendanceRecordGroup = {
      year,
      records: [],
      total: 0,
      attended: 0,
      leave: 0,
      unregistered: 0,
      collapsed: collapsedYears.includes(year),
    };
    appendRecordToGroup(group, record);
    groups.push(group);
  }

  return groups;
}

function appendRecordToGroup(group: AttendanceRecordGroup, record: BackendTeamMemberAttendanceRecord) {
  group.records.push(record);
  group.total += 1;
  if (record.registered && record.stand === 1) group.attended += 1;
  if (record.registered && record.stand === 2) group.leave += 1;
  if (!record.registered) group.unregistered += 1;
}

export function attendanceStatusLabel(record: BackendTeamMemberAttendanceRecord) {
  if (!record.registered) return "未报名";
  return toStandLabel(record.stand);
}

export function attendanceStatusClass(record: BackendTeamMemberAttendanceRecord) {
  if (!record.registered) return "stats-status stats-status-unregistered";
  if (record.stand === 1) return "stats-status stats-status-joined";
  if (record.stand === 2) return "stats-status stats-status-leave";
  if (record.stand === 3) return "stats-status stats-status-late";
  return "stats-status stats-status-pending";
}

export { formatDateLabel, formatYearLabel };

export function rankingInitial(item: BackendTeamAttendanceRankingItem) {
  return item.user_name.slice(0, 1) || "队";
}

export function rankingRate(item: BackendTeamAttendanceRankingItem) {
  return `${Math.round((item.attended_count / Math.max(item.total_count, 1)) * 100)}%`;
}
