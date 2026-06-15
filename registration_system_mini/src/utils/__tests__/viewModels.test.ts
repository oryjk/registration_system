import { describe, expect, test } from "bun:test";
import type { BackendChallengeSummary } from "@/types/backend";
import {
  buildAttendanceSummary,
  buildBillingSummary,
  buildChallengeCards,
  buildNotificationItems,
  buildHomeMatchCards,
  buildJoinedIndividualHomeMatchCards,
  buildTeamProfiles,
  filterChallengeSummariesByScope,
  resolveUserDisplayHandle,
  resolveUserDisplayName,
} from "../viewModels";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("buildTeamProfiles", () => {
  test("combines my teams with member details and current user role", () => {
    const profiles = buildTeamProfiles(
      7,
      [
        {
          id: 1,
          name: "银河联队",
          description: "周末踢球",
          logo_url: null,
          captain_id: 7,
          status: 1,
          credit_score: 78,
          vip_until: "2026-05-01T00:00:00",
          trust_label: "评价稳定",
          is_vip: true,
        },
      ],
      {
        1: {
          team: {
            id: 1,
            name: "银河联队",
            description: "周末踢球",
            logo_url: null,
            captain_id: 7,
            status: 1,
            credit_score: 78,
            vip_until: "2026-05-01T00:00:00",
            trust_label: "评价稳定",
            is_vip: true,
          },
          members: [
            { user_id: 7, role: "captain", jersey_number: "10", is_member: true, joined_at: "2026-04-01T00:00:00", status: 1 },
            { user_id: 8, role: "member", jersey_number: "11", is_member: false, joined_at: "2026-04-02T00:00:00", status: 1 },
          ],
        },
      },
    );

    expect(profiles).toEqual([
      {
        id: 1,
        name: "银河联队",
        description: "周末踢球",
        logoUrl: "",
        status: 1,
        memberCount: 2,
        myRole: "captain",
        myRoleLabel: "队长",
        joinedAt: "2026-04-01T00:00:00",
        isCaptain: true,
        canManageTeam: true,
        creditScore: 78,
        trustLabel: "评价稳定",
        vipUntil: "05/01 00:00",
        isVip: true,
      },
    ]);
  });
});

describe("resolveUserDisplayName", () => {
  test("falls back to a logged-in label when the user exists but all name fields are blank", () => {
    expect(
      resolveUserDisplayName({
        id: 9022,
        open_id: "openid-9022",
        username: "",
        nickname: "   ",
        real_name: "",
        avatar_url: "",
        phone_number: "",
        is_manager: false,
        is_venue: false,
      }),
    ).toEqual("用户 9022");
  });

  test("uses real name first when available", () => {
    expect(
      resolveUserDisplayName({
        id: 7,
        open_id: "openid-7",
        username: "captain-7",
        nickname: "银河队长",
        real_name: "王睿",
        avatar_url: "",
        phone_number: "",
        is_manager: false,
        is_venue: false,
      }),
    ).toEqual("王睿");
  });
});

describe("resolveUserDisplayHandle", () => {
  test("returns a refresh hint when there is no session user yet", () => {
    expect(resolveUserDisplayHandle(null)).toEqual("点击重试登录和刷新资料");
  });

  test("falls back to a profile-completion hint when a logged-in user has no nickname and username", () => {
    expect(
      resolveUserDisplayHandle({
        id: 9022,
        open_id: "openid-9022",
        username: "",
        nickname: "",
        real_name: "",
        avatar_url: "",
        phone_number: "",
        is_manager: false,
        is_venue: false,
      }),
    ).toEqual("已登录，待补充昵称或姓名");
  });
});

