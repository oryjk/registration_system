import {
  buildCreateMatchPayload,
  buildUpdateMatchPayload,
} from "./match-form-payload";

const baseValues = {
  name: "  夏夜联赛  ",
  publication_mode: "online_team" as const,
  host_team_id: 9,
  players_per_team: 8,
  host_capacity_limit: 12,
  start_time: new Date("2026-08-10T11:00:00.000Z"),
  duration_minutes: 120,
  registration_start_at: new Date("2026-08-01T00:00:00.000Z"),
  registration_end_at: undefined,
  location: "  滨江足球场 1 号场  ",
  location_latitude: 30.123456,
  location_longitude: 120.654321,
  description: "  保留 API 字段测试  ",
};

describe("match form payload", () => {
  it("builds the complete create contract with ISO dates", () => {
    expect(buildCreateMatchPayload(baseValues)).toEqual({
      name: "夏夜联赛",
      publication_mode: "online_team",
      host_team_id: 9,
      opponent_name: null,
      players_per_team: 8,
      host_capacity_limit: 12,
      start_time: "2026-08-10T11:00:00.000Z",
      end_time: "2026-08-10T13:00:00.000Z",
      registration_start_at: "2026-08-01T00:00:00.000Z",
      registration_end_at: null,
      location: "滨江足球场 1 号场",
      location_latitude: 30.123456,
      location_longitude: 120.654321,
      description: "保留 API 字段测试",
    });
  });

  it("keeps the offline opponent and normalizes optional values", () => {
    expect(
      buildCreateMatchPayload({
        ...baseValues,
        publication_mode: "offline_confirmed",
        opponent_name: "  城西联队  ",
        host_capacity_limit: undefined,
        location_latitude: undefined,
        location_longitude: undefined,
        description: "   ",
      }),
    ).toMatchObject({
      opponent_name: "城西联队",
      host_capacity_limit: null,
      location_latitude: null,
      location_longitude: null,
      description: null,
    });
  });

  it("omits immutable create fields from the update contract", () => {
    expect(buildUpdateMatchPayload(baseValues)).toEqual({
      name: "夏夜联赛",
      start_time: "2026-08-10T11:00:00.000Z",
      end_time: "2026-08-10T13:00:00.000Z",
      registration_start_at: "2026-08-01T00:00:00.000Z",
      registration_end_at: null,
      location: "滨江足球场 1 号场",
      location_latitude: 30.123456,
      location_longitude: 120.654321,
      description: "保留 API 字段测试",
    });
  });
});
