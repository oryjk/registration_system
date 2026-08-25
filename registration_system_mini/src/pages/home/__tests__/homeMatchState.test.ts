import { describe, expect, test } from "bun:test";
import {
  buildHomeMatchSections,
  resolveMatchPhase,
  toHomeMatchCard,
} from "../homeMatchState";
import { formatHomeMatchDateBlock } from "../homeMatchDate";
import type { AppHomeActionMatch, AppHomeEndedMatch, AppMatchSummary } from "@/types/match";

const now = new Date("2026-08-09T12:00:00.000Z");
const nowIso = "2026-08-09T12:00:00.000Z";
const futureSoonIso = "2026-08-09T12:30:00.000Z";
const futureLaterIso = "2026-08-09T13:00:00.000Z";
const laterIso = "2026-08-09T14:00:00.000Z";
const muchLaterIso = "2026-08-09T18:00:00.000Z";
const earlierIso = "2026-08-09T10:00:00.000Z";
const muchEarlierIso = "2026-08-09T08:00:00.000Z";

describe("formatHomeMatchDateBlock", () => {
  test("keeps the displayed month-day and time while deriving the weekday from the raw cross-year start time", () => {
    expect(formatHomeMatchDateBlock({
      dateLabel: "01/01 20:00",
      dateSource: "2027-01-01T20:00:00.000Z",
    })).toEqual({
      monthDay: "01/01",
      weekday: "周五",
      timeLabel: "20:00",
    });
  });
});

