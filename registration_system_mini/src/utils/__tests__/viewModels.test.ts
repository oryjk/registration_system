import { describe, expect, test } from "bun:test";
import {
  buildAttendanceSummary,
  buildNotificationItems,
  buildTeamProfiles,
  resolveUserDisplayHandle,
  resolveUserDisplayName,
} from "../viewModels";

declare const Bun: {
  file(path: string | URL): {
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

describe("buildNotificationItems", () => {
  test("maps notification records to readable entries and deep links", () => {
    const items = buildNotificationItems([
      {
        id: 1,
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
        id: 1,
        title: "约队已约成",
        content: "银河联队与柏林二队已约成，待报名。",
        kindLabel: "约队已约成",
        createdAtLabel: "04/17 20:15",
        read: false,
        relatedPath: "",
      },
    ]);
  });
});
