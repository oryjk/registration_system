import { describe, expect, test } from "bun:test";
import { ref } from "vue";
import type { BackendTeam } from "@/types/backend";
import type { AppMatchSummary } from "@/types/match";
import { useMatchTeamLogos } from "../useMatchTeamLogos";
const team = (id: number, logo_url: string) => ({ id, logo_url } as BackendTeam);
function setup(match: Partial<AppMatchSummary>, opponent: BackendTeam | null = null) {
  const sourceMatch = ref({ host_team_id: 1, ...match } as AppMatchSummary);
  const teamsById = ref<Record<number, BackendTeam>>({ 1: team(1, "host.png") });
  const isPickupMatch = ref(false);
  return { sourceMatch, teamsById, isPickupMatch, ...useMatchTeamLogos({ sourceMatch, teamsById, opponentTeam: ref(opponent), isPickupMatch }) };
}
describe("match team logos", () => {
  test("named away team without an ID never inherits the host logo", () => {
    const state = setup({ away_team_id: null, opponent_name: "内江朋友队" }, team(1, "host.png"));
    expect(state.awayTeamLogoUrl.value).toEqual("");
    expect(state.homeTeamLogoUrl.value).toEqual("host.png");
  });
  test("away team without a logo never inherits an unrelated opponent logo", () => {
    expect(setup({ away_team_id: 2 }, team(1, "host.png")).awayTeamLogoUrl.value).toEqual("");
  });
  test("uses matching away fallback and prefers the DTO logo", () => {
    const state = setup({ away_team_id: 2 }, team(2, "away.png"));
    expect(state.awayTeamLogoUrl.value).toEqual("away.png");
    state.sourceMatch.value.away_team_logo_url = " dto.png ";
    expect(state.awayTeamLogoUrl.value).toEqual("dto.png");
    state.isPickupMatch.value = true;
    expect(state.awayTeamLogoUrl.value).toEqual("");
    expect(state.homeTeamLogoUrl.value).toEqual("");
  });
  test("uses the away team's cache when available", () => {
    const state = setup({ away_team_id: 2 });
    state.teamsById.value[2] = team(2, "cached.png");
    expect(state.awayTeamLogoUrl.value).toEqual("cached.png");
  });
});
