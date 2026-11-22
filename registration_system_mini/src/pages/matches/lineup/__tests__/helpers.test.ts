import { describe, expect, test } from "bun:test";
import type { LineupCandidate, MatchLineupPlayer, MatchLineupSlot } from "@/types/lineup";
import { boxCentreRpx, boxPositionPx, DOT_DIAMETER_RPX } from "../dragGeometry";
import { getFormation } from "../formations";
import {
  applyDragOutcome,
  assignStarter,
  buildInitialLineupFromAttending,
  buildPitchSlots,
  canEditMatchLineup,
  clampCoord,
  collectAttendingParticipants,
  findCurrentUserRole,
  formatSubBadgeText,
  getUnassignedAttending,
  normalizeLoadedSlots,
  parseLineupMatchId,
  resetPositions,
  resolveDragRelease,
  restoreUuidFromScene,
  switchFormation,
  toggleSubPlayer,
} from "../helpers";

function assertNoDuplicateIds(slots: MatchLineupSlot[]) {
  const seen = new Set<number>();
  for (const s of slots) {
    if (s.player_id !== null) {
      expect(seen.has(s.player_id)).toEqual(false);
      seen.add(s.player_id);
    }
    for (const subId of s.sub_player_ids) {
      expect(seen.has(subId)).toEqual(false);
      seen.add(subId);
    }
  }
}

