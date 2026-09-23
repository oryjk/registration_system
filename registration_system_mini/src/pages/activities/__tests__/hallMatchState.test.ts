import { describe, expect, test } from "bun:test";
import {
  buildHallCalendarDays,
  filterHallMatches,
  hallDateKey,
  toHallMatchCard,
  toLocalMidnightDate,
} from "../hallMatchState";
import type { AppMatchSummary } from "@/types/match";

function buildMatch(overrides: Partial<AppMatchSummary>): AppMatchSummary {
  // 起止时间取未来 30 天：报名开放判断会参考比赛结束时间，固定旧日期会让卡片退化为「查看比赛」。
  const startTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
  return {
    id: "match-1",
    status: "registering",
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    name: "周六散人约局",
    publication_mode: "online_individual",
    opponent_state: "recruiting",
    registration_start_at: null,
    registration_end_at: null,
    host_team_id: 7,
    host_team_name: "蓝翼俱乐部",
    away_team_id: null,
    away_team_name: null,
    opponent_name: null,
    players_per_team: 8,
    location: "望京体育中心 3 号场",
    location_latitude: null,
    location_longitude: null,
    description: null,
    registration_groups: [],
    created_at: "2026-08-15T00:00:00.000Z",
    updated_at: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("toHallMatchCard", () => {
  test("maps individual match with pickup progress from individual group", () => {
    const card = toHallMatchCard(buildMatch({
      registration_groups: [
        { kind: "host_team", team_id: 7, min_players: null, max_players: 10, attending_count: 6 },
        { kind: "individual_opponent", team_id: null, min_players: 4, max_players: 8, attending_count: 3 },
      ],
    }));

    expect(card.kindLabel).toEqual("散人约局");
    expect(card.kindTone).toEqual("lime");
    expect(card.opponentStateLabel).toEqual("凑人中");
    expect(card.opponentStateTone).toEqual("amber");
    expect(card.showProgress).toEqual(true);
    expect(card.progressLabel).toEqual("凑人进度");
    expect(card.joinedPlayers).toEqual(3);
    expect(card.requiredPlayers).toEqual(4);
    expect(card.maxPlayers).toEqual(8);
    expect(card.hostJoinedLabel).toEqual("");
    expect(card.actionLabel).toEqual("去凑局");
    expect(card.detailUrl).toEqual("/pages/matches/detail?id=match-1");
  });

  test("maps guest team progress inheriting the host capacity when unset", () => {
    const card = toHallMatchCard(buildMatch({
      publication_mode: "online_team",
      opponent_state: "confirmed",
      registration_start_at: null,
      registration_end_at: null,
      away_team_id: 11,
      away_team_name: "洺悦御府",
      registration_groups: [
        { kind: "guest_team", team_id: 11, min_players: null, max_players: null, attending_count: 3 },
        { kind: "host_team", team_id: 7, min_players: null, max_players: 12, attending_count: 5 },
      ],
    }));

    expect(card.hostJoinedLabel).toEqual("主队 5/12");
    // 客队上限未配置时继承主队容量，主客同制。
    expect(card.guestJoinedLabel).toEqual("客队 3/12");
    // 列表渲染主/客两条进度条，各自带队名和继承后的上限。
    expect(card.progressBars).toEqual([
      { key: "host", label: "蓝翼俱乐部", joined: 5, required: 8, max: 12 },
      { key: "guest", label: "洺悦御府", joined: 3, required: 8, max: 12 },
    ]);
  });

  test("keeps a single progress bar for matches without a guest group", () => {
    const card = toHallMatchCard(buildMatch({
      publication_mode: "online_team",
      registration_groups: [
        { kind: "host_team", team_id: 7, min_players: null, max_players: 10, attending_count: 6 },
      ],
    }));

    expect(card.guestJoinedLabel).toEqual("");
    expect(card.progressBars).toEqual([
      { key: "main", label: "报名进度", joined: 6, required: 8, max: 10 },
    ]);
  });

  test("maps team match with host registration progress and recruiting state", () => {
    const card = toHallMatchCard(buildMatch({
      publication_mode: "online_team",
      registration_groups: [
        { kind: "host_team", team_id: 7, min_players: null, max_players: 10, attending_count: 6 },
      ],
    }), { teamId: 999, isCaptain: true });

    expect(card.kindLabel).toEqual("球队约队");
    expect(card.kindTone).toEqual("blue");
    expect(card.opponentStateLabel).toEqual("招对手中");
    expect(card.progressLabel).toEqual("报名进度");
    expect(card.joinedPlayers).toEqual(6);
    expect(card.requiredPlayers).toEqual(10);
    expect(card.hostJoinedLabel).toEqual("主队 6/10");
    expect(card.actionLabel).toEqual("接约");
  });

  test("preserves real minimums and unlimited capacities for compact progress", () => {
    const card = toHallMatchCard(buildMatch({
      publication_mode: "online_team",
      registration_groups: [
        { kind: "host_team", team_id: 7, min_players: 6, max_players: null, attending_count: 7 },
        { kind: "guest_team", team_id: 11, min_players: null, max_players: null, attending_count: 5 },
      ],
    }));
    expect(card.progressBars.map(({ joined, required, max }) => ({ joined, required, max }))).toEqual([
      { joined: 7, required: 6, max: null },
      { joined: 5, required: 6, max: null },
    ]);
  });

  test("confirmed matches show settled state and plain action", () => {
    const card = toHallMatchCard(buildMatch({
      publication_mode: "online_individual",
      opponent_state: "confirmed",
      registration_start_at: null,
      registration_end_at: null,
      registration_groups: [
        { kind: "individual_opponent", team_id: null, min_players: 4, max_players: 8, attending_count: 5 },
      ],
    }));

    expect(card.opponentStateLabel).toEqual("已成局");
    expect(card.opponentStateTone).toEqual("green");
    expect(card.actionLabel).toEqual("查看详情");
  });

  test("falls back to players per team when no group summary exists", () => {
    const card = toHallMatchCard(buildMatch({ players_per_team: 5 }));

    expect(card.showProgress).toEqual(false);
    expect(card.formatLabel).toEqual("5 人制");
    expect(card.opponentName).toEqual("待定");
  });
});

describe("filterHallMatches", () => {
  const teamMatch = buildMatch({ id: "team-match", publication_mode: "online_team", players_per_team: 8 });
  const individualMatch = buildMatch({ id: "individual-match", publication_mode: "online_individual", players_per_team: 5 });
  const source = [teamMatch, individualMatch];
  const cards = [teamMatch, individualMatch].map((match) => toHallMatchCard(match));

  test("keeps everything for all filter", () => {
    expect(filterHallMatches(cards, source, "all", 0).length).toEqual(2);
  });

  test("filters by publication kind", () => {
    const teamOnly = filterHallMatches(cards, source, "team", 0);
    expect(teamOnly.map((card) => card.id)).toEqual(["team-match"]);

    const individualOnly = filterHallMatches(cards, source, "individual", 0);
    expect(individualOnly.map((card) => card.id)).toEqual(["individual-match"]);
  });

  test("filters by players per team size", () => {
    expect(filterHallMatches(cards, source, "all", 8).map((card) => card.id)).toEqual(["team-match"]);
    expect(filterHallMatches(cards, source, "all", 5).map((card) => card.id)).toEqual(["individual-match"]);
  });

  test("filters my related matches from the same all-scope results", () => {
    const mine = [
      buildMatch({ id: "team-related", publication_mode: "online_team", players_per_team: 8, is_related_to_me: true }),
      buildMatch({ id: "registration-related", publication_mode: "online_individual", players_per_team: 5, is_related_to_me: true }),
      buildMatch({ id: "unrelated", publication_mode: "online_team", players_per_team: 8, is_related_to_me: false }),
    ];
    const mineCards = mine.map((match) => toHallMatchCard(match));

    expect(filterHallMatches(mineCards, mine, "mine", 0).map((card) => card.id)).toEqual([
      "team-related", "registration-related",
    ]);
    expect(filterHallMatches(mineCards, mine, "mine", 5).map((card) => card.id)).toEqual(["registration-related"]);
  });
});

describe("buildHallCalendarDays", () => {
  test("builds seven days starting from today", () => {
    const days = buildHallCalendarDays(new Date(2026, 7, 15, 18, 30));

    expect(days.length).toEqual(7);
    expect(days[0]).toEqual({ key: "2026-08-15", badgeLabel: "今天", dayNumber: "15" });
    expect(days[1]).toEqual({ key: "2026-08-16", badgeLabel: "周日", dayNumber: "16" });
    expect(days[6]).toEqual({ key: "2026-08-21", badgeLabel: "周五", dayNumber: "21" });
  });
});

describe("hallDateKey", () => {
  test("formats local calendar date key", () => {
    expect(hallDateKey("2026-08-20 15:00:00")).toEqual(`2026-08-20`);
  });
});

describe("toLocalMidnightDate", () => {
  test("returns local midnight for a calendar date key", () => {
    const midnight = toLocalMidnightDate("2026-08-16");

    expect(midnight === null).toEqual(false);
    expect(midnight!.getFullYear()).toEqual(2026);
    expect(midnight!.getMonth()).toEqual(7);
    expect(midnight!.getDate()).toEqual(16);
    expect(midnight!.getHours()).toEqual(0);
  });

  test("rejects malformed keys", () => {
    expect(toLocalMidnightDate("2026/08/16")).toEqual(null);
    expect(toLocalMidnightDate("")).toEqual(null);
  });
});

describe("hall card action kinds by viewer context", () => {
  const teamMatch = buildMatch({ publication_mode: "online_team", host_team_id: 7 });

  test("host team member gets register action", () => {
    const card = toHallMatchCard(teamMatch, { teamId: 7, isCaptain: false });
    expect(card.actionKind).toEqual("register");
    expect(card.actionLabel).toEqual("去报名");
    expect(card.detailUrl).toEqual(`/pages/matches/detail?id=${teamMatch.id}`);
  });

  test("opposing team captain gets accept action pointing to apply page", () => {
    const card = toHallMatchCard(teamMatch, { teamId: 999, isCaptain: true });
    expect(card.actionKind).toEqual("accept");
    expect(card.actionLabel).toEqual("接约");
    expect(card.applyUrl).toEqual(`/pages/matches/apply-team/index?id=${teamMatch.id}`);
  });

  test("window outside the open interval only offers the detail view", () => {
    const beforeStart = buildMatch({
      registration_start_at: "2026-08-20T12:00:00.000Z",
      registration_end_at: "2026-08-20T14:00:00.000Z",
    });
    const afterEnd = buildMatch({
      registration_start_at: "2026-08-20T08:00:00.000Z",
      registration_end_at: "2026-08-20T10:00:00.000Z",
    });
    const viewer = { teamId: 999, isCaptain: true };

    expect(toHallMatchCard(beforeStart, viewer, Date.parse("2026-08-20T10:00:00.000Z")).actionKind).toEqual("view");
    expect(toHallMatchCard(afterEnd, viewer, Date.parse("2026-08-20T10:00:00.000Z")).actionKind).toEqual("view");
  });

  test("other team member without captain role only gets view action", () => {
    const card = toHallMatchCard(teamMatch, { teamId: 999, isCaptain: false });
    expect(card.actionKind).toEqual("view");
    expect(card.actionLabel).toEqual("查看详情");
  });

  test("confirmed team match gives registration to both teams", () => {
    const confirmed = buildMatch({
      publication_mode: "online_team",
      opponent_state: "confirmed",
      registration_start_at: null,
      registration_end_at: null,
      host_team_id: 7,
      away_team_id: 42,
    });
    expect(toHallMatchCard(confirmed, { teamId: 7, isCaptain: false }).actionKind).toEqual("register");
    expect(toHallMatchCard(confirmed, { teamId: 7, isCaptain: false }).actionLabel).toEqual("去报名");
    expect(toHallMatchCard(confirmed, { teamId: 42, isCaptain: false }).actionKind).toEqual("register");
    expect(toHallMatchCard(confirmed, { teamId: 42, isCaptain: true }).actionLabel).toEqual("去报名");
  });

  test("confirmed team match falls back to view for unrelated viewers", () => {
    const confirmed = buildMatch({
      publication_mode: "online_team",
      opponent_state: "confirmed",
      registration_start_at: null,
      registration_end_at: null,
      host_team_id: 7,
      away_team_id: 42,
    });
    expect(toHallMatchCard(confirmed, { teamId: 999, isCaptain: true }).actionKind).toEqual("view");
    expect(toHallMatchCard(confirmed, { teamId: null, isCaptain: false }).actionKind).toEqual("view");
  });

  test("captain status without a team cannot accept and host captains still register", () => {
    expect(toHallMatchCard(teamMatch, { teamId: null, isCaptain: true }).actionKind).toEqual("view");
    expect(toHallMatchCard(teamMatch, { teamId: 7, isCaptain: true }).actionKind).toEqual("register");
  });

  test("individual match keeps join action regardless of viewer", () => {
    expect(toHallMatchCard(buildMatch({}), { teamId: 7, isCaptain: true }).actionKind).toEqual("join");
  });
});

 test("满员提示按真实上限判断，成局和人数不限不等于满员", () => {
   for (const [joined, max, full] of [[21,21,true], [22,21,true], [16,21,false], [21,null,false]] as const) {
     const card = toHallMatchCard(buildMatch({ publication_mode: "online_pickup", opponent_state: "confirmed",
       registration_groups: [{kind:"individual_opponent",team_id:null,min_players:16,max_players:max,attending_count:joined}],
     }));
     expect(card.capacityHint !== "").toEqual(full);
     expect(card.opponentStateLabel).toEqual(full ? "报名已满" : "已成局");
     if (full) expect(card.actionLabel).toEqual("查看详情");
   }
 });


test("historical search cards show match state and only allow viewing", () => {
  for (const [status, label] of [["ended", "已结束"], ["cancelled", "已取消"], ["ongoing", "进行中"]] as const) {
    const card = toHallMatchCard(buildMatch({ status }));
    expect([card.opponentStateLabel, card.actionKind, card.actionLabel, card.capacityHint])
      .toEqual([label, "view", "查看详情", ""]);
  }
  const expired = toHallMatchCard(buildMatch({ start_time: "2020-01-01T12:00:00Z", end_time: "2020-01-01T14:00:00Z" }));
  expect([expired.opponentStateLabel, expired.actionKind]).toEqual(["已结束", "view"]);
});
