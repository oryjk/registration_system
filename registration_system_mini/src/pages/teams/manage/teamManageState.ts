import type { BackendTeamMember, BackendTeamMemberAttendanceRecord } from "@/types/backend";

// 管理页只保留当前球队的管理模式；创建/加入球队在独立二级页面（pages/teams/create、pages/teams/join）。
export type TeamManageMode = "profile" | "members" | "attendance";

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