describe("buildHomeMatchCards", () => {
  test("home match list shows only stage status instead of duplicated signup scope label", async () => {
    const component = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/home/components/HomeMatchList.vue",
    ).text();

    expect(component.includes("{{ match.signupScopeLabel }}")).toEqual(false);
    expect(component.includes("{{ match.stage }}")).toEqual(true);
  });

  test("filters activities by current team and merges my stand and registration counts", () => {
    const cards = buildHomeMatchCards({
      teamId: 1,
      activities: [
        {
          id: "activity-1",
          name: "周四友谊赛",
          location: "A 场",
          location_latitude: null,
          location_longitude: null,
          status: 0,
          holding_date: "2026-04-16T20:00:00",
          start_time: "2026-04-16T20:00:00",
          end_time: "2026-04-16T22:00:00",
          opposing: "红队",
          cover: null,
          description: null,
          home_team_id: 1,
          away_team_id: 2,
          color: null,
          opposing_color: null,
          players_per_team: 8,
          team_checkin_configs: [],
        },
        {
          id: "activity-2",
          name: "别队比赛",
          location: "B 场",
          location_latitude: null,
          location_longitude: null,
          status: 0,
          holding_date: "2026-04-17T20:00:00",
          start_time: "2026-04-17T20:00:00",
          end_time: "2026-04-17T22:00:00",
          opposing: null,
          cover: null,
          description: null,
          home_team_id: 9,
          away_team_id: 3,
          color: null,
          opposing_color: null,
          players_per_team: 6,
          team_checkin_configs: [],
        },
      ],
      myActivityRecords: [
        {
          activity_id: "activity-1",
          user_id: 7,
          stand: 1,
          registration_count: 1,
          operation_time: "2026-04-15T12:00:00",
        },
      ],
      registrationsByActivityId: {
        "activity-1": [
          {
            user_id: 7,
            stand: 1,
            registration_count: 1,
            paid: 1,
            operation_time: "2026-04-15T12:00:00",
          },
          {
            user_id: 8,
            stand: 1,
            registration_count: 1,
            paid: 0,
            operation_time: "2026-04-15T13:00:00",
          },
          {
            user_id: 9,
            stand: 2,
            registration_count: 1,
            paid: 0,
            operation_time: "2026-04-15T14:00:00",
          },
          {
            user_id: 10,
            stand: 3,
            registration_count: 1,
            paid: 0,
            operation_time: "2026-04-15T15:00:00",
          },
          {
            user_id: 11,
            stand: 0,
            registration_count: 1,
            paid: 0,
            operation_time: "2026-04-15T16:00:00",
          },
        ],
      },
      usersById: {
        7: {
          id: 7,
          open_id: "o7",
          username: "u7",
          nickname: "小王",
          real_name: "王七",
          avatar_url: "https://example.com/7.png",
          phone_number: "",
          is_manager: false,
          is_venue: false,
        },
        8: {
          id: 8,
          open_id: "o8",
          username: "u8",
          nickname: "小李",
          real_name: "李八",
          avatar_url: "",
          phone_number: "",
          is_manager: false,
          is_venue: false,
        },
      },
      limit: 5,
    });

    expect(cards).toEqual([
      {
        id: "activity-1",
        detailUrl: "/pages/matches/detail?id=activity-1",
        title: "周四友谊赛",
        dateLabel: "04/16 20:00",
        stage: "报名中",
        venue: "A 场",
        opponent: "红队",
        formatLabel: "8 人制",
        requiredPlayers: 8,
        maxPlayers: 8,
        joinedPlayers: 2,
        absentPlayers: 1,
        latePlayers: 1,
        pendingPlayers: 1,
        myStatus: "参加",
        highlight: "当前 2 人参加，还差 6 人成行",
        participantAvatars: [
          {
            userId: 7,
            avatarUrl: "https://example.com/7.png",
            displayText: "王",
            tone: "#111111",
          },
          {
            userId: 8,
            avatarUrl: "",
            displayText: "李",
            tone: "#2a4cff",
          },
        ],
        remainingPlayersLabel: "还差 6 人成行",
        signupScope: "external",
        signupScopeLabel: "比赛报名",
        canRegister: true,
      },
    ]);
  });
});

