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

export function buildAttendanceCalendarMonths(records: BackendTeamMemberAttendanceRecord[]): AttendanceCalendarMonth[] {
  const sortedRecords = [...records].sort((left, right) => right.holding_date.localeCompare(left.holding_date));
  const recordsByMonth = new Map<string, BackendTeamMemberAttendanceRecord[]>();

  for (const record of sortedRecords) {
    const monthKey = dateKey(record.holding_date).slice(0, 7);
    const monthRecords = recordsByMonth.get(monthKey) ?? [];
    monthRecords.push(record);
    recordsByMonth.set(monthKey, monthRecords);
  }

  return Array.from(recordsByMonth.entries()).map(([monthKey, monthRecords]) =>
    buildAttendanceCalendarMonth(monthKey, monthRecords),
  );
}

function buildAttendanceCalendarMonth(
  monthKey: string,
  records: BackendTeamMemberAttendanceRecord[],
): AttendanceCalendarMonth {
  const [year, month] = monthKey.split("-").map((item) => Number(item));
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingDays = firstDay.getDay();
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
    const date = new Date(year, month - 1, index - leadingDays + 1);
    const key = dateKeyFromDate(date);
    const inMonth = date.getMonth() === month - 1;
    const dayRecords = inMonth ? recordsByDate.get(key) ?? [] : [];
    days.push({
      dateKey: key,
      dayNumber: date.getDate(),
      inMonth,
      isToday: key === dateKeyFromDate(new Date()),
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
  return value.slice(0, 10);
}

function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeLabel(value: string) {
  return value.slice(11, 16) || "--:--";
}

export { formatDateLabel, formatYearLabel };

export function rankingInitial(item: BackendTeamAttendanceRankingItem) {
  return item.user_name.slice(0, 1) || "队";
}

export function rankingRate(item: BackendTeamAttendanceRankingItem) {
  return `${Math.round((item.attended_count / Math.max(item.total_count, 1)) * 100)}%`;
}
