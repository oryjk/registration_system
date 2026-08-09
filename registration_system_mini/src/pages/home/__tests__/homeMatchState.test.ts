import { describe, expect, test } from "bun:test";
import {
  buildHomeMatchSections,
  groupMatchesByPhase,
  resolveMatchPhase,
  toGoHomeMatchCard,
} from "../homeMatchState";
import type { AppHomeActionMatch, AppHomeEndedMatch, AppMatchHomeResponse } from "@/types/match";

const now = new Date("2026-08-09T12:00:00.000Z");
const nowIso = "2026-08-09T12:00:00.000Z";
const futureSoonIso = "2026-08-09T12:30:00.000Z";
const futureLaterIso = "2026-08-09T13:00:00.000Z";
const laterIso = "2026-08-09T14:00:00.000Z";
const muchLaterIso = "2026-08-09T18:00:00.000Z";
const earlierIso = "2026-08-09T10:00:00.000Z";
const muchEarlierIso = "2026-08-09T08:00:00.000Z";

const baseActionMatch = {
  status: "registering" as const,
  host_team_name: "银河联队",
  opponent_name: "红星队",
  players_per_team: 8,
  location: "A 场",
  group: {
    id: "group-base",
    kind: "host_team" as const,
    status: "open" as const,
    min_players: 8,
    max_players: 16,
    attending_count: 6,
    my_registration_status: "unknown" as const,
  },
};

function buildActionMatch(overrides: Partial<AppHomeActionMatch>): AppHomeActionMatch {
  return {
    id: "placeholder",
    start_time: laterIso,
    end_time: muchLaterIso,
    name: "默认比赛",
    ...baseActionMatch,
    ...overrides,
    group: {
      ...baseActionMatch.group,
      ...overrides.group,
    },
  };
}

function buildEndedMatch(overrides: Partial<AppHomeEndedMatch>): AppHomeEndedMatch {
  return {
    id: "ended-placeholder",
    status: "ended",
    start_time: earlierIso,
    end_time: muchEarlierIso,
    name: "默认已结束比赛",
    host_team_name: "银河联队",
    opponent_name: "红星队",
    location: "A 场",
    ...overrides,
  };
}

describe("resolveMatchPhase", () => {
  const base = buildActionMatch({ id: "phase-base" });

  test("treats cancelled and explicit ended matches as excluded or ended", () => {
    const cancelled = { ...base, status: "cancelled" as const };
    const explicitEnded = { ...buildEndedMatch({ id: "ended-explicit" }), status: "ended" as const };

    expect(resolveMatchPhase(cancelled, now)).toEqual("excluded");
    expect(resolveMatchPhase(explicitEnded, now)).toEqual("ended");
  });

  test("switches by boundary timestamps with UTC fixtures", () => {
    expect(resolveMatchPhase({ ...base, status: "ongoing" as const, end_time: nowIso }, now)).toEqual("ended");
    expect(resolveMatchPhase({ ...base, start_time: nowIso, end_time: laterIso }, now)).toEqual("ongoing");
    expect(resolveMatchPhase({ ...base, start_time: laterIso }, now)).toEqual("upcoming");
  });
});

