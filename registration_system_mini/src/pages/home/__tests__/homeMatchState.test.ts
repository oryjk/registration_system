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

describe("home phase layering", () => {
  function sectionIds(sections: ReturnType<typeof buildHomeMatchSections>, phase: "upcoming" | "ongoing" | "ended") {
    return sections.find((section) => section.phase === phase)?.items.map((item) => item.id) ?? [];
  }

  test("keeps all three phases side by side without cross-contaminating the action deck pool", () => {
    const future = buildActionMatch({ id: "up-1", start_time: futureSoonIso });
    const ongoing = buildActionMatch({ id: "on-1", start_time: earlierIso, end_time: laterIso });
    const ended = buildEndedMatch({ id: "end-1" });

    const sections = buildHomeMatchSections({
      action_items: [future, ongoing],
      action_has_more: false,
      ended_items: [ended],
      ended_has_more: false,
    }, now);

    expect(sectionIds(sections, "upcoming")).toEqual(["up-1"]);
    expect(sectionIds(sections, "ongoing")).toEqual(["on-1"]);
    expect(sectionIds(sections, "ended")).toEqual(["end-1"]);
    // 待处理集合不得混入进行中/已结束（toEqual 精确匹配已排除混入）。
  });

  test("ongoing-only data stays in the ongoing section instead of feeding the action deck", () => {
    const ongoing = buildActionMatch({ id: "on-only", start_time: earlierIso, end_time: laterIso });
    const sections = buildHomeMatchSections({
      action_items: [ongoing],
      action_has_more: false,
      ended_items: [],
      ended_has_more: false,
    }, now);

    expect(sectionIds(sections, "upcoming")).toEqual([]);
    expect(sectionIds(sections, "ongoing")).toEqual(["on-only"]);
    expect(sectionIds(sections, "ended")).toEqual([]);
  });

  test("ended-only data stays in the ended section", () => {
    const ended = buildEndedMatch({ id: "end-only" });
    const sections = buildHomeMatchSections({
      action_items: [],
      action_has_more: false,
      ended_items: [ended],
      ended_has_more: false,
    }, now);

    expect(sectionIds(sections, "upcoming")).toEqual([]);
    expect(sectionIds(sections, "ongoing")).toEqual([]);
    expect(sectionIds(sections, "ended")).toEqual(["end-only"]);
  });

  test("empty payloads produce empty sections for every phase", () => {
    const sections = buildHomeMatchSections({
      action_items: [],
      action_has_more: false,
      ended_items: [],
      ended_has_more: false,
    }, now);

    expect(sections.map((section) => section.items)).toEqual([[], [], []]);
  });

  test("ongoing and ended cards are compact view cards with view-only actions", () => {
    const ongoingCard = toHomeMatchCard(buildActionMatch({ id: "on-view", start_time: earlierIso, end_time: laterIso }), "ongoing");
    const endedCard = toHomeMatchCard(buildEndedMatch({ id: "end-view" }), "ended");
    const upcomingCard = toHomeMatchCard(buildActionMatch({ id: "up-view" }), "upcoming");

    expect(upcomingCard.viewMode).toEqual("action");
    expect(ongoingCard.viewMode).toEqual("compact");
    expect(endedCard.viewMode).toEqual("compact");
    // 查看型卡片的普通用户操作仅为查看：不可报名、按钮语义为查看。
    expect(ongoingCard.canRegister).toEqual(false);
    expect(endedCard.canRegister).toEqual(false);
    expect(ongoingCard.actionLabel).toEqual("查看比赛");
    expect(endedCard.actionLabel).toEqual("查看比赛");
    expect(ongoingCard.showRegistrationProgress).toEqual(true);
    expect(endedCard.showRegistrationProgress).toEqual(false);
    // 查看型紧凑卡不渲染头像行。
    expect(ongoingCard.showParticipantAvatars).toEqual(false);
    expect(endedCard.showParticipantAvatars).toEqual(false);
  });

  test("score labels come only from real backend scores and never for upcoming cards", () => {
    const scored = toHomeMatchCard(buildEndedMatch({ id: "end-score", host_score: 3, away_score: 1 }), "ended");
    const unscored = toHomeMatchCard(buildEndedMatch({ id: "end-noscore", host_score: null, away_score: null }), "ended");
    const upcoming = toHomeMatchCard(buildActionMatch({ id: "up-noscore" }), "upcoming");

    expect(scored.scoreLabel).toEqual("3 : 1");
    expect(unscored.scoreLabel).toEqual(null);
    expect(upcoming.scoreLabel).toEqual(null);
  });

  test("score notes distinguish ongoing from ended instead of implying every match is finished", () => {
    const ended = toHomeMatchCard(buildEndedMatch({ id: "end-note", host_score: 3, away_score: 1 }), "ended");
    expect(ended.scoreNote).toEqual("最终比分");

    // 搜索/列表来源的进行中比赛带实时比分：文案必须是「当前比分」。
    const ongoingSummary = toHomeMatchCard(
      {
        id: "on-note",
        status: "ongoing" as const,
        start_time: earlierIso,
        end_time: laterIso,
        host_score: 2,
        away_score: 1,
        publication_mode: "online_team" as const,
        opponent_state: "no_recruitment" as const,
        registration_start_at: null,
        registration_end_at: null,
        name: "进行中比赛",
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
      } satisfies AppMatchSummary,
      "ongoing",
    );
    expect(ongoingSummary.scoreLabel).toEqual("2 : 1");
    expect(ongoingSummary.scoreNote).toEqual("当前比分");

    // 无比分时前缀同为 null，卡片不渲染比分行。
    const unscoredNote = toHomeMatchCard(buildEndedMatch({ id: "end-note-none", host_score: null, away_score: null }), "ended");
    expect(unscoredNote.scoreNote).toEqual(null);
  });

  test("timestamp-expired matches with backend status ongoing keep the live score wording", () => {
    // 边界（用户 0:0 复现）：超过预定结束时间但后端仍未收尾（status=ongoing）的比赛
    // 出现在 ended_items 并被时间戳归入 ended 分区，但比分文案不能暗示比赛已结束。
    const expiredButOngoing = buildHomeMatchSections(
      {
        action_items: [],
        action_has_more: false,
        ended_items: [
          buildEndedMatch({
            id: "expired-ongoing",
            status: "ongoing" as const,
            host_score: 0,
            away_score: 0,
          }),
        ],
        ended_has_more: false,
      },
      now,
    );

    expect(expiredButOngoing[2].items.map((item) => item.id)).toEqual(["expired-ongoing"]);
    const card = expiredButOngoing[2].items[0];
    expect(card.phase).toEqual("ended");
    expect(card.scoreLabel).toEqual("0 : 0");
    expect(card.scoreNote).toEqual("当前比分");

    // 后端明确收尾后才叫最终比分。
    const officiallyEnded = buildHomeMatchSections(
      {
        action_items: [],
        action_has_more: false,
        ended_items: [
          buildEndedMatch({
            id: "officially-ended",
            status: "ended" as const,
            host_score: 2,
            away_score: 1,
          }),
        ],
        ended_has_more: false,
      },
      now,
    );
    expect(officiallyEnded[2].items[0].scoreNote).toEqual("最终比分");
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

  test("drops the avatar row on ended home matches (compact view cards keep the list tight)", () => {
    const emptyEnded = toHomeMatchCard(buildEndedMatch({ id: "ended-empty" }), "ended");
    expect(emptyEnded.showParticipantAvatars).toEqual(false);
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
