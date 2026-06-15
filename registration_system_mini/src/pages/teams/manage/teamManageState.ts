import type { BackendTeamMember, BackendTeamMemberAttendanceRecord } from "@/types/backend";

export type TeamManageMode = "profile" | "create" | "join" | "members" | "attendance";

export interface TeamActivityAttendanceMember {
  userId: number;
  name: string;
  avatarUrl: string;
  initial: string;
  statusLabel: "参加" | "请假" | "未打卡";
  statusTone: "joined" | "leave" | "unchecked";
  registrationCount: number;
}

export interface TeamActivityAttendanceSummary {
  activityId: string;
  activityName: string;
  holdingDate: string;
  location: string;
  attended: number;
  leave: number;
  unchecked: number;
  members: TeamActivityAttendanceMember[];
}

const activityAttendanceToneOrder: Record<TeamActivityAttendanceMember["statusTone"], number> = {
  joined: 0,
  leave: 1,
  unchecked: 2,
};

export const memberRoleOptions = [
  { value: "member", label: "队员" },
  { value: "vice_captain", label: "队务" },
  { value: "leader", label: "领队" },
  { value: "captain", label: "队长" },
];

const leadershipRoleOrder: Record<string, number> = {
  captain: 0,
  leader: 1,
  vice_captain: 2,
};

export function resolveVisibleMode(hasCurrentTeam: boolean, activeMode: TeamManageMode, allowCreateTeamMode = true): TeamManageMode {
  if (hasCurrentTeam && (activeMode === "create" || activeMode === "join")) {
    return "profile";
  }

  if (!hasCurrentTeam && (activeMode === "profile" || activeMode === "members" || activeMode === "attendance")) {
    return allowCreateTeamMode ? "create" : "join";
  }

  if (!allowCreateTeamMode && activeMode === "create") {
    return "join";
  }

  return activeMode;
}

export function roleLabel(role: string) {
  return memberRoleOptions.find((item) => item.value === role)?.label ?? "队员";
}

export function memberStatusLabel(status: number) {
  return status === 1 ? "正常" : "已冻结";
}

export function isLeadershipRole(role: string) {
  return role in leadershipRoleOrder;
}

export function splitTeamMembers(members: BackendTeamMember[]) {
  return {
    leadershipMembers: members
      .filter((member) => member.status === 1 && member.role in leadershipRoleOrder)
      .slice()
      .sort((left, right) => leadershipRoleOrder[left.role] - leadershipRoleOrder[right.role] || left.user_id - right.user_id),
    regularMembers: members.filter((member) => member.status === 1 && !(member.role in leadershipRoleOrder)),
    frozenMembers: members.filter((member) => member.status !== 1),
  };
}

export function attendanceStatusLabel(record: BackendTeamMemberAttendanceRecord, standLabel: (stand: number) => string) {
  if (!record.registered) return "未报名";
  return standLabel(record.stand);
}

export function attendanceStatusClass(record: BackendTeamMemberAttendanceRecord) {
  if (!record.registered) return "attendance-status attendance-status-unregistered";
  if (record.stand === 1) return "attendance-status attendance-status-joined";
  if (record.stand === 2) return "attendance-status attendance-status-leave";
  if (record.stand === 3) return "attendance-status attendance-status-late";
  return "attendance-status attendance-status-pending";
}

export function formatAttendanceDate(isoText: string) {
  const date = new Date(isoText.replace(" ", "T"));
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

export function formatAttendanceYear(isoText: string) {
  const date = new Date(isoText.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "未知年份" : `${date.getFullYear()} 年`;
}

export function buildAttendanceSummary(records: BackendTeamMemberAttendanceRecord[]) {
  return {
    attended: records.filter((record) => record.registered && record.stand === 1).length,
    leave: records.filter((record) => record.registered && record.stand === 2).length,
    unregistered: records.filter((record) => !record.registered).length,
  };
}

export function buildAttendanceGroups(records: BackendTeamMemberAttendanceRecord[], collapsedYears: string[]) {
  const groups: Array<{
    year: string;
    records: BackendTeamMemberAttendanceRecord[];
    total: number;
    attended: number;
    leave: number;
    collapsed: boolean;
  }> = [];
  for (const record of records) {
    const year = formatAttendanceYear(record.holding_date);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.year === year) {
      lastGroup.records.push(record);
      lastGroup.total += 1;
      if (record.registered && record.stand === 1) lastGroup.attended += 1;
      if (record.registered && record.stand === 2) lastGroup.leave += 1;
      continue;
    }
    groups.push({
      year,
      records: [record],
      total: 1,
      attended: record.registered && record.stand === 1 ? 1 : 0,
      leave: record.registered && record.stand === 2 ? 1 : 0,
      collapsed: collapsedYears.includes(year),
    });
  }
  return groups;
}

export function buildTeamActivityAttendanceSummaries(
  recordsByUserId: Record<number, BackendTeamMemberAttendanceRecord[]>,
  memberName: (userId: number) => string,
  memberAvatarUrl: (userId: number) => string,
  memberInitial: (userId: number) => string,
): TeamActivityAttendanceSummary[] {
  const byActivity = new Map<string, TeamActivityAttendanceSummary>();

  for (const [rawUserId, records] of Object.entries(recordsByUserId)) {
    const userId = Number(rawUserId);
    for (const record of records) {
      const existing = byActivity.get(record.activity_id) ?? {
        activityId: record.activity_id,
        activityName: record.activity_name,
        holdingDate: record.holding_date,
        location: record.location,
        attended: 0,
        leave: 0,
        unchecked: 0,
        members: [],
      };
      const memberStatus = teamActivityMemberStatus(record);
      if (memberStatus.statusTone === "joined") existing.attended += 1;
      else if (memberStatus.statusTone === "leave") existing.leave += 1;
      else existing.unchecked += 1;
      existing.members.push({
        userId,
        name: memberName(userId),
        avatarUrl: memberAvatarUrl(userId),
        initial: memberInitial(userId),
        registrationCount: record.registration_count,
        ...memberStatus,
      });
      byActivity.set(record.activity_id, existing);
    }
  }

  return Array.from(byActivity.values())
    .map((summary) => ({
      ...summary,
      members: summary.members.sort((left, right) => {
        return activityAttendanceToneOrder[left.statusTone] - activityAttendanceToneOrder[right.statusTone] || left.userId - right.userId;
      }),
    }))
    .sort((left, right) => right.holdingDate.localeCompare(left.holdingDate));
}

function teamActivityMemberStatus(record: BackendTeamMemberAttendanceRecord): Pick<TeamActivityAttendanceMember, "statusLabel" | "statusTone"> {
  if (record.registered && record.stand === 1) return { statusLabel: "参加", statusTone: "joined" };
  if (record.registered && record.stand === 2) return { statusLabel: "请假", statusTone: "leave" };
  return { statusLabel: "未打卡", statusTone: "unchecked" };
}