describe("buildJoinedIndividualHomeMatchCards", () => {
  test("maps joined individual challenges into home todo cards", () => {
    const cards = buildJoinedIndividualHomeMatchCards({
      summaries: [
        {
          challenge: {
            id: "challenge-1",
            title: "周五散人局",
            kind: "individual",
            payment_mode: "postpaid",
            host_team_id: null,
            host_user_id: 8,
            guest_team_id: null,
            accepted_by_user_id: null,
            activity_id: null,
            holding_date: "2026-04-18T20:00:00",
            start_time: "2026-04-18T20:00:00",
            end_time: "2026-04-18T22:00:00",
            location: "C 场",
            location_latitude: null,
            location_longitude: null,
            players_per_team: 8,
            fee_per_person: "35",
            note: null,
            status: "open",
            accepted_at: null,
            cancelled_at: null,
            created_at: "2026-04-17T12:00:00",
            updated_at: "2026-04-17T12:00:00",
          },
          host_team_name: "散人约球",
          host_team_credit_score: 0,
          host_team_trust_label: "",
          guest_team_name: null,
          guest_team_credit_score: null,
          guest_team_trust_label: null,
          current_team_relation: null,
          accepted_count: 5,
          current_user_joined: true,
          can_accept: false,
        },
      ],
    });

    expect(cards[0].id).toEqual("challenge-1");
    expect(cards[0].detailUrl).toEqual("/pages/challenges/detail?id=challenge-1");
    expect(cards[0].signupScopeLabel).toEqual("散人报名");
    expect(cards[0].myStatus).toEqual("已报名");
    expect(cards[0].actionLabel).toEqual("去查看");
  });
});

describe("buildAttendanceSummary", () => {
  test("summarises attendance records using real stand values", () => {
    const summary = buildAttendanceSummary([
      {
        activity_id: "a1",
        activity_name: "比赛 1",
        holding_date: "2026-04-01T20:00:00",
        location: "A 场",
        stand: 1,
        registration_count: 1,
        operation_time: "2026-04-01T12:00:00",
      },
      {
        activity_id: "a2",
        activity_name: "比赛 2",
        holding_date: "2026-04-02T20:00:00",
        location: "B 场",
        stand: 3,
        registration_count: 1,
        operation_time: "2026-04-02T12:00:00",
      },
      {
        activity_id: "a3",
        activity_name: "比赛 3",
        holding_date: "2026-04-03T20:00:00",
        location: "C 场",
        stand: 2,
        registration_count: 1,
        operation_time: "2026-04-03T12:00:00",
      },
    ]);

    expect(summary).toEqual({
      total: 3,
      attended: 1,
      leave: 1,
      late: 1,
      pending: 0,
      attendanceRate: "33%",
    });
  });
});

describe("buildBillingSummary", () => {
  test("builds wallet and flow summary from real billing payload", () => {
    const summary = buildBillingSummary(
      {
        user_id: 7,
        balance: "186.00",
        total_recharge: "300.00",
        total_expense: "96.00",
        total_penalty: "18.00",
      },
      {
        final_balance: "186.00",
        records: [
          {
            id: "tx-1",
            record_type: "recharge",
            type_name: "充值",
            amount: "100.00",
            description: "微信充值",
            activity_id: null,
            created_at: "2026-04-10T12:00:00",
            balance: "200.00",
          },
          {
            id: "tx-2",
            record_type: "expense",
            type_name: "比赛扣费",
            amount: "-28.00",
            description: "周四友谊赛",
            activity_id: "activity-1",
            created_at: "2026-04-11T12:00:00",
            balance: "172.00",
          },
        ],
      },
    );

    expect(summary).toEqual({
      balanceLabel: "¥186.00",
      totalRechargeLabel: "¥300.00",
      totalExpenseLabel: "¥96.00",
      totalPenaltyLabel: "¥18.00",
      latestRecordCount: 2,
    });
  });
});

