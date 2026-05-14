import {
  addTeamMember,
  batchUpdateTeamMemberStatus,
  createTeam,
  getTeamMemberAttendance,
  getTeamPasswordInfo,
  joinTeam,
  removeTeamMember,
  searchTeams,
  updateTeam,
  updateTeamMember,
  uploadTeamLogo,
} from "@/api/team";
import { listUsers, searchUsers } from "@/api/user";

export function uploadCurrentTeamLogo(teamId: number, filePath: string) {
  return uploadTeamLogo(teamId, filePath);
}

export function loadTeamMemberAttendance(teamId: number, userId: number) {
  return getTeamMemberAttendance(teamId, userId);
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

export function createTeamFromForm(payload: {
  name: string;
  description?: string;
  joinPassword?: string;
}) {
  return createTeam({
    name: payload.name,
    description: payload.description,
    join_password: payload.joinPassword,
  });
}

export function searchTeamsByKeyword(keyword: string) {
  return searchTeams(keyword);
}

export async function checkTeamRequiresPassword(teamId: number) {
  return (await getTeamPasswordInfo(teamId)).requires_password;
}

export function joinTeamFromForm(payload: {
  teamId: number;
  password?: string;
}) {
  return joinTeam({
    team_id: payload.teamId,
    password: payload.password,
  });
}

export function addMemberToTeam(
  teamId: number,
  payload: {
    userId: number;
    role?: string;
    jerseyNumber?: string;
  },
) {
  return addTeamMember(teamId, {
    user_id: payload.userId,
    role: payload.role,
    jersey_number: payload.jerseyNumber,
  });
}

export function updateTeamMemberFromForm(
  teamId: number,
  userId: number,
  payload: {
    role?: string;
    jerseyNumber?: string | null;
  },
) {
  return updateTeamMember(teamId, userId, {
    role: payload.role,
    jersey_number: payload.jerseyNumber,
  });
}

export function removeMemberFromTeam(teamId: number, userId: number) {
  return removeTeamMember(teamId, userId);
}

export function setTeamMemberStatus(teamId: number, userId: number, status: number) {
  return batchUpdateTeamMemberStatus(teamId, {
    user_ids: [userId],
    status,
  });
}

export function loadUsersById() {
  return listUsers().then((users) => Object.fromEntries(users.map((user) => [user.id, user])));
}
