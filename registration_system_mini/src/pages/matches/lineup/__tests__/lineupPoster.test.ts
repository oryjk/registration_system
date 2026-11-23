import { describe, expect, test } from "bun:test";
import type { PitchSlotView } from "@/types/lineup";
import {
  buildLineupSharePayload,
  buildPosterSubSummaryLines,
  composeLineupShareCard,
  formatLineupMatchTime,
  LINEUP_CARD,
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

function createMockLineupCanvas2D(tempFilePath = "/tmp/lineup-card.jpg") {
  const texts: Array<{ value: string; x: number; y: number; fillStyle: unknown }> = [];
  const strokeTexts: Array<{ value: string; x: number; y: number }> = [];
  const fillRects: Array<{ x: number; y: number; w: number; h: number; fillStyle: unknown }> = [];
  const images: unknown[][] = [];
  const arcs: Array<{ x: number; y: number; r: number }> = [];
  let radialGradients = 0;

  const ctx: Record<string, unknown> = {
    font: "normal bold 24px sans-serif",
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    lineJoin: "round",
    textAlign: "left",
    textBaseline: "middle",
    save: () => undefined,
    restore: () => undefined,
    clearRect: () => undefined,
    rect: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    quadraticCurveTo: () => undefined,
    arc: (x: number, y: number, r: number) => {
      arcs.push({ x, y, r });
    },
    clip: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    fillRect: (x: number, y: number, w: number, h: number) => {
      fillRects.push({ x, y, w, h, fillStyle: ctx.fillStyle });
    },
    strokeRect: () => undefined,
    measureText: (value: string) => {
      const m = /(\d+)px/.exec(String(ctx.font));
      const size = m ? Number(m[1]) : 24;
      return { width: Array.from(value).length * size };
    },
    fillText: (value: string, x: number, y: number) => {
      texts.push({ value, x, y, fillStyle: ctx.fillStyle });
    },
    strokeText: (value: string, x: number, y: number) => {
      strokeTexts.push({ value, x, y });
    },
    drawImage: (...args: unknown[]) => {
      images.push(args);
    },
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => {
      radialGradients += 1;
      return { addColorStop: () => undefined };
    },
  };

  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    createImage: () => {
      let currentSrc = "";
      const img: {
        width: number;
        height: number;
        onload: (() => void) | null;
        onerror: ((err: unknown) => void) | null;
        src: string;
      } = {
        width: 1600,
        height: 900,
        onload: null,
        onerror: null,
        get src() {
          return currentSrc;
        },
        set src(next: string) {
          currentSrc = next;
          queueMicrotask(() => img.onload?.());
        },
      };
      return img;
    },
    toTempFilePath: (opts: { success: (res: { tempFilePath: string }) => void }) => {
      opts.success({ tempFilePath });
    },
  };

  const createSelectorQuery = () => {
    const query = {
      in: () => query,
      select: () => query,
      fields: () => query,
      exec: (cb: (res: Array<{ node: typeof canvas }>) => void) => cb([{ node: canvas }]),
    };
    return query;
  };

  return {
    canvas,
    createSelectorQuery,
    texts,
    strokeTexts,
    fillRects,
    images,
    arcs,
    getRadialGradients: () => radialGradients,
  };
}

