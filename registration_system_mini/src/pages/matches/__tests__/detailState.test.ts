import { describe, expect, test } from "bun:test";
import type { BackendRegistration, BackendTeamMember, BackendUser } from "@/types/backend";
import { buildRegistrationProgress, buildTeamMemberRegistrationGroups, resolveRegistrationWindow } from "../detailState";

const teamMember = (id: number, overrides: Partial<BackendTeamMember> = {}): BackendTeamMember => ({
  user_id: id,
  role: "member",
  jersey_number: null,
  is_member: true,
  joined_at: "2026-01-01T00:00:00.000Z",
  status: 1,
  ...overrides,
});

const backendUser = (id: number, nickname: string, avatarUrl: string): BackendUser => ({
  id,
  open_id: "",
  username: "",
  nickname,
  real_name: "",
  avatar_url: avatarUrl,
  phone_number: "",
  is_manager: false,
  is_venue: false,
});

describe("buildTeamMemberRegistrationGroups", () => {
  const registrations: BackendRegistration[] = [
    { user_id: 37, stand: 1, registration_count: 1, paid: 0, operation_time: "2026-08-15T02:00:00.000Z" },
    { user_id: 38, stand: 2, registration_count: 0, paid: 0, operation_time: "2026-08-14T02:00:00.000Z" },
    { user_id: 40, stand: 0, registration_count: 0, paid: 0, operation_time: "2026-08-13T02:00:00.000Z" },
  ];
  const members = [
    teamMember(37, { nickname: "旧昵称37", avatar_url: "https://cdn.example.com/member-37.png" }),
    teamMember(38),
    teamMember(39),
    teamMember(40),
  ];
  const usersById: Record<number, BackendUser> = {
    37: backendUser(37, "阿睿", "https://cdn.example.com/player-37.png"),
    38: backendUser(38, "阿东", "https://cdn.example.com/player-38.png"),
  };

  test("groups members into joined, leave, and pending by registration stand", () => {
    const groups = buildTeamMemberRegistrationGroups({
      members,
      registrations,
      usersById,
      currentUserId: 38,
    });

    expect(groups.joined.map((card) => card.userId)).toEqual([37]);
    expect(groups.leave.map((card) => card.userId)).toEqual([38]);
    expect(groups.pending.map((card) => card.userId)).toEqual([39, 40]);
    expect(groups.leave[0]?.isCurrentUser).toEqual(true);
    expect(groups.pending.every((card) => !card.isCurrentUser)).toEqual(true);
  });

  test("prefers the participant record over the roster profile", () => {
    const groups = buildTeamMemberRegistrationGroups({ members, registrations, usersById });
    const card = groups.joined[0];

    expect({ userId: card?.userId, name: card?.name, avatarUrl: card?.avatarUrl }).toEqual({
      userId: 37,
      name: "阿睿",
      avatarUrl: "https://cdn.example.com/player-37.png",
    });
  });

  test("falls back to the roster profile for members missing from usersById", () => {
    const groups = buildTeamMemberRegistrationGroups({
      members: [teamMember(39, { nickname: "板凳队员", avatar_url: "https://cdn.example.com/member-39.png" })],
      registrations: [],
      usersById: {},
    });
    const card = groups.pending[0];

    expect({ userId: card?.userId, name: card?.name, avatarUrl: card?.avatarUrl }).toEqual({
      userId: 39,
      name: "板凳队员",
      avatarUrl: "https://cdn.example.com/member-39.png",
    });
  });

  test("keeps a stable placeholder for members without any profile", () => {
    const groups = buildTeamMemberRegistrationGroups({
      members: [teamMember(41)],
      registrations: [],
      usersById: {},
    });
    const card = groups.pending[0];

    expect({ userId: card?.userId, name: card?.name, avatarUrl: card?.avatarUrl }).toEqual({
      userId: 41,
      name: "用户 41",
      avatarUrl: "",
    });
  });
});

describe("buildRegistrationProgress", () => {
  test("uses the maximum capacity as the progress denominator", () => {
    expect(buildRegistrationProgress(8, 6, 8)).toEqual({
      baseWidth: "75%",
      extraWidth: "25%",
      splitLeft: "75%",
    });
  });

  test("falls back to the target when maximum capacity is missing", () => {
    expect(buildRegistrationProgress(6, 6)).toEqual({
      baseWidth: "100%",
      extraWidth: "0%",
      splitLeft: "100%",
    });
  });

  test("keeps the denominator valid for an unknown target", () => {
    expect(buildRegistrationProgress(0, 0)).toEqual({
      baseWidth: "0%",
      extraWidth: "0%",
      splitLeft: "0%",
    });
  });
});

describe("resolveRegistrationWindow", () => {
  const start = Date.parse("2026-08-20T08:00:00.000Z");
  const end = Date.parse("2026-08-20T10:00:00.000Z");

  test("uses a half-open interval and selects the active countdown target", () => {
    expect(resolveRegistrationWindow({
      now: start - 1,
      isRegistering: true,
      registrationStartAt: new Date(start).toISOString(),
      registrationEndAt: new Date(end).toISOString(),
    })).toEqual({ state: "not_started", countdownTarget: start });

    expect(resolveRegistrationWindow({
      now: start,
      isRegistering: true,
      registrationStartAt: new Date(start).toISOString(),
      registrationEndAt: new Date(end).toISOString(),
    })).toEqual({ state: "open", countdownTarget: end });

    expect(resolveRegistrationWindow({
      now: end,
      isRegistering: true,
      registrationStartAt: new Date(start).toISOString(),
      registrationEndAt: new Date(end).toISOString(),
    })).toEqual({ state: "closed", countdownTarget: null });
  });

  test("honors partial bounds and status independently", () => {
    expect(resolveRegistrationWindow({
      now: start,
      isRegistering: true,
      registrationStartAt: null,
      registrationEndAt: null,
    })).toEqual({ state: "open", countdownTarget: null });
    expect(resolveRegistrationWindow({
      now: start,
      isRegistering: false,
      registrationStartAt: null,
      registrationEndAt: null,
    })).toEqual({ state: "closed", countdownTarget: null });
  });
});