describe("buildChallengeCards", () => {
  test("maps open and matched challenges into hall cards", () => {
    const cards = buildChallengeCards([
      {
        challenge: {
          id: "challenge-1",
          title: "周六夜场 8 人制约队",
          kind: "team",
          payment_mode: "postpaid",
          host_team_id: 1,
          host_user_id: 7,
          guest_team_id: null,
          accepted_by_user_id: null,
          activity_id: null,
          holding_date: "2026-04-20T20:30:00",
          start_time: "2026-04-20T20:30:00",
          end_time: "2026-04-20T22:30:00",
          location: "驿马河二期 1 号场",
          location_latitude: null,
          location_longitude: null,
          players_per_team: 8,
          fee_per_person: "28.00",
          note: "想约一场强度中高的友谊赛",
          status: "open",
          accepted_at: null,
          cancelled_at: null,
          created_at: "2026-04-17T12:00:00",
          updated_at: "2026-04-17T12:00:00",
        },
        host_team_name: "银河联队",
        host_team_credit_score: 82,
        host_team_trust_label: "稳定赴约",
        guest_team_name: null,
        guest_team_credit_score: null,
        guest_team_trust_label: null,
        current_team_relation: "viewer",
        accepted_count: 0,
        current_user_joined: false,
        can_accept: true,
      },
      {
        challenge: {
          id: "challenge-2",
          title: "工作日晚场 6 人制",
          kind: "team",
          payment_mode: "postpaid",
          host_team_id: 2,
          host_user_id: 8,
          guest_team_id: 3,
          accepted_by_user_id: 9,
          activity_id: "activity-99",
          holding_date: "2026-04-21T20:30:00",
          start_time: "2026-04-21T20:30:00",
          end_time: "2026-04-21T22:30:00",
          location: "府河绿道足球场",
          location_latitude: null,
          location_longitude: null,
          players_per_team: 6,
          fee_per_person: null,
          note: null,
          status: "matched",
          accepted_at: "2026-04-18T10:00:00",
          cancelled_at: null,
          created_at: "2026-04-17T13:00:00",
          updated_at: "2026-04-18T10:00:00",
        },
        host_team_name: "柏林二队",
        host_team_credit_score: 75,
        host_team_trust_label: "评价稳定",
        guest_team_name: "河西周四 FC",
        guest_team_credit_score: 78,
        guest_team_trust_label: "评价稳定",
        current_team_relation: "guest",
        accepted_count: 0,
        current_user_joined: false,
        can_accept: false,
      },
    ]);

    expect(cards).toEqual([
      {
        id: "challenge-1",
        title: "周六夜场 8 人制约队",
        kind: "team",
        hostTeamName: "银河联队",
        creditScore: 82,
        trustLabel: "稳定赴约",
        dateLabel: "04/20 20:30",
        monthDayLabel: "04/20",
        dayNumberLabel: "20",
        weekdayLabel: "周一",
        timeRangeLabel: "20:30-22:30",
        venue: "驿马河二期 1 号场",
        formatLabel: "8 人制",
        feeLabel: "预计 ¥28.00/人",
        priceLabel: "¥28/人",
        statusLabel: "可接约",
        statusTone: "open",
        relationLabel: "可接约",
        note: "想约一场强度中高的友谊赛",
        teamInitial: "银",
        quickTags: ["8 人制", "稳定赴约", "可接约"],
        primaryActionLabel: "去接约",
        canAccept: true,
        acceptedCount: 0,
        capacity: 8,
        minPlayers: 8,
        maxPlayers: 8,
        currentUserJoined: false,
        activityId: "",
      },
      {
        id: "challenge-2",
        title: "工作日晚场 6 人制",
        kind: "team",
        hostTeamName: "柏林二队",
        creditScore: 75,
        trustLabel: "评价稳定",
        dateLabel: "04/21 20:30",
        monthDayLabel: "04/21",
        dayNumberLabel: "21",
        weekdayLabel: "周二",
        timeRangeLabel: "20:30-22:30",
        venue: "府河绿道足球场",
        formatLabel: "6 人制",
        feeLabel: "费用待定",
        priceLabel: "费用待定",
        statusLabel: "已约成",
        statusTone: "matched",
        relationLabel: "我已接约",
        note: "",
        teamInitial: "柏",
        quickTags: ["6 人制", "评价稳定", "我已接约"],
        primaryActionLabel: "去报名",
        canAccept: false,
        acceptedCount: 0,
        capacity: 6,
        minPlayers: 6,
        maxPlayers: 6,
        currentUserJoined: false,
        activityId: "activity-99",
      },
    ]);
  });

  test("maps individual challenges with signup progress and join state", () => {
    const cards = buildChallengeCards([
      {
        challenge: {
          id: "challenge-individual-1",
          title: "周三晚散人局",
          kind: "individual",
          payment_mode: "postpaid",
          host_team_id: 1,
          host_user_id: 7,
          guest_team_id: null,
          accepted_by_user_id: null,
          activity_id: null,
          holding_date: "2026-04-23T20:00:00",
          start_time: "2026-04-23T20:00:00",
          end_time: "2026-04-23T22:00:00",
          location: "北门测试球场",
          location_latitude: null,
          location_longitude: null,
          players_per_team: 8,
          fee_per_person: "35.00",
          note: "缺 4 人，守时优先",
          status: "open",
          accepted_at: null,
          cancelled_at: null,
          created_at: "2026-04-20T12:00:00",
          updated_at: "2026-04-20T12:00:00",
        },
        host_team_name: "银河联队",
        host_team_credit_score: 82,
        host_team_trust_label: "稳定赴约",
        guest_team_name: null,
        guest_team_credit_score: null,
        guest_team_trust_label: null,
        current_team_relation: "viewer",
        accepted_count: 10,
        current_user_joined: true,
        can_accept: false,
      },
    ]);

    expect(cards).toEqual([
      {
        id: "challenge-individual-1",
        title: "周三晚散人局",
        kind: "individual",
        hostTeamName: "散人约球",
        creditScore: 82,
        trustLabel: "稳定赴约",
        dateLabel: "04/23 20:00",
        monthDayLabel: "04/23",
        dayNumberLabel: "23",
        weekdayLabel: "周四",
        timeRangeLabel: "20:00-22:00",
        venue: "北门测试球场",
        formatLabel: "8 人制",
        feeLabel: "预计 ¥35.00/人",
        priceLabel: "¥35/人",
        statusLabel: "可报名",
        statusTone: "open",
        relationLabel: "我已报名",
        note: "缺 4 人，守时优先",
        teamInitial: "散",
        quickTags: ["散人局", "10/16成行", "最多20人", "我已报名"],
        primaryActionLabel: "取消报名",
        canAccept: false,
        acceptedCount: 10,
        capacity: 20,
        minPlayers: 16,
        maxPlayers: 20,
        currentUserJoined: true,
        activityId: "",
      },
    ]);
  });

  test("keeps open individual challenges actionable when backend can_accept is false", () => {
    const cards = buildChallengeCards([
      {
        challenge: {
          id: "challenge-individual-open",
          title: "周三晚散人局",
          kind: "individual",
          payment_mode: "postpaid",
          host_team_id: null,
          host_user_id: 7,
          guest_team_id: null,
          accepted_by_user_id: null,
          activity_id: null,
          holding_date: "2026-04-23T20:00:00",
          start_time: "2026-04-23T20:00:00",
          end_time: "2026-04-23T22:00:00",
          location: "北门测试球场",
          location_latitude: null,
          location_longitude: null,
          players_per_team: 8,
          fee_per_person: "35.00",
          note: null,
          status: "open",
          accepted_at: null,
          cancelled_at: null,
          created_at: "2026-04-20T12:00:00",
          updated_at: "2026-04-20T12:00:00",
        },
        host_team_name: "场馆发布",
        host_team_credit_score: 0,
        host_team_trust_label: "信用待评",
        guest_team_name: null,
        guest_team_credit_score: null,
        guest_team_trust_label: null,
        current_team_relation: "viewer",
        accepted_count: 1,
        current_user_joined: false,
        can_accept: false,
      },
    ]);

    expect(cards[0].statusLabel).toEqual("可报名");
    expect(cards[0].relationLabel).toEqual("可报名");
    expect(cards[0].primaryActionLabel).toEqual("去报名");
  });

  test("maps venue team challenges with the first team waiting for an opponent", () => {
    const cards = buildChallengeCards([
      {
        challenge: {
          id: "challenge-venue-team-1",
          title: "场馆撮合 8 人制",
          kind: "team",
          payment_mode: "postpaid",
          host_team_id: 2,
          host_user_id: 30,
          guest_team_id: null,
          accepted_by_user_id: 8,
          activity_id: null,
          holding_date: "2026-04-25T20:00:00",
          start_time: "2026-04-25T20:00:00",
          end_time: "2026-04-25T22:00:00",
          location: "城东足球公园 3 号场",
          location_latitude: null,
          location_longitude: null,
          players_per_team: 8,
          fee_per_person: "30.00",
          note: null,
          status: "open",
          accepted_at: "2026-04-21T10:00:00",
          cancelled_at: null,
          created_at: "2026-04-20T12:00:00",
          updated_at: "2026-04-21T10:00:00",
        },
        host_team_name: "柏林二队",
        host_team_credit_score: 88,
        host_team_trust_label: "稳定赴约",
        guest_team_name: null,
        guest_team_credit_score: null,
        guest_team_trust_label: null,
        current_team_relation: "host",
        accepted_count: 0,
        current_user_joined: false,
        can_accept: false,
      },
      {
        challenge: {
          id: "challenge-venue-team-1",
          title: "场馆撮合 8 人制",
          kind: "team",
          payment_mode: "postpaid",
          host_team_id: 2,
          host_user_id: 30,
          guest_team_id: null,
          accepted_by_user_id: 8,
          activity_id: null,
          holding_date: "2026-04-25T20:00:00",
          start_time: "2026-04-25T20:00:00",
          end_time: "2026-04-25T22:00:00",
          location: "城东足球公园 3 号场",
          location_latitude: null,
          location_longitude: null,
          players_per_team: 8,
          fee_per_person: "30.00",
          note: null,
          status: "open",
          accepted_at: "2026-04-21T10:00:00",
          cancelled_at: null,
          created_at: "2026-04-20T12:00:00",
          updated_at: "2026-04-21T10:00:00",
        },
        host_team_name: "柏林二队",
        host_team_credit_score: 88,
        host_team_trust_label: "稳定赴约",
        guest_team_name: null,
        guest_team_credit_score: null,
        guest_team_trust_label: null,
        current_team_relation: "viewer",
        accepted_count: 0,
        current_user_joined: false,
        can_accept: true,
      },
    ]);

    expect(cards[0].relationLabel).toEqual("等待对手");
    expect(cards[0].primaryActionLabel).toEqual("等待对手");
    expect(cards[1].relationLabel).toEqual("可接约");
    expect(cards[1].primaryActionLabel).toEqual("去应战");
  });
});

