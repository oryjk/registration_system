import { describe, expect, test } from "bun:test";
import type { PitchSlotView } from "@/types/lineup";
import {
  buildLineupSharePayload,
  buildPosterSubSummaryLines,
  composeLineupImage,
  formatLineupMatchTime,
  LINEUP_POSTER,
  posterPlayerPoint,
} from "../lineupPoster";

const sampleSlots: PitchSlotView[] = [
  {
    slot: 0,
    position: "GK",
    label: "门将",
    x: 0.5,
    y: 0.86,
    starter: { user_id: 1, nickname: "门神", avatar_url: null },
    subs: [],
  },
  {
    slot: 1,
    position: "FW",
    label: "前锋",
    x: 0.5,
    y: 0.21,
    starter: { user_id: 2, nickname: "张三", avatar_url: null },
    subs: [
      { user_id: 3, nickname: "李四", avatar_url: null },
      { user_id: 4, nickname: "王五", avatar_url: null },
    ],
  },
];

describe("lineup poster", () => {
  test("formats match time strictly in Beijing timezone", () => {
    // UTC 2026-11-22T16:30:00Z => 北京时间 2026-11-23 周一 00:30-02:30
    expect(formatLineupMatchTime("2026-11-22T16:30:00Z", "2026-11-22T18:30:00Z")).toEqual(
      "11月23日 周一 00:30-02:30",
    );
    expect(formatLineupMatchTime("2026-11-22T11:00:00Z", "2026-11-22T13:00:00Z")).toEqual(
      "11月22日 周日 19:00-21:00",
    );
  });

  test("builds share payload and sub summary lines", () => {
    const share = buildLineupSharePayload({
      matchId: "123e4567-e89b-12d3-a456-426614174000",
      matchName: "周日晚场友谊赛",
      playersPerTeam: 8,
      formation: "3-3-1",
      imageUrl: "/tmp/card.jpg",
    });
    expect(share.title).toEqual("周日晚场友谊赛 · 8人制 3-3-1 阵型");
    expect(share.path).toEqual("/pages/matches/lineup/index?matchId=123e4567-e89b-12d3-a456-426614174000");
    expect(share.imageUrl).toEqual("/tmp/card.jpg");

    const lines = buildPosterSubSummaryLines(sampleSlots);
    expect(lines.length).toEqual(1);
    expect(lines[0].text).toEqual("[前锋] 张三 ⇄ 替补：李四、王五");

    const posterPoint = posterPlayerPoint(0.5, 0.5, false);
    const cardPoint = posterPlayerPoint(0.5, 0.5, true);
    expect(posterPoint.x).toEqual(375);
    expect(cardPoint.x).toEqual(375);
  });

  test("composeLineupImage gracefully degrades when mini code fails to load", async () => {
    const noop = () => {};
    const fakeCtx = {
      save: noop,
      restore: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      quadraticCurveTo: noop,
      arc: noop,
      clip: noop,
      fill: noop,
      stroke: noop,
      fillRect: noop,
      strokeRect: noop,
      fillText: noop,
      drawImage: noop,
      setFillStyle: noop,
      setStrokeStyle: noop,
      setLineWidth: noop,
      setTextAlign: noop,
      setTextBaseline: noop,
      font: "",
      draw: (_reserve: boolean, cb?: () => void) => cb?.(),
    };

    const previousUni = (globalThis as { uni?: unknown }).uni;
    (globalThis as { uni?: unknown }).uni = {
      createCanvasContext: () => fakeCtx,
      canvasToTempFilePath: (opts: { success: (res: { tempFilePath: string }) => void }) => {
        opts.success({ tempFilePath: "/tmp/lineup-poster.jpg" });
      },
    };

    try {
      const path = await composeLineupImage(
        LINEUP_POSTER.canvasId,
        {},
        {
          matchId: "123e4567-e89b-12d3-a456-426614174000",
          matchName: "测试赛",
          startTime: "2026-11-22T11:00:00Z",
          endTime: "2026-11-22T13:00:00Z",
          location: "奥体中心",
          playersPerTeam: 5,
          formation: "1-2-1",
          pitchSlots: sampleSlots,
        },
        "poster",
        "https://broken.example.com/code.png",
        () => true,
        async () => {
          throw new Error("mini code unavailable");
        },
      );
      expect(path).toEqual("/tmp/lineup-poster.jpg");
    } finally {
      (globalThis as { uni?: unknown }).uni = previousUni;
    }
  });
});
