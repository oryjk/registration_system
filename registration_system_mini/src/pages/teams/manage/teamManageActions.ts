import {
  addTeamMember,
  getTeamMatchAttendance,
  getTeamMemberAttendance,
  removeTeamMember,
  setTeamMemberActive,
  updateTeam,
  updateTeamJoinPassword,
  updateTeamMember,
} from "@/api/team";
import { listUsers, searchUsers } from "@/api/user";

export function loadTeamMemberAttendance(teamId: number, userId: number) {
  return getTeamMemberAttendance(teamId, userId);
}

export function loadTeamMatchAttendance(teamId: number, matchId: string) {
  return getTeamMatchAttendance(teamId, matchId);
}

export function saveTeamProfile(
  teamId: number,
  payload: {
    name: string;
    description: string | null;
    logoUrl: string | null;
  },
) {
  return updateTeam(teamId, {
    name: payload.name,
    description: payload.description,
    logo_url: payload.logoUrl,
  });
}

export function searchTeamCandidates(keyword: string, limit = 8) {
  return searchUsers(keyword, limit);
}

// joinPassword 非空=设置/替换入队密码；空串=清除（开放加入）。
export function updateJoinPasswordFromForm(teamId: number, joinPassword: string) {
  return updateTeamJoinPassword(teamId, joinPassword);
}

export function addMemberToTeam(
  teamId: number,
  payload: {
    userId: number;
    role?: string;
  },
) {
  return addTeamMember(teamId, {
    user_id: payload.userId,
    role: payload.role,
  });
}

export function updateTeamMemberFromForm(
  teamId: number,
  userId: number,
  payload: {
    role?: string;
  },
) {
  return updateTeamMember(teamId, userId, {
    role: payload.role,
  });
}

export function removeMemberFromTeam(teamId: number, userId: number) {
  return removeTeamMember(teamId, userId);
}

export function setTeamMemberStatus(teamId: number, userId: number, status: number) {
  return setTeamMemberActive(teamId, userId, status === 1);
}

export function loadUsersById() {
  return listUsers().then((users) => Object.fromEntries(users.map((user) => [user.id, user])));
}