describe("lineup helpers", () => {
  test("restores 32-hex scene and parses matchId options", () => {
    const dashed = "123e4567-e89b-12d3-a456-426614174000";
    const compact = "123E4567E89B12D3A456426614174000";

    expect(restoreUuidFromScene(compact)).toEqual(dashed);
    expect(restoreUuidFromScene(dashed)).toEqual(dashed);
    expect(restoreUuidFromScene("not-a-uuid")).toEqual("");

    expect(parseLineupMatchId({ matchId: dashed })).toEqual(dashed);
    expect(parseLineupMatchId({ scene: encodeURIComponent(compact) })).toEqual(dashed);
    expect(parseLineupMatchId({ id: dashed })).toEqual(dashed);
    expect(parseLineupMatchId({})).toEqual("");
  });

  test("enforces edit permission parity with match detail", () => {
    const teamMatch = {
      status: "registering" as const,
      publication_mode: "offline_confirmed" as const,
      created_by_user_id: 99,
      host_team_id: 10,
    };
    expect(
      canEditMatchLineup({
        match: teamMatch,
        isGuestMode: false,
        currentUserId: 1,
        currentTeam: { id: 10, canManageTeam: true },
      }),
    ).toEqual(true);
    expect(
      canEditMatchLineup({
        match: teamMatch,
        isGuestMode: false,
        currentUserId: 1,
        currentTeam: { id: 10, canManageTeam: false },
      }),
    ).toEqual(false);
    expect(
      canEditMatchLineup({
        match: { ...teamMatch, status: "ended" },
        isGuestMode: false,
        currentUserId: 1,
        currentTeam: { id: 10, canManageTeam: true },
      }),
    ).toEqual(false);
    expect(
      canEditMatchLineup({
        match: teamMatch,
        isGuestMode: true,
        currentUserId: 1,
        currentTeam: { id: 10, canManageTeam: true },
      }),
    ).toEqual(false);

    const pickupMatch = {
      status: "registering" as const,
      publication_mode: "online_pickup" as const,
      created_by_user_id: 7,
      host_team_id: null,
    };
    expect(
      canEditMatchLineup({
        match: pickupMatch,
        isGuestMode: false,
        currentUserId: 7,
        currentTeam: null,
      }),
    ).toEqual(true);
    expect(
      canEditMatchLineup({
        match: pickupMatch,
        isGuestMode: false,
        currentUserId: 8,
        currentTeam: { id: 10, canManageTeam: true },
      }),
    ).toEqual(false);
  });

  test("prefills attending players and leaves remaining slots as default placeholders", () => {
    const slots = buildInitialLineupFromAttending(5, "1-2-1", [101, 102, 102, 103]);
    expect(slots.length).toEqual(5);
    expect(slots.map((s) => s.player_id)).toEqual([101, 102, 103, null, null]);
    expect(slots.every((s) => s.sub_player_ids.length === 0)).toEqual(true);
  });

  test("assignStarter and toggleSubPlayer keep global user ID uniqueness across starters and subs", () => {
    let slots = buildInitialLineupFromAttending(5, "1-2-1", [1, 2, 3, 4, 5]);

    // 1. 为前锋(slot 4)指定替补 6 和 7
    slots = toggleSubPlayer(slots, 4, 6);
    slots = toggleSubPlayer(slots, 4, 7);
    expect(slots[4].sub_player_ids).toEqual([6, 7]);
    assertNoDuplicateIds(slots);

    // 2. 把 6 提拔为后卫(slot 1)主力：应从 slot 4 替补移除
    slots = assignStarter(slots, 1, 6);
    expect(slots[1].player_id).toEqual(6);
    expect(slots[4].sub_player_ids).toEqual([7]);
    assertNoDuplicateIds(slots);

    // 3. 把原本是 slot 0 主力的 1 设为 slot 2 替补：slot 0 应变为 null
    slots = toggleSubPlayer(slots, 2, 1);
    expect(slots[0].player_id).toEqual(null);
    expect(slots[2].sub_player_ids).toEqual([1]);
    assertNoDuplicateIds(slots);

    // 4. 在两个主力之间指派同一人应互换
    slots = assignStarter(slots, 2, 5);
    expect(slots[2].player_id).toEqual(5);
    expect(slots[4].player_id).toEqual(3);
    assertNoDuplicateIds(slots);

    // 5. 再次点击 1 取消其替补
    slots = toggleSubPlayer(slots, 2, 1);
    expect(slots[2].sub_player_ids).toEqual([]);
    assertNoDuplicateIds(slots);

    // 6. 移除主力为 null 不丢失该位置替补
    slots = assignStarter(slots, 4, null);
    expect(slots[4].player_id).toEqual(null);
    expect(slots[4].sub_player_ids).toEqual([7]);
  });

  test("switchFormation and resetPositions preserve starters & subs while updating coords", () => {
    let slots = buildInitialLineupFromAttending(5, "1-2-1", [11, 12, 13, 14, 15]);
    slots = toggleSubPlayer(slots, 3, 16);
    slots = applyDragOutcome(slots, 2, { kind: "move", x: 0.4, y: 0.4 });

    const switched = switchFormation(slots, 5, "2-2");
    expect(switched.map((s) => s.player_id)).toEqual([11, 12, 13, 14, 15]);
    expect(switched[3].sub_player_ids).toEqual([16]);
    expect(switched[2].x).toEqual(getFormation(5, "2-2")[2].x);

    const moved = applyDragOutcome(switched, 1, { kind: "move", x: 0.15, y: 0.77 });
    const reset = resetPositions(moved, 5, "2-2");
    expect(reset[1].x).toEqual(getFormation(5, "2-2")[1].x);
    expect(reset[3].sub_player_ids).toEqual([16]);
  });

  test("resolveDragRelease detects tap, swap, and clamped move", () => {
    const slots = buildInitialLineupFromAttending(5, "1-2-1", [1, 2, 3, 4, 5]);
    const areaW = 690;
    const areaH = 910;

    // 轻点（位移 < 10rpx）
    const tap = resolveDragRelease({
      slot: 1,
      fromX: 345,
      fromY: 600,
      toX: 350,
      toY: 603,
      areaWidthRpx: areaW,
      areaHeightRpx: areaH,
      dotDiameterRpx: DOT_DIAMETER_RPX,
      slots,
    });
    expect(tap).toEqual({ kind: "tap" });

    // 拖到 slot 4 中心附近 -> swap
    const swap = resolveDragRelease({
      slot: 1,
      fromX: slots[1].x * areaW,
      fromY: slots[1].y * areaH,
      toX: slots[4].x * areaW + 10,
      toY: slots[4].y * areaH - 8,
      areaWidthRpx: areaW,
      areaHeightRpx: areaH,
      dotDiameterRpx: DOT_DIAMETER_RPX,
      slots,
    });
    expect(swap).toEqual({ kind: "swap", withSlot: 4 });

    // swap 只换主力球员，保留位置坐标与替补
    const withSub = toggleSubPlayer(slots, 4, 99);
    const swapped = applyDragOutcome(withSub, 1, swap);
    expect(swapped[1].player_id).toEqual(5);
    expect(swapped[4].player_id).toEqual(2);
    expect(swapped[1].x).toEqual(withSub[1].x);
    expect(swapped[4].sub_player_ids).toEqual([99]);

    // 拖出边界 -> 钳制在 0.06..0.94
    const moved = resolveDragRelease({
      slot: 1,
      fromX: 345,
      fromY: 600,
      toX: -50,
      toY: 1200,
      areaWidthRpx: areaW,
      areaHeightRpx: areaH,
      dotDiameterRpx: DOT_DIAMETER_RPX,
      slots,
    });
    expect(moved).toEqual({ kind: "move", x: 0.06, y: 0.94 });
    expect(clampCoord(Number.NaN)).toEqual(0.5);
  });

  test("finds unassigned attending players, current user role, and sub badge labels", () => {
    const attending: LineupCandidate[] = [
      { user_id: 1, nickname: "门神", avatar_url: null, source: "attending" },
      { user_id: 2, nickname: "铁卫", avatar_url: null, source: "attending" },
      { user_id: 3, nickname: "张三", avatar_url: null, source: "attending" },
      { user_id: 4, nickname: "李四", avatar_url: null, source: "attending" },
      { user_id: 5, nickname: "王五", avatar_url: null, source: "attending" },
      { user_id: 6, nickname: "赵六", avatar_url: null, source: "attending" },
      { user_id: 7, nickname: "小七", avatar_url: null, source: "attending" },
    ];
    let slots = buildInitialLineupFromAttending(5, "1-2-1", attending.map((a) => a.user_id));
    slots = toggleSubPlayer(slots, 4, 6);

    expect(getUnassignedAttending(slots, attending).map((p) => p.user_id)).toEqual([7]);

    const playersById: Record<number, MatchLineupPlayer> = Object.fromEntries(
      attending.map((a) => [a.user_id, { user_id: a.user_id, nickname: a.nickname, avatar_url: null }]),
    );
    const pitchSlots = buildPitchSlots(slots, getFormation(5, "1-2-1"), playersById);

    const starterRole = findCurrentUserRole(pitchSlots, 5);
    expect(starterRole?.kind).toEqual("starter");
    expect(starterRole?.label).toEqual("前锋");

    const subRole = findCurrentUserRole(pitchSlots, 6);
    expect(subRole).toEqual({
      kind: "sub",
      slot: 4,
      label: "前锋",
      starter: playersById[5],
    });
    expect(findCurrentUserRole(pitchSlots, 7)).toEqual(null);

    expect(formatSubBadgeText([])).toEqual("");
    expect(formatSubBadgeText([playersById[6]])).toEqual("替:赵六");
    expect(formatSubBadgeText([playersById[6], playersById[7]])).toEqual("替×2");
  });

  test("normalizes dirty backend slots and computes dragGeometry round-trip", () => {
    const normalized = normalizeLoadedSlots(
      [
        { slot: 0, player_id: 10, x: 0.5, y: 0.86, sub_player_ids: [10, 20, 20] },
        { slot: 1, player_id: 10, x: 2, y: -1, sub_player_ids: [20, 30] },
      ],
      5,
      "1-2-1",
    );
    expect(normalized.length).toEqual(5);
    expect(normalized[0].player_id).toEqual(10);
    expect(normalized[0].sub_player_ids).toEqual([20]);
    expect(normalized[1].player_id).toEqual(null);
    expect(normalized[1].x).toEqual(0.94);
    expect(normalized[1].y).toEqual(0.06);
    expect(normalized[1].sub_player_ids).toEqual([30]);

    const field = { width: 347, height: 458 };
    const pos = boxPositionPx({ x: 0.5, y: 0.5 }, field, 375);
    const centre = boxCentreRpx(pos, 375);
    expect(Math.abs(centre.x - 347) < 1).toEqual(true);
    expect(Math.abs(centre.y - 458) < 1).toEqual(true);
  });

  test("collectAttendingParticipants filters attending and orders by registered_at ascending", () => {
    const attending = collectAttendingParticipants({
      match: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "周末球赛",
        status: "registering",
        start_time: "2026-11-22T11:00:00Z",
        end_time: "2026-11-22T13:00:00Z",
        publication_mode: "offline_confirmed",
        opponent_state: "confirmed",
        host_team_id: 10,
        host_team_name: "主队",
        away_team_id: null,
        away_team_name: null,
        opponent_name: "客队",
        players_per_team: 5,
        registration_start_at: null,
        registration_end_at: null,
        location: "球场",
        location_latitude: null,
        location_longitude: null,
        description: null,
        created_at: "2026-11-20T00:00:00Z",
        updated_at: "2026-11-20T00:00:00Z",
      },
      groups: [
        {
          id: "g-host",
          kind: "host_team",
          team_id: 10,
          status: "open",
          min_players: 5,
          max_players: 10,
          attending_count: 2,
          my_registration: null,
          participants: [
            { user_id: 2, nickname: "后报名", avatar_url: null, status: "attending", registered_at: "2026-11-21T02:00:00Z" },
            { user_id: 3, nickname: "请假", avatar_url: null, status: "leave", registered_at: "2026-11-21T00:00:00Z" },
            { user_id: 1, nickname: "先报名", avatar_url: null, status: "attending", registered_at: "2026-11-21T01:00:00Z" },
          ],
        },
      ],
    });
    expect(attending.map((a) => a.user_id)).toEqual([1, 2]);
  });
});
