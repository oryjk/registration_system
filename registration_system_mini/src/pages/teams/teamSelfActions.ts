import { createTeam, getTeamPasswordInfo, joinTeam, searchTeams } from "@/api/team";

// 无球队上下文也可用的球队自服务动作：创建、搜索、加入、入队口令查询。
// 创建/加入是独立二级页面（pages/teams/create、pages/teams/join），管理页的口令设置也复用这里的查询。

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
