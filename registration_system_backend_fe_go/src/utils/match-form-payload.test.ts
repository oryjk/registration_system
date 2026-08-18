import {
  buildCreateMatchPayload,
  buildUpdateMatchPayload,
  defaultHostCapacityLimit,
  type MatchFormPayloadValues,
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

const baseFormValues = (
  overrides: Partial<MatchFormPayloadValues>,
): MatchFormPayloadValues => ({
  ...baseValues,
  ...overrides,
});

describe("match form payload", () => {
  it("builds the complete create contract with ISO dates", () => {
    expect(buildCreateMatchPayload(baseValues)).toEqual({
      name: "夏夜联赛",
      publication_mode: "online_team",
      is_free: false,
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
      host_color: null,
      away_color: null,
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
      opponent_name: null,
      host_capacity_limit: 12,
      host_color: null,
      away_color: null,
    });
  });

  it("sends the opponent name in the update contract for offline matches", () => {
    expect(
      buildUpdateMatchPayload({
        ...baseValues,
        publication_mode: "offline_confirmed",
        opponent_name: "  河西联  ",
      }).opponent_name,
    ).toEqual("河西联");
    expect(
      buildUpdateMatchPayload({
        ...baseValues,
        publication_mode: "offline_confirmed",
        opponent_name: undefined,
      }).opponent_name,
    ).toEqual(null);
  });

  it("sends null capacity in the update contract when the field is empty", () => {
    expect(
      buildUpdateMatchPayload({
        ...baseValues,
        host_capacity_limit: undefined,
      }).host_capacity_limit,
    ).toEqual(null);
  });

  it("defaults the host capacity to four players above the team size", () => {
    expect(defaultHostCapacityLimit(8)).toEqual(12);
    expect(defaultHostCapacityLimit(11)).toEqual(15);
  });
});

describe("match form free flag", () => {
  it("keeps the admin default paid and forwards an explicit free choice", () => {
    expect(buildCreateMatchPayload(baseValues).is_free).toEqual(false);
    expect(
      buildCreateMatchPayload({ ...baseValues, is_free: true }).is_free,
    ).toEqual(true);
  });
});

describe("match form jersey colors", () => {
  test("carries jersey colors normalized to lowercase hex", () => {
    const values = baseFormValues({
      host_color: "#2F6BFF",
      away_color: "#FF0000",
    });
    expect(buildCreateMatchPayload(values)).toMatchObject({
      host_color: "#2f6bff",
      away_color: "#ff0000",
    });
    expect(buildUpdateMatchPayload(values)).toMatchObject({
      host_color: "#2f6bff",
      away_color: "#ff0000",
    });
  });

  test("omits jersey colors when unset so update keeps them untouched", () => {
    const values = baseFormValues({});
    expect(buildUpdateMatchPayload(values)).toMatchObject({
      host_color: null,
      away_color: null,
    });
  });
});
