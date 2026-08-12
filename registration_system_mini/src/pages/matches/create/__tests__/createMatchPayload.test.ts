import { describe, expect, test } from "bun:test";
import type { MatchPublishFormModel } from "@/components/matchPublishForm";
import { buildGoCreateMatchPayload } from "../createMatchPayload";

function buildForm(overrides: Partial<MatchPublishFormModel> = {}): MatchPublishFormModel {
  return {
    name: "周末友谊赛",
    location: "东安球场",
    locationLatitude: 30.6,
    locationLongitude: 104.1,
    holdingDate: Date.parse("2026-08-20T10:00:00.000Z"),
    matchEndTime: Date.parse("2026-08-20T12:00:00.000Z"),
    startTime: 0,
    endTime: 0,
    opposing: "周末联队",
    description: "准时到场",
    playersPerTeam: 6,
    color: "#2F6BFF",
    opposingColor: "#C8FF00",
    publicationMode: "offline_confirmed",
    ...overrides,
  };
}

describe("buildGoCreateMatchPayload", () => {
  test("maps a confirmed offline match to Go match time and capacity fields", () => {
    expect(buildGoCreateMatchPayload(buildForm(), { id: 7, name: "东安联队" })).toEqual({
      name: "周末友谊赛",
      publication_mode: "offline_confirmed",
      host_team_id: 7,
      opponent_name: "周末联队",
      players_per_team: 6,
      host_capacity_limit: 8,
      start_time: "2026-08-20T10:00:00.000Z",
      end_time: "2026-08-20T12:00:00.000Z",
      location: "东安球场",
      location_latitude: 30.6,
      location_longitude: 104.1,
      description: "准时到场",
    });
  });

  test("maps online team recruitment without a handwritten opponent", () => {
    const payload = buildGoCreateMatchPayload(
      buildForm({ publicationMode: "online_team", opposing: "不会提交的旧值" }),
      { id: 7, name: "东安联队" },
    );

    expect(payload.publication_mode).toEqual("online_team");
    expect("opponent_name" in payload).toEqual(false);
  });

  test("maps individual recruitment without a handwritten opponent", () => {
    const payload = buildGoCreateMatchPayload(
      buildForm({ publicationMode: "online_individual", opposing: "不会提交的旧值" }),
      { id: 7, name: "东安联队" },
    );

    expect(payload.publication_mode).toEqual("online_individual");
    expect("opponent_name" in payload).toEqual(false);
  });

  test("rejects a confirmed offline match without an opponent", () => {
    let message = "";
    try {
      buildGoCreateMatchPayload(buildForm({ publicationMode: "offline_confirmed", opposing: "  " }), {
        id: 7,
        name: "东安联队",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toEqual("线下已约比赛必须填写对手名称");
  });
});
