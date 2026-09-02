import type { CreateMatchPayload } from "@/api/match";
import type { MatchPublishFormModel } from "./components/matchPublishForm";

interface HostTeamInput {
  id: number;
  name: string;
}

export function buildCreateMatchPayload(form: MatchPublishFormModel, hostTeam: HostTeamInput): CreateMatchPayload {
  const playersPerTeam = Number(form.playersPerTeam);
  if (!Number.isFinite(playersPerTeam) || playersPerTeam <= 0) {
    throw new Error("比赛人制必须大于 0");
  }

  // 报名人数上限可显式设置；不填回退为既有默认值（人制 + 2）。
  const rawCapacity = String(form.hostCapacityLimit ?? "").trim();
  const capacityLimit = rawCapacity ? Number(rawCapacity) : playersPerTeam + 2;
  if (!Number.isFinite(capacityLimit) || capacityLimit <= 0) {
    throw new Error("报名人数上限必须大于 0");
  }
  if (capacityLimit < playersPerTeam) {
    throw new Error("报名人数上限不能低于比赛人制");
  }

  const opponentName = form.opposing.trim();
  if (form.publicationMode === "offline_confirmed" && !opponentName) {
    throw new Error("线下已约比赛必须填写对手名称");
  }
  const description = form.description.trim();
  const hasCoordinates = form.locationLatitude != null && form.locationLongitude != null;

  return {
    name: form.name.trim(),
    publication_mode: form.publicationMode,
    host_team_id: hostTeam.id,
    ...(form.publicationMode === "offline_confirmed" ? { opponent_name: opponentName } : {}),
    players_per_team: playersPerTeam,
    host_capacity_limit: capacityLimit,
    start_time: new Date(form.holdingDate).toISOString(),
    end_time: new Date(form.matchEndTime).toISOString(),
    // 报名窗口不在表单内暴露；缺省时后端按“创建即开放、比赛状态控制截止”处理，
    // 与散人约球发布页保持一致，避免发送不可见的相等时间对被后端拒绝。
    location: form.location.trim(),
    // 填了人均费用视为收费比赛；不填或 0 视为免费。
    is_free: !form.feePerPerson || Number(form.feePerPerson) <= 0,
    ...(form.color ? { host_color: form.color } : {}),
    ...(form.opposingColor ? { away_color: form.opposingColor } : {}),
    ...(hasCoordinates
      ? { location_latitude: form.locationLatitude!, location_longitude: form.locationLongitude! }
      : {}),
    ...(description ? { description } : {}),
  };
}
