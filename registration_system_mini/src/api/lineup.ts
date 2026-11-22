import type {
  MatchLineupMiniCodeResponse,
  MatchLineupResponse,
  MiniProgramEnv,
  SaveMatchLineupPayload,
} from "@/types/lineup";
import { requestApi } from "@/utils/request";

export function getMatchLineup(matchId: string) {
  return requestApi<MatchLineupResponse>({
    url: `/matches/${encodeURIComponent(matchId)}/lineup`,
    auth: true,
  });
}

export function saveMatchLineup(matchId: string, payload: SaveMatchLineupPayload) {
  return requestApi<MatchLineupResponse>({
    url: `/matches/${encodeURIComponent(matchId)}/lineup`,
    method: "PUT",
    data: {
      formation: payload.formation,
      slots: payload.slots.map((item) => ({
        slot: item.slot,
        player_id: item.player_id,
        x: item.x,
        y: item.y,
        sub_player_ids: item.sub_player_ids,
      })),
    },
    auth: true,
  });
}

export function getMatchLineupMiniCode(matchId: string, env: MiniProgramEnv) {
  return requestApi<MatchLineupMiniCodeResponse>({
    url: `/matches/${encodeURIComponent(matchId)}/lineup/mini-code?env=${encodeURIComponent(env)}`,
    auth: true,
  });
}
