import {
  addTeamMember,
  consumeTeamMemberFund,
  deleteTeam,
  getTeamDissolveBlockers,
  getTeamMatchAttendance,
  getTeamMemberAttendance,
  rechargeTeamMemberFund,
  removeTeamMember,
  setTeamMemberActive,
  updateTeam,
  updateTeamJoinPassword,
  updateTeamMember,
  updateTeamMemberPaidMembership,
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

/** 解散球队（仅队长）；仍有进行中的比赛或约队申请时后端以 409 文案拒绝。 */
export function dissolveTeam(teamId: number) {
  return deleteTeam(teamId);
}

/** 解散前的引用校验（仅队长）：返回未结束比赛与进行中约队申请，为空才可解散。 */
export function loadTeamDissolveBlockers(teamId: number) {
  return getTeamDissolveBlockers(teamId);
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

// 付费会员标记手动切换；余额与充值时间由充值/消费/冲正动作维护，编辑资料不触碰财务。
export function updateTeamMemberPaidMembershipFromForm(
  teamId: number,
  userId: number,
  payload: { isPaidMember: boolean },
) {
  return updateTeamMemberPaidMembership(teamId, userId, {
    is_paid_member: payload.isPaidMember,
  });
}

export function rechargeTeamMemberFundFromForm(
  teamId: number,
  userId: number,
  payload: { amountCents: number; note: string; idempotencyKey: string },
) {
  return rechargeTeamMemberFund(teamId, userId, {
    amount_cents: payload.amountCents,
    note: payload.note.trim() || undefined,
    idempotency_key: payload.idempotencyKey,
  });
}

export function consumeTeamMemberFundFromForm(
  teamId: number,
  userId: number,
  payload: { amountCents: number; note: string; idempotencyKey: string },
) {
  return consumeTeamMemberFund(teamId, userId, {
    amount_cents: payload.amountCents,
    note: payload.note.trim(),
    idempotency_key: payload.idempotencyKey,
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