const baseActionMatch = {
  status: "registering" as const,
  publication_mode: "online_team" as const,
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
    publication_mode: "offline_confirmed",
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

describe("buildHomeMatchSections", () => {
  test("reclassifies related matches by actual timestamps and ignores unrelated future matches", () => {
    const expiredAction = buildActionMatch({
      id: "action-expired",
      name: "实际已结束但状态未更新",
      start_time: muchEarlierIso,
      end_time: earlierIso,
    });
    const ongoingAction = buildActionMatch({
      id: "action-ongoing",
      name: "报名结束但比赛未结束",
      start_time: earlierIso,
      end_time: laterIso,
    });
    const futureAction = buildActionMatch({
      id: "action-future",
      name: "即将开始",
      start_time: futureSoonIso,
    });
    const ended = buildEndedMatch({ id: "ended-a", name: "已结束 A" });

    const sections = buildHomeMatchSections({
      action_items: [expiredAction, ongoingAction, futureAction],
      action_has_more: false,
      ended_items: [ended],
      ended_has_more: true,
    }, now, 2);

    expect(sections.map((section) => section.phase)).toEqual(["upcoming", "ongoing", "ended"]);
    expect(sections.map((section) => section.title)).toEqual(["最近要处理", "进行中", "已结束"]);
    expect(sections[0].items.map((item) => item.id)).toEqual(["action-future"]);
    expect(sections[1].items.map((item) => item.id)).toEqual(["action-ongoing"]);
    expect(sections[2].items.map((item) => item.id)).toEqual(["action-expired", "ended-a"]);
  });

  test("sorts by phase semantics and limits every home section to two matches", () => {
    const sections = buildHomeMatchSections(
      {
        action_items: [
          buildActionMatch({ id: "action-late", start_time: laterIso }),
          buildActionMatch({ id: "action-ongoing", start_time: earlierIso, end_time: laterIso }),
          buildActionMatch({ id: "action-soon", start_time: futureSoonIso }),
          buildActionMatch({ id: "action-middle", start_time: futureLaterIso }),
        ],
        action_has_more: true,
        ended_items: [
          buildEndedMatch({ id: "ended-older", start_time: muchEarlierIso }),
          buildEndedMatch({ id: "ended-newer", start_time: earlierIso }),
        ],
        ended_has_more: false,
      },
      now,
      2,
    );

    expect(sections[0].items.map((item) => item.id)).toEqual(["action-soon", "action-middle"]);
    expect(sections[1].items.map((item) => item.id)).toEqual(["action-ongoing"]);
    expect(sections[2].items.map((item) => item.id)).toEqual(["ended-newer", "ended-older"]);
  });
});

describe("toHomeMatchCard", () => {
  test("maps visible phases to phase-aware labels and flags", () => {
    const card = toHomeMatchCard(
      {
        id: "upcoming-card",
        status: "registering",
        start_time: laterIso,
        end_time: muchLaterIso,
        name: "报名中比赛",
        publication_mode: "online_team",
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
    expect(card.stageTone).toEqual("lime");
    expect(card.statusTone).toEqual("blue");
    expect(card.dateBlock).toEqual(formatHomeMatchDateBlock(card));
    expect(card.publicationModeLabel).toEqual("线上约队");
    expect(card.dateNote).toEqual("截止报名");
    expect(card.actionLabel).toEqual("去报名");
    expect(card.canRegister).toEqual(true);
    expect(card.showRegistrationProgress).toEqual(true);
    expect(card.showParticipantAvatars).toEqual(true);
    expect(card.canOpenDetail).toEqual(true);
    expect(card.detailUrl).toEqual("/pages/matches/detail?id=upcoming-card&groupId=group-upcoming");
  });

  test("maps list summaries into the shared card model", () => {
    const summary = {
      id: "summary-1",
      status: "registering",
      start_time: laterIso,
      end_time: muchLaterIso,
      publication_mode: "online_individual",
      opponent_state: "recruiting",
      registration_start_at: null,
      registration_end_at: null,
      name: "列表比赛",
      host_team_id: 1,
      host_team_name: "银河联队",
      away_team_id: null,
      away_team_name: null,
      opponent_name: "红星队",
      players_per_team: 8,
      location: "A 场",
      location_latitude: null,
      location_longitude: null,
      description: null,
      created_at: "2026-08-08T12:00:00.000Z",
      updated_at: "2026-08-08T12:05:00.000Z",
    } satisfies AppMatchSummary;

    const card = toHomeMatchCard(summary, "upcoming");

    expect(card.id).toEqual("summary-1");
    expect(card.title).toEqual("列表比赛");
    expect(card.phase).toEqual("upcoming");
    expect(card.stage).toEqual("报名中");
    expect(card.stageTone).toEqual("lime");
    // summary 来源没有我的报名数据：不显示「我的状态」标签，tone 落到 muted。
    expect(card.myStatus).toEqual(null);
    expect(card.statusTone).toEqual("muted");
    expect(card.dateNote).toEqual("截止报名");
    expect(card.signupScope).toEqual("external");
    expect(card.signupScopeLabel).toEqual("散人报名");
    expect(card.publicationModeLabel).toEqual("散人对手");
    expect(card.formatLabel).toEqual("8 人制");
    expect(card.opponent).toEqual("红星队");
    expect(card.showRegistrationProgress).toEqual(false);
    expect(card.showParticipantAvatars).toEqual(false);
    expect(card.canRegister).toEqual(true);
    expect(card.canOpenDetail).toEqual(true);
  });

  test("keeps the avatar row on ended home matches so empty ones render the placeholder", () => {
    const emptyEnded = toHomeMatchCard(buildEndedMatch({ id: "ended-empty" }), "ended");
    expect(emptyEnded.showParticipantAvatars).toEqual(true);
    expect(emptyEnded.participantAvatars).toEqual([]);

    const withParticipants = toHomeMatchCard(
      buildEndedMatch({
        id: "ended-filled",
        participants: [
          { user_id: 7, nickname: "阿洪", avatar_url: null, status: "attending" },
        ],
      }),
      "ended",
    );
    expect(withParticipants.participantAvatars.length).toEqual(1);
    expect(withParticipants.participantAvatars[0].userId).toEqual(7);
    expect(withParticipants.participantAvatars[0].avatarUrl).toEqual("");
    expect(withParticipants.participantAvatars[0].displayText).toEqual("阿");
  });
});