describe("filterChallengeSummariesByScope", () => {
  test("keeps only open or related challenges for hall quick filters", () => {
    const summaries: BackendChallengeSummary[] = [
      {
        challenge: {
          id: "challenge-open",
          title: "公开可接约",
          kind: "team",
          payment_mode: "postpaid",
          host_team_id: 1,
          host_user_id: 7,
          guest_team_id: null,
          accepted_by_user_id: null,
          activity_id: null,
          holding_date: "2026-04-22T20:00:00",
          start_time: "2026-04-22T20:00:00",
          end_time: "2026-04-22T22:00:00",
          location: "A 场",
          location_latitude: null,
          location_longitude: null,
          players_per_team: 8,
          fee_per_person: null,
          note: null,
          status: "open" as const,
          accepted_at: null,
          cancelled_at: null,
          created_at: "2026-04-17T10:00:00",
          updated_at: "2026-04-17T10:00:00",
        },
        host_team_name: "银河联队",
        host_team_credit_score: 82,
        host_team_trust_label: "稳定赴约",
        guest_team_name: null,
        guest_team_credit_score: null,
        guest_team_trust_label: null,
        current_team_relation: "viewer",
        accepted_count: 0,
        current_user_joined: false,
        can_accept: true,
      },
      {
        challenge: {
          id: "challenge-mine",
          title: "我发布的约队",
          kind: "team",
          payment_mode: "postpaid",
          host_team_id: 1,
          host_user_id: 9,
          guest_team_id: null,
          accepted_by_user_id: null,
          activity_id: null,
          holding_date: "2026-04-23T20:00:00",
          start_time: "2026-04-23T20:00:00",
          end_time: "2026-04-23T22:00:00",
          location: "B 场",
          location_latitude: null,
          location_longitude: null,
          players_per_team: 8,
          fee_per_person: null,
          note: null,
          status: "open" as const,
          accepted_at: null,
          cancelled_at: null,
          created_at: "2026-04-17T11:00:00",
          updated_at: "2026-04-17T11:00:00",
        },
        host_team_name: "我队",
        host_team_credit_score: 85,
        host_team_trust_label: "稳定赴约",
        guest_team_name: null,
        guest_team_credit_score: null,
        guest_team_trust_label: null,
        current_team_relation: "host",
        accepted_count: 0,
        current_user_joined: false,
        can_accept: false,
      },
      {
        challenge: {
          id: "challenge-cancelled",
          title: "已取消记录",
          kind: "team",
          payment_mode: "postpaid",
          host_team_id: 2,
          host_user_id: 10,
          guest_team_id: null,
          accepted_by_user_id: null,
          activity_id: null,
          holding_date: "2026-04-24T20:00:00",
          start_time: "2026-04-24T20:00:00",
          end_time: "2026-04-24T22:00:00",
          location: "C 场",
          location_latitude: null,
          location_longitude: null,
          players_per_team: 8,
          fee_per_person: null,
          note: null,
          status: "cancelled" as const,
          accepted_at: null,
          cancelled_at: "2026-04-18T10:00:00",
          created_at: "2026-04-17T12:00:00",
          updated_at: "2026-04-18T10:00:00",
        },
        host_team_name: "其他队",
        host_team_credit_score: 68,
        host_team_trust_label: "活跃新队",
        guest_team_name: null,
        guest_team_credit_score: null,
        guest_team_trust_label: null,
        current_team_relation: "viewer",
        accepted_count: 0,
        current_user_joined: false,
        can_accept: false,
      },
    ];

    expect(filterChallengeSummariesByScope(summaries, "open").map((item) => item.challenge.id)).toEqual([
      "challenge-open",
      "challenge-mine",
    ]);
    expect(filterChallengeSummariesByScope(summaries, "mine").map((item) => item.challenge.id)).toEqual([
      "challenge-mine",
    ]);
  });
});

describe("buildNotificationItems", () => {
  test("maps notification records to readable entries and deep links", () => {
    const items = buildNotificationItems([
      {
        id: "notice-1",
        user_id: 7,
        kind: "challenge_matched",
        title: "约队已约成",
        content: "银河联队与柏林二队已约成，待报名。",
        related_type: "challenge",
        related_id: "challenge-1",
        read_at: null,
        created_at: "2026-04-17T20:15:00",
      },
    ]);

    expect(items).toEqual([
      {
        id: "notice-1",
        title: "约队已约成",
        content: "银河联队与柏林二队已约成，待报名。",
        kindLabel: "约队已约成",
        createdAtLabel: "04/17 20:15",
        read: false,
        relatedPath: "/pages/challenges/detail?id=challenge-1",
      },
    ]);
  });
});