describe("groupMatchesByPhase", () => {
  test("sorts each visible phase and keeps one copy per id before grouping", () => {
    const sharedUpcoming = buildActionMatch({
      id: "shared-id",
      name: "共享赛事",
      start_time: muchLaterIso,
      end_time: "2026-08-09T20:00:00.000Z",
      group: {
        ...baseActionMatch.group,
        attending_count: 12,
      },
    });
    const upcomingEarly = buildActionMatch({
      id: "upcoming-early",
      name: "更早的报名中比赛",
      start_time: futureSoonIso,
      end_time: laterIso,
      group: {
        ...baseActionMatch.group,
        attending_count: 4,
      },
    });
    const upcomingLate = buildActionMatch({
      id: "upcoming-late",
      name: "更晚的报名中比赛",
      start_time: futureLaterIso,
      end_time: muchLaterIso,
      group: {
        ...baseActionMatch.group,
        attending_count: 9,
      },
    });
    const ongoingA = buildActionMatch({
      id: "ongoing-a",
      status: "ongoing",
      name: "进行中 A",
      start_time: "2026-08-09T09:30:00.000Z",
      end_time: laterIso,
      group: {
        ...baseActionMatch.group,
        status: "closed",
        attending_count: 11,
      },
    });
    const ongoingB = buildActionMatch({
      id: "ongoing-b",
      status: "ongoing",
      name: "进行中 B",
      start_time: "2026-08-09T10:30:00.000Z",
      end_time: laterIso,
      group: {
        ...baseActionMatch.group,
        status: "closed",
        attending_count: 13,
      },
    });
    const ongoingC = buildActionMatch({
      id: "ongoing-c",
      status: "ongoing",
      name: "进行中 C",
      start_time: "2026-08-09T11:45:00.000Z",
      end_time: laterIso,
      group: {
        ...baseActionMatch.group,
        status: "closed",
        attending_count: 15,
      },
    });
    const endedShared = buildEndedMatch({
      id: "shared-id",
      name: "共享赛事（已结束）",
      end_time: muchEarlierIso,
    });
    const endedOne = buildEndedMatch({
      id: "ended-a",
      name: "已结束 A",
      end_time: "2026-08-09T09:50:00.000Z",
    });
    const endedTwo = buildEndedMatch({
      id: "ended-b",
      name: "已结束 B",
      end_time: "2026-08-09T09:20:00.000Z",
    });
    const endedThree = buildEndedMatch({
      id: "ended-c",
      name: "已结束 C",
      end_time: "2026-08-09T08:20:00.000Z",
    });

    const grouped = groupMatchesByPhase(
      [
        upcomingLate,
        ongoingA,
        sharedUpcoming,
        ongoingC,
        upcomingEarly,
        ongoingB,
        endedOne,
        endedTwo,
        endedThree,
      ],
      now,
    );

    expect(grouped.upcoming.map((item) => item.id)).toEqual(["upcoming-early", "upcoming-late", "shared-id"]);
    expect(grouped.ongoing.map((item) => item.id)).toEqual(["ongoing-c", "ongoing-b", "ongoing-a"]);
    expect(grouped.ended.map((item) => item.id)).toEqual(["ended-a", "ended-b", "ended-c"]);

    const sections = buildHomeMatchSections(
      {
        action_items: [
          upcomingLate,
          ongoingA,
          sharedUpcoming,
          ongoingC,
          upcomingEarly,
          ongoingB,
        ],
        ended_items: [endedShared, endedOne, endedTwo, endedThree],
        ended_has_more: false,
      },
      now,
      2,
    );

    expect(sections.map((section) => section.phase)).toEqual(["upcoming", "ongoing", "ended"]);
    expect(sections.map((section) => section.items.length)).toEqual([2, 2, 2]);
    expect(sections[0].items.map((item) => item.id)).toEqual(["upcoming-early", "upcoming-late"]);
    expect(sections[1].items.map((item) => item.id)).toEqual(["ongoing-c", "ongoing-b"]);
    expect(sections[2].items.map((item) => item.id)).toEqual(["ended-a", "ended-b"]);
  });
});

describe("toGoHomeMatchCard", () => {
  test("maps visible phases to phase-aware labels and flags", () => {
    const card = toGoHomeMatchCard(
      {
        id: "upcoming-card",
        status: "registering",
        start_time: laterIso,
        end_time: muchLaterIso,
        name: "报名中比赛",
        host_team_name: "银河联队",
        opponent_name: "红星队",
        players_per_team: 8,
        location: "A 场",
        group: {
          id: "group-upcoming",
          kind: "host_team",
          status: "open",
          min_players: 8,
          max_players: 16,
          attending_count: 10,
          my_registration_status: "unknown",
        },
      },
      "upcoming",
    );

    expect(card.id).toEqual("upcoming-card");
    expect(card.phase).toEqual("upcoming");
    expect(card.stage).toEqual("报名中");
    expect(card.dateNote).toEqual("截止报名");
    expect(card.actionLabel).toEqual("去报名");
    expect(card.canRegister).toEqual(true);
    expect(card.showRegistrationProgress).toEqual(true);
    expect(card.showParticipantAvatars).toEqual(true);
    expect(card.canOpenDetail).toEqual(true);
  });
});