describe("lineup share card", () => {
  test("formats match time strictly in Beijing timezone", () => {
    // UTC 2026-11-22T16:30:00Z => 北京时间 2026-11-23 周一 00:30-02:30
    expect(formatLineupMatchTime("2026-11-22T16:30:00Z", "2026-11-22T18:30:00Z")).toEqual(
      "11月23日 周一 00:30-02:30",
    );
    expect(formatLineupMatchTime("2026-11-22T11:00:00Z", "2026-11-22T13:00:00Z")).toEqual(
      "11月22日 周日 19:00-21:00",
    );
  });

  test("builds share payload, sub summary lines and pitch coordinates", () => {
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
    expect(lines[0]!.text).toEqual("[前锋] 张三 ⇄ 李四、王五");

    // 右侧战术球场中心 x = 456 + 504 / 2 = 708
    const center = posterPlayerPoint(0.5, 0.5);
    expect(center.x).toEqual(708);
    expect(center.y > 114 && center.y < 664).toEqual(true);
  });

  test("composeLineupShareCard renders C2 fiery 5:4 card with custom background and degrades cleanly on failure", async () => {
    const previousUni = (globalThis as { uni?: unknown }).uni;

    // 1. 默认 C2 红黑底：含 LINEUP 暗纹、纯白底部通栏与矢量定位针
    const defaultMock = createMockLineupCanvas2D("/tmp/lineup-default.jpg");
    (globalThis as { uni?: unknown }).uni = {
      createSelectorQuery: defaultMock.createSelectorQuery,
    };

    try {
      const defaultPath = await composeLineupShareCard(
        LINEUP_CARD.canvasId,
        {},
        {
          matchId: "123e4567-e89b-12d3-a456-426614174000",
          matchName: "周四友谊赛",
          hostTeamName: "洛悦御府",
          opponentName: "河西联队",
          startTime: "2026-11-26T12:00:00Z",
          endTime: "2026-11-26T14:00:00Z",
          location: "悦享动运动公园",
          playersPerTeam: 8,
          formation: "3-3-1",
          pitchSlots: sampleSlots,
        },
        () => true,
      );
      expect(defaultPath).toEqual("/tmp/lineup-default.jpg");
      expect([defaultMock.canvas.width, defaultMock.canvas.height]).toEqual([1000, 800]);
      expect(defaultMock.getRadialGradients()).toEqual(1);
      expect(defaultMock.strokeTexts.some((t) => t.value === "LINEUP")).toEqual(true);
      expect(defaultMock.texts.some((t) => t.value === "8人制 · 3-3-1")).toEqual(true);
      expect(defaultMock.texts.some((t) => t.value === "首发 2/8")).toEqual(true);
      expect(defaultMock.texts.some((t) => t.value === "替补 2人")).toEqual(true);
      // 底部高对比纯白通栏 + 左侧 #FF453A 竖条 + 矢量定位针 + 深墨地址字
      expect(
        defaultMock.fillRects.some(
          (r) => r.x === 0 && r.y === 684 && r.w === 1000 && r.h === 116 && r.fillStyle === "#FFFFFF",
        ),
      ).toEqual(true);
      expect(
        defaultMock.fillRects.some(
          (r) => r.x === 0 && r.y === 684 && r.w === 18 && r.h === 116 && r.fillStyle === "#FF453A",
        ),
      ).toEqual(true);
      expect(defaultMock.arcs.filter((a) => a.y >= 684).length).toEqual(2);
      const bottomTexts = defaultMock.texts.filter((t) => t.y >= 684);
      expect(bottomTexts.some((t) => t.value.includes("悦享动运动公园"))).toEqual(true);
      expect(bottomTexts.every((t) => t.fillStyle === "#16070B")).toEqual(true);

      // 2. 自定义球队会员背景图：正确叠底与深红黑暗幕，不再绘制 LINEUP 水印
      const customMock = createMockLineupCanvas2D("/tmp/lineup-custom.jpg");
      (globalThis as { uni?: unknown }).uni = {
        createSelectorQuery: customMock.createSelectorQuery,
      };
      const customPath = await composeLineupShareCard(
        LINEUP_CARD.canvasId,
        {},
        {
          matchId: "123e4567-e89b-12d3-a456-426614174000",
          matchName: "周四友谊赛",
          startTime: "2026-11-26T12:00:00Z",
          endTime: "2026-11-26T14:00:00Z",
          location: "悦享动运动公园",
          playersPerTeam: 8,
          formation: "3-3-1",
          pitchSlots: sampleSlots,
          customBgImageUrl: "https://cdn.example.com/team-logo-bg.jpg",
        },
        () => true,
        async (src) => ({ path: `local://${src}`, width: 1600, height: 900 }),
      );
      expect(customPath).toEqual("/tmp/lineup-custom.jpg");
      expect(customMock.images.length).toEqual(1);
      expect((customMock.images[0]?.[0] as { src?: string })?.src).toEqual(
        "local://https://cdn.example.com/team-logo-bg.jpg",
      );
      expect(customMock.fillRects.some((r) => r.fillStyle === "rgba(18, 7, 11, 0.62)")).toEqual(true);
      expect(customMock.strokeTexts.some((t) => t.value === "LINEUP")).toEqual(false);

      // 3. 自定义背景图下载失败时优雅降级为默认 C2 红黑底
      const degradedMock = createMockLineupCanvas2D("/tmp/lineup-degraded.jpg");
      (globalThis as { uni?: unknown }).uni = {
        createSelectorQuery: degradedMock.createSelectorQuery,
      };
      const degradedPath = await composeLineupShareCard(
        LINEUP_CARD.canvasId,
        {},
        {
          matchId: "123e4567-e89b-12d3-a456-426614174000",
          matchName: "测试赛",
          startTime: "2026-11-26T12:00:00Z",
          endTime: "2026-11-26T14:00:00Z",
          location: "奥体中心",
          playersPerTeam: 5,
          formation: "1-2-1",
          pitchSlots: sampleSlots,
          customBgImageUrl: "https://broken.example.com/bg.jpg",
        },
        () => true,
        async () => {
          throw new Error("download failed");
        },
      );
      expect(degradedPath).toEqual("/tmp/lineup-degraded.jpg");
      expect(degradedMock.images.length).toEqual(0);
      expect(degradedMock.strokeTexts.some((t) => t.value === "LINEUP")).toEqual(true);
    } finally {
      (globalThis as { uni?: unknown }).uni = previousUni;
    }
  });
});
