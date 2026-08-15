import type {
  AssignableTeamMemberRole,
  TeamMember,
  TeamMemberRole,
  TeamMemberStatus,
} from "../../types/team";

export const assignableRoleOptions: {
  label: string;
  value: AssignableTeamMemberRole;
}[] = [
  { label: "领队", value: "leader" },
  { label: "副队长", value: "vice_captain" },
  { label: "队员", value: "member" },
];

// 添加成员时允许选择队长：前端先按队员添加，再调用设置队长接口。
export const addMemberRoleOptions: {
  label: string;
  value: TeamMemberRole;
}[] = [{ label: "队长", value: "captain" }, ...assignableRoleOptions];

export const roleLabels: Record<TeamMemberRole, string> = {
  captain: "队长",
  leader: "领队",
  vice_captain: "副队长",
  member: "队员",
};

export const roleColors: Record<TeamMemberRole, string> = {
  captain: "gold",
  leader: "blue",
  vice_captain: "cyan",
  member: "default",
};

export const statusLabels: Record<TeamMemberStatus, string> = {
  active: "已启用",
  inactive: "已冻结",
};

export function displayMemberName(
  member: Pick<TeamMember, "real_name" | "nickname" | "user_id">,
) {
  return (
    member.real_name?.trim() ||
    member.nickname.trim() ||
    `用户 ${member.user_id}`
  );
}

export function memberInitial(
  member: Pick<TeamMember, "real_name" | "nickname" | "user_id">,
) {
  return (
    member.real_name?.trim().slice(0, 1) ||
    member.nickname.trim().slice(0, 1) ||
    String(member.user_id).slice(-1)
  );
}
