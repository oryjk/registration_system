import { describe, expect, test } from "bun:test";
import type { AppHomeActionMatch, AppMatchDetailResponse } from "@/types/match";
import { toHomeMatchCard } from "../homeMatchState";
import { buildHomeActionMatchCardState } from "../homeActionMatchCardState";

const now = new Date("2026-09-21T10:00:00Z");
const source: AppHomeActionMatch = {
  id: "match-1", name: "友谊赛", status: "registering", publication_mode: "online_team",
  host_team_name: "主队", opponent_name: "客队", players_per_team: 8, location: "1号场",
  start_time: "2026-09-22T12:00:00Z", end_time: "2026-09-22T14:00:00Z",
  group: { id: "guest", kind: "guest_team", status: "open", min_players: 6, max_players: 10, attending_count: 5, my_registration_status: "unknown" },
};
const card = toHomeMatchCard(source, "upcoming");
function detail(): AppMatchDetailResponse {
  return {
    match: {
      ...source, host_team_id: 1, away_team_id: 2, away_team_name: "客队", opponent_state: "confirmed",
      registration_start_at: null, registration_end_at: "2026-09-22T09:35:00Z",
      location_latitude: null, location_longitude: null, description: null,
      created_at: now.toISOString(), updated_at: now.toISOString(), is_free: false,
      payment_mode: "postpaid", fee_per_person_cents: 3000,
    },
    groups: [
      { ...source.group, id: "host", kind: "host_team", team_id: 1, attending_count: 10, my_registration: { status: "attending", registration_count: 1 } },
      { ...source.group, team_id: 2, my_registration: null },
    ],
  };
}
describe("Home action match card", () => {
  test("progress separates the minimum turnout from additional registrations", () => {
    const data = detail(); data.groups[1].min_players = 10; data.groups[1].max_players = 16;
    for (const [joined, base, extra, pending] of [[8, 50, 0, true], [10, 62.5, 0, false], [12, 62.5, 12.5, false], [16, 62.5, 37.5, false], [20, 62.5, 37.5, false]] as const) {
      data.groups[1].attending_count = joined;
      const state = buildHomeActionMatchCardState(card, data, now);
      expect([state.basePercent, state.extraPercent, state.belowMinimum]).toEqual([base, extra, pending]);
      expect(state.minimumPercent).toEqual(62.5);
    }
    // 组未设最低人数时回落到 8 人制成行线，目标线不因详情到达而消失。
    data.groups[1].min_players = null;
    expect(buildHomeActionMatchCardState(card, data, now).extraPercent).toEqual(50);
    data.groups[1].max_players = null;
    expect(buildHomeActionMatchCardState(card, data, now).progressPercent).toEqual(100);
    data.groups[1].min_players = 10;
    expect(buildHomeActionMatchCardState(card, data, now).targetPercent).toEqual(50);
    data.groups[1].max_players = 10;
    expect(buildHomeActionMatchCardState(card, data, now).minimumPercent).toEqual(null);
  });
  test("matches the user's registration group instead of taking the first group", () => {
    const state = buildHomeActionMatchCardState(card, detail(), now);
    expect(state.statusLabel).toEqual("尚未报名");
    expect(state.statusTone).toEqual("neutral");
    expect(state.statusIcon).toEqual("user-round");
    expect(state.joined).toEqual(5);
    expect(state.actionLabel).toEqual("前往报名");
    expect(state.countLabel).toEqual("还差 1 人成行");
    expect(state.feeLabel).toEqual("¥30 / 人 · 赛后结算");
    expect(state.progressPercent).toEqual(50);
  });
  test("never invents a fee or deadline before detail arrives or for a different match", () => {
    const wrong = detail(); wrong.match.id = "other";
    for (const data of [null, wrong]) {
      const state = buildHomeActionMatchCardState(card, data, now);
      expect(state.feeLabel).toEqual("费用见比赛详情");
      expect(state.deadlineLabel).toEqual("");
      expect(state.actionLabel).toEqual("查看比赛与报名");
    }
  });
  test("full groups keep a detail action without suggesting another signup", () => {
    const data = detail(); data.groups[1].attending_count = 10;
    const state = buildHomeActionMatchCardState(card, data, now);
    expect(state.availability).toEqual("名额已满");
    expect(state.actionLabel).toEqual("查看比赛详情");
    data.groups[1].my_registration = { status: "attending", registration_count: 1 };
    expect(buildHomeActionMatchCardState(card, data, now).actionLabel).toEqual("查看比赛安排");
  });
  test("groups without an explicit minimum keep the format size as the turnout line", () => {
    const noMinSource: AppHomeActionMatch = { ...source, group: { ...source.group, min_players: null, max_players: null } };
    const noMinCard = toHomeMatchCard(noMinSource, "upcoming");
    const data = detail(); data.groups[1].min_players = null; data.groups[1].max_players = null; data.groups[1].attending_count = 5;
    // 详情到达前后成行线一致：8 人制、已报 5 人应保持「还差 3 人成行」的待成行黄色。
    const before = buildHomeActionMatchCardState(noMinCard, null, now);
    const after = buildHomeActionMatchCardState(noMinCard, data, now);
    for (const state of [before, after]) {
      expect(state.minimum).toEqual(8);
      expect(state.belowMinimum).toEqual(true);
      expect(state.countLabel).toEqual("还差 3 人成行");
    }
  });
  test("unbounded groups do not inherit the legacy fallback capacity", () => {
    const data = detail(); data.groups[1].max_players = null; data.groups[1].attending_count = 20;
    const state = buildHomeActionMatchCardState(card, data, now);
    expect(state.availability).toEqual("");
    expect(state.capacityLabel).toEqual("最低 6 人");
    expect(state.progressPercent).toEqual(100);
  });
  test("registration window distinguishes not started and closed", () => {
    const data = detail(); data.match.registration_start_at = "2026-09-21T11:00:00Z";
    expect(buildHomeActionMatchCardState(card, data, now).availability).toEqual("报名尚未开始");
    data.match.registration_start_at = null; data.match.registration_end_at = now.toISOString();
    expect(buildHomeActionMatchCardState(card, data, now).availability).toEqual("报名已关闭");
    expect(buildHomeActionMatchCardState(card, data, now).actionLabel).toEqual("查看比赛详情");
  });
  test("paid and pending-payment registrations preserve the existing payment flow", () => {
    const data = detail(); data.match.payment_mode = "prepaid";
    data.groups[1].my_registration = { status: "attending", registration_count: 2, paid: false };
    expect(buildHomeActionMatchCardState(card, data, now).actionLabel).toEqual("查看报名与支付");
    expect(buildHomeActionMatchCardState(card, data, now).statusTone).toEqual("warning");
    expect(buildHomeActionMatchCardState(card, data, now).statusIcon).toEqual("clock");
    data.groups[1].my_registration.paid = true;
    expect(buildHomeActionMatchCardState(card, data, now).statusTone).toEqual("success");
    expect(buildHomeActionMatchCardState(card, data, now).statusIcon).toEqual("circle-check");
    expect(buildHomeActionMatchCardState(card, data, now).actionLabel).toEqual("查看比赛安排");
  });
  test("leave, cancelled, ongoing and ended remain readable and navigable", () => {
    const data = detail(); data.groups[1].my_registration = { status: "leave", registration_count: 1 };
    expect(buildHomeActionMatchCardState(card, data, now).statusLabel).toEqual("已请假");
    data.match.status = "cancelled";
    expect(buildHomeActionMatchCardState(card, data, now).availability).toEqual("比赛已取消");
    data.match.status = "ongoing";
    expect(buildHomeActionMatchCardState(card, data, now).actionLabel).toEqual("查看比赛安排");
    data.match.status = "ended";
    expect(buildHomeActionMatchCardState(card, data, now).actionLabel).toEqual("查看比赛记录");
  });
  test("long titles remain intact, invalid dates never show NaN, unknown fees are not called free", () => {
    const data = detail(); data.match.name = "很长的球队比赛名称".repeat(10); data.match.start_time = "bad-date";
    data.match.fee_per_person_cents = undefined;
    const state = buildHomeActionMatchCardState(card, data, now);
    expect(state.title).toEqual(data.match.name);
    expect(state.time).toEqual("时间待定");
    expect(state.feeLabel).toEqual("费用见比赛详情");
  });
});
