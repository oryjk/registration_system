import { beijingDateKey, formatDateLabel, formatTimeLabel, formatYearLabel, parseDateValue } from "@/utils/datetime";
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

export interface AttendanceCalendarRecord {
  activityId: string;
  activityName: string;
  holdingDate: string;
  timeLabel: string;
  location: string;
  registrationCount: number;
  statusLabel: string;
  statusTone: "joined" | "leave" | "unchecked";
}

export interface AttendanceCalendarDay {
  dateKey: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  records: AttendanceCalendarRecord[];
}

export interface AttendanceCalendarWeek {
  days: AttendanceCalendarDay[];
}

export interface AttendanceCalendarMonth {
  monthKey: string;
  title: string;
  total: number;
  attended: number;
  leave: number;
  late: number;
  unregistered: number;
  weeks: AttendanceCalendarWeek[];
}

export function buildRecordSummary(records: BackendTeamMemberAttendanceRecord[]): TeamStatsSummary {
  const attended = records.filter((item) => item.registered && item.stand === 1).length;
  const leave = records.filter((item) => item.registered && item.stand === 2).length;
  const late = records.filter((item) => item.registered && item.stand === 3).length;
  const unregistered = records.filter((item) => !item.registered || (item.stand !== 1 && item.stand !== 2)).length;
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

export function buildAttendanceCalendarMonths(records: BackendTeamMemberAttendanceRecord[], now = new Date()): AttendanceCalendarMonth[] {
  const sortedRecords = [...records].sort((left, right) => parseDateValue(right.holding_date).getTime() - parseDateValue(left.holding_date).getTime());
  const recordsByMonth = new Map<string, BackendTeamMemberAttendanceRecord[]>();

  for (const record of sortedRecords) {
    const monthKey = dateKey(record.holding_date).slice(0, 7);
    const monthRecords = recordsByMonth.get(monthKey) ?? [];
    monthRecords.push(record);
    recordsByMonth.set(monthKey, monthRecords);
  }

  return Array.from(recordsByMonth.entries()).map(([monthKey, monthRecords]) =>
    buildAttendanceCalendarMonth(monthKey, monthRecords, now),
  );
}

function buildAttendanceCalendarMonth(
  monthKey: string,
  records: BackendTeamMemberAttendanceRecord[],
  now: Date,
): AttendanceCalendarMonth {
  const [year, month] = monthKey.split("-").map((item) => Number(item));
  // Date.UTC 在这里仅生成纯日历格点，用 UTC getters 运算年月日，不承载比赛时刻。
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingDays = firstDay.getUTCDay();
  const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const recordsByDate = new Map<string, BackendTeamMemberAttendanceRecord[]>();

  for (const record of records) {
    const key = dateKey(record.holding_date);
    const dayRecords = recordsByDate.get(key) ?? [];
    dayRecords.push(record);
    recordsByDate.set(key, dayRecords);
  }

  const days: AttendanceCalendarDay[] = [];
  for (let index = 0; index < totalCells; index += 1) {
    const date = new Date(Date.UTC(year, month - 1, index - leadingDays + 1));
    const key = date.toISOString().slice(0, 10);
    const inMonth = date.getUTCMonth() === month - 1;
    const dayRecords = inMonth ? recordsByDate.get(key) ?? [] : [];
    days.push({
      dateKey: key,
      dayNumber: date.getUTCDate(),
      inMonth,
      isToday: key === beijingDateKey(now),
      records: dayRecords.map(toCalendarRecord),
    });
  }

  const weeks: AttendanceCalendarWeek[] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push({ days: days.slice(index, index + 7) });
  }

  return {
    monthKey,
    title: `${year} 年 ${month} 月`,
    total: records.length,
    attended: records.filter((item) => item.registered && item.stand === 1).length,
    leave: records.filter((item) => item.registered && item.stand === 2).length,
    late: records.filter((item) => item.registered && item.stand === 3).length,
    unregistered: records.filter((item) => !item.registered).length,
    weeks,
  };
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

function toCalendarRecord(record: BackendTeamMemberAttendanceRecord): AttendanceCalendarRecord {
  return {
    activityId: record.activity_id,
    activityName: record.activity_name,
    holdingDate: record.holding_date,
    timeLabel: timeLabel(record.holding_date),
    location: record.location,
    registrationCount: record.registration_count,
    statusLabel: attendanceCalendarStatusLabel(record),
    statusTone: attendanceCalendarStatusTone(record),
  };
}

function attendanceCalendarStatusLabel(record: BackendTeamMemberAttendanceRecord) {
  if (record.registered && record.stand === 1) return "参加";
  if (record.registered && record.stand === 2) return "请假";
  return "未打卡";
}

function attendanceCalendarStatusTone(record: BackendTeamMemberAttendanceRecord): AttendanceCalendarRecord["statusTone"] {
  if (record.stand === 1) return "joined";
  if (record.stand === 2) return "leave";
  return "unchecked";
}

function dateKey(value: string) {
  return beijingDateKey(value);
}

function timeLabel(value: string) {
  return formatTimeLabel(value);
}

export { formatDateLabel, formatYearLabel };

export function rankingInitial(item: BackendTeamAttendanceRankingItem) {
  return item.user_name.slice(0, 1) || "队";
}

export function rankingRate(item: BackendTeamAttendanceRankingItem) {
  return `${Math.round((item.attended_count / Math.max(item.total_count, 1)) * 100)}%`;
}


/** Score and tie order are supplied by Go; never infer rewards from old counts. */
export function sortParticipationRanking(items: BackendTeamAttendanceRankingItem[]) {
  return [...items].sort((a, b) =>
    (b.participation_points ?? 0) - (a.participation_points ?? 0)
    || (a.participation_rank ?? 0) - (b.participation_rank ?? 0));
}
