import { expect, test } from "bun:test";
import {
  MATCH_SHARE_CARD_HEIGHT,
  MATCH_SHARE_CARD_WIDTH,
  buildMatchShareCardViewModel,
  buildMatchupDisplay,
  composeMatchShareCard,
  createMatchShareImageLoader,
  formatMatchShareTime,
  parseJerseyColor,
  truncateText,
  wrapTextLines,
  type MatchShareCardInput,
} from "@/utils/matchShareCardCompose";

function createMockCanvasContext() {
  const texts: Array<{ value: string; x: number; y: number; font: string }> = [];
  const images: unknown[][] = [];
  const arcs: Array<{ x: number; y: number; r: number }> = [];
  const gradients: Array<{ stops: Array<[number, string]> }> = [];

  const ctx = {
    font: "400 32px sans-serif",
    setFillStyle: () => undefined,
    setStrokeStyle: () => undefined,
    setLineWidth: () => undefined,
    setTextAlign: () => undefined,
    setTextBaseline: () => undefined,
    fillRect: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    quadraticCurveTo: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    clip: () => undefined,
    arc: (x: number, y: number, r: number) => {
      arcs.push({ x, y, r });
    },
    createLinearGradient: () => {
      const record = { stops: [] as Array<[number, string]> };
      gradients.push(record);
      return {
        addColorStop: (offset: number, color: string) => {
          record.stops.push([offset, color]);
        },
      };
    },
    measureText: (value: string) => {
      const sizeMatch = /(\d+)px/.exec(ctx.font);
      const size = sizeMatch ? Number(sizeMatch[1]) : 32;
      return { width: Array.from(value).length * size };
    },
    fillText: (value: string, x: number, y: number) => {
      texts.push({ value, x, y, font: ctx.font });
    },
    drawImage: (...args: unknown[]) => {
      images.push(args);
    },
    draw: (_reserve: boolean, done?: () => void) => {
      done?.();
    },
  };

  return { ctx, texts, images, arcs, gradients };
}

test("buildMatchupDisplay handles team versus, pending opponent, pickup and venue matches", () => {
  expect(
    buildMatchupDisplay({
      name: "周日晚场友谊赛",
      homeTeamLabel: "银河战舰",
      opponentLabel: "朝阳联队",
    }),
  ).toEqual({
    mode: "versus",
    homeName: "银河战舰",
    awayName: "朝阳联队",
    awayPending: false,
    headline: "银河战舰 VS 朝阳联队",
  });

  expect(
    buildMatchupDisplay({
      name: "周六约队",
      homeTeamLabel: "银河战舰",
      opponentLabel: "对手待定",
    }),
  ).toEqual({
    mode: "versus",
    homeName: "银河战舰",
    awayName: "对手待定",
    awayPending: true,
    headline: "银河战舰 VS 对手待定",
  });

  expect(
    buildMatchupDisplay({
      name: "工人体育场散人夜场",
      homeTeamLabel: "待定",
      opponentLabel: "待定",
      isPickupMatch: true,
      playersPerTeam: 8,
    }),
  ).toEqual({
    mode: "headline",
    primaryText: "工人体育场散人夜场",
    secondaryText: "8人制 · 散人约球 · 欢迎报名",
    headline: "工人体育场散人夜场",
  });

  expect(
    buildMatchupDisplay({
      name: "奥森场馆周中局",
      isVenueMatch: true,
      playersPerTeam: 7,
    }),
  ).toEqual({
    mode: "headline",
    primaryText: "奥森场馆周中局",
    secondaryText: "7人制 · 场馆组局 · 欢迎报名",
    headline: "奥森场馆周中局",
  });

  expect(
    buildMatchupDisplay({
      name: "周末热身赛",
      homeTeamLabel: "待定",
      opponentLabel: "",
    }),
  ).toEqual({
    mode: "headline",
    primaryText: "周末热身赛",
    secondaryText: "对手待定",
    headline: "周末热身赛 · 对手待定",
  });
});

test("formatMatchShareTime formats UTC instants into Beijing time including cross-day and cross-year boundaries", () => {
  // 2026-11-22T11:00:00Z -> 北京时间 2026-11-22 周日 19:00-21:00
  expect(
    formatMatchShareTime("2026-11-22T11:00:00Z", "2026-11-22T13:00:00Z"),
  ).toEqual("11月22日 周日 19:00-21:00");

  // 跨北京时间午夜及跨年：2025-12-31T16:30:00Z -> 北京时间 2026-01-01 周四 00:30
  expect(
    formatMatchShareTime("2025-12-31T16:30:00Z", "2025-12-31T18:30:00Z"),
  ).toEqual("1月1日 周四 00:30-02:30");

  // 单场比赛跨日：北京时间 12月31日 22:00 至 1月1日 00:30
  expect(
    formatMatchShareTime("2025-12-31T14:00:00Z", "2025-12-31T16:30:00Z"),
  ).toEqual("12月31日 周三 22:00-1月1日 00:30");

  // 旧无时区时间戳按 UTC 解析
  expect(formatMatchShareTime("2026-11-22 11:00:00")).toEqual("11月22日 周日 19:00");

  // 缺失或非法时间使用兜底文案
  expect(formatMatchShareTime("", "", "19:30")).toEqual("19:30");
  expect(formatMatchShareTime("invalid-time")).toEqual("时间待定");
});

test("parseJerseyColor handles HEX, 3-digit HEX, Chinese/English names, custom text and empty values", () => {
  expect(parseJerseyColor("#FFFFFF")).toEqual({ swatch: "#ffffff", label: "白色" });
  expect(parseJerseyColor("#ef4444")).toEqual({ swatch: "#ef4444", label: "红色" });
  expect(parseJerseyColor("#2F6BFF")).toEqual({ swatch: "#2f6bff", label: "蓝色" });
  expect(parseJerseyColor("#C8FF00")).toEqual({ swatch: "#c8ff00", label: "荧光绿" });
  expect(parseJerseyColor("#fff")).toEqual({ swatch: "#ffffff", label: "白色" });
  expect(parseJerseyColor("#f00")).toEqual({ swatch: "#ff0000", label: "红色" });
  expect(parseJerseyColor("#123456")).toEqual({ swatch: "#123456", label: "#123456" });

  expect(parseJerseyColor("白色")).toEqual({ swatch: "#ffffff", label: "白色" });
  expect(parseJerseyColor("红色队服")).toEqual({ swatch: "#ef4444", label: "红色" });
  expect(parseJerseyColor("蓝")).toEqual({ swatch: "#2f6bff", label: "蓝色" });
  expect(parseJerseyColor("white")).toEqual({ swatch: "#ffffff", label: "白色" });
  expect(parseJerseyColor("BLUE")).toEqual({ swatch: "#2f6bff", label: "蓝色" });
  expect(parseJerseyColor("蓝白间条球衣")).toEqual({ swatch: "", label: "蓝白间条" });

  expect(parseJerseyColor("")).toEqual(null);
  expect(parseJerseyColor("   ")).toEqual(null);
  expect(parseJerseyColor(null)).toEqual(null);
});

test("buildMatchShareCardViewModel handles dual, single and missing jersey colors", () => {
  const base: MatchShareCardInput = {
    name: "周日晚场约战",
    matchKindLabel: "线下已约",
    homeTeamLabel: "太阳神",
    opponentLabel: "风暴队",
    startTime: "2026-11-22T11:00:00Z",
    endTime: "2026-11-22T13:00:00Z",
    location: "朝阳公园足球场 3号场",
    playersPerTeam: 7,
  };

  const dual = buildMatchShareCardViewModel({
    ...base,
    homeTeamColor: "#FFFFFF",
    awayTeamColor: "红色",
  });
  expect(dual.badgeLabel).toEqual("线下已约");
  expect(dual.formatTag).toEqual("7人制");
  expect(dual.jerseyItems).toEqual([
    { role: "home", roleLabel: "主", swatch: "#ffffff", label: "白色", displayText: "白色（主）" },
    { role: "away", roleLabel: "客", swatch: "#ef4444", label: "红色", displayText: "红色（客）" },
  ]);
  expect(dual.jerseyFallbackText).toEqual("");

  const homeOnly = buildMatchShareCardViewModel({
    ...base,
    homeTeamColor: "#2F6BFF",
    awayTeamColor: "",
  });
  expect(homeOnly.jerseyItems).toEqual([
    { role: "home", roleLabel: "主", swatch: "#2f6bff", label: "蓝色", displayText: "蓝色（主）" },
  ]);
  expect(homeOnly.jerseyFallbackText).toEqual("");

  const awayOnly = buildMatchShareCardViewModel({
    ...base,
    homeTeamColor: "",
    awayTeamColor: "荧光绿",
  });
  expect(awayOnly.jerseyItems).toEqual([
    { role: "away", roleLabel: "客", swatch: "#c8ff00", label: "荧光绿", displayText: "荧光绿（客）" },
  ]);

  const neither = buildMatchShareCardViewModel({
    ...base,
    matchKindLabel: "其他类型",
    homeTeamColor: "",
    awayTeamColor: "  ",
    location: "",
  });
  expect(neither.badgeLabel).toEqual("赛事报名");
  expect(neither.locationLabel).toEqual("地点待定");
  expect(neither.jerseyItems).toEqual([]);
  expect(neither.jerseyFallbackText).toEqual("球服颜色待定");
});

test("truncateText and wrapTextLines gracefully truncate long locations within max lines", () => {
  expect(truncateText("  朝阳公园   3号场 ", 20)).toEqual("朝阳公园 3号场");
  expect(truncateText("北京市朝阳区奥林匹克森林公园南园足球场A区3号场地", 10)).toEqual("北京市朝阳区奥林匹…");
  expect(truncateText("测试", 1)).toEqual("…");
  expect(truncateText("", 5)).toEqual("");

  const measure = (value: string) => Array.from(value).length * 34;
  const longAddress = "北京市朝阳区奥林匹克森林公园南园综合体育中心足球场A区标准11人制3号场地东侧入口";
  const twoLines = wrapTextLines(longAddress, 340, measure, 2);
  expect(twoLines.length).toEqual(2);
  expect(twoLines[0]!.length).toEqual(10);
  expect(twoLines[1]!.endsWith("…")).toEqual(true);
  expect(measure(twoLines[1]!) <= 340).toEqual(true);

  const oneLine = wrapTextLines(longAddress, 340, measure, 1);
  expect(oneLine.length).toEqual(1);
  expect(oneLine[0]!.endsWith("…")).toEqual(true);
  expect(measure(oneLine[0]!) <= 340).toEqual(true);
});

test("composeMatchShareCard exports 1000x800 card with cover, dark veil, matchup, time, location and jersey dots", async () => {
  const previousUni = (globalThis as unknown as { uni?: typeof uni }).uni;
  const { ctx, texts, images, arcs, gradients } = createMockCanvasContext();
  let exportOptions: Record<string, unknown> | undefined;

  (globalThis as unknown as { uni: typeof uni }).uni = {
    getImageInfo: ({ src, success }: { src: string; success: (res: { path: string; width: number; height: number }) => void }) => {
      success({ path: `local://${src}`, width: 1600, height: 900 });
    },
    createCanvasContext: () => ctx,
    canvasToTempFilePath: (options: Record<string, unknown> & { success: (res: { tempFilePath: string }) => void }) => {
      exportOptions = options;
      options.success({ tempFilePath: "/tmp/match-share-card.jpg" });
    },
  } as unknown as typeof uni;

  try {
    const longLocation = "北京市朝阳区奥林匹克森林公园南园综合体育中心足球场A区标准11人制3号场地东侧入口北门";
    const path = await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      {
        name: "周日晚场友谊赛",
        matchKindLabel: "线下已约",
        homeTeamLabel: "太阳神",
        opponentLabel: "风暴队",
        homeTeamColor: "#FFFFFF",
        awayTeamColor: "#EF4444",
        startTime: "2026-11-22T11:00:00Z",
        endTime: "2026-11-22T13:00:00Z",
        location: longLocation,
        playersPerTeam: 7,
      },
      ["https://cdn.example.com/cover.jpg"],
      () => true,
    );

    expect(path).toEqual("/tmp/match-share-card.jpg");
    expect([exportOptions?.width, exportOptions?.height, exportOptions?.destWidth, exportOptions?.destHeight]).toEqual([
      MATCH_SHARE_CARD_WIDTH,
      MATCH_SHARE_CARD_HEIGHT,
      1000,
      800,
    ]);
    // 绘制了底图且叠加了深海蓝渐变暗幕
    expect(images.length).toEqual(1);
    expect(images[0]?.[0]).toEqual("local://https://cdn.example.com/cover.jpg");
    expect(gradients.length >= 2).toEqual(true);

    const rendered = texts.map((item) => item.value);
    expect(rendered.includes("太阳神")).toEqual(true);
    expect(rendered.includes("VS")).toEqual(true);
    expect(rendered.includes("风暴队")).toEqual(true);
    expect(rendered.includes("11月22日 周日 19:00-21:00")).toEqual(true);
    expect(rendered.includes("白色（主）")).toEqual(true);
    expect(rendered.includes("红色（客）")).toEqual(true);

    // 两个球服颜色圆点
    expect(arcs.filter((item) => item.r === 15).length).toEqual(2);

    // 超长地点被截断为最多 2 行并以省略号结尾
    const locationTexts = rendered.filter((value) => value.includes("北京市朝阳区") || value.endsWith("…"));
    expect(locationTexts.length <= 2).toEqual(true);
    expect(locationTexts.some((value) => value.endsWith("…"))).toEqual(true);
  } finally {
    (globalThis as unknown as { uni?: typeof uni }).uni = previousUni;
  }
});

test("composeMatchShareCard falls back across candidate covers, degrades to navy backdrop on total failure, and aborts when stale", async () => {
  const previousUni = (globalThis as unknown as { uni?: typeof uni }).uni;
  const firstRun = createMockCanvasContext();
  const requested: string[] = [];

  (globalThis as unknown as { uni: typeof uni }).uni = {
    getImageInfo: ({
      src,
      success,
      fail,
    }: {
      src: string;
      success: (res: { path: string; width: number; height: number }) => void;
      fail: (err: Error) => void;
    }) => {
      requested.push(src);
      if (src.includes("backup-ok")) {
        success({ path: `local://${src}`, width: 1000, height: 800 });
      } else {
        fail(new Error("download failed"));
      }
    },
    createCanvasContext: () => firstRun.ctx,
    canvasToTempFilePath: ({ success }: { success: (res: { tempFilePath: string }) => void }) => {
      success({ tempFilePath: "/tmp/fallback-card.jpg" });
    },
  } as unknown as typeof uni;

  try {
    // 第一张自定义图失败时自动回退第二张候选封面
    const recoveredPath = await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      { name: "候选回退测试", homeTeamLabel: "甲队", opponentLabel: "乙队" },
      ["https://cdn.example.com/broken-custom.jpg", "https://cdn.example.com/backup-ok.jpg"],
      () => true,
    );
    expect(recoveredPath).toEqual("/tmp/fallback-card.jpg");
    expect(firstRun.images.length).toEqual(1);
    expect(firstRun.images[0]?.[0]).toEqual("local://https://cdn.example.com/backup-ok.jpg");

    // 全部背景图都失败时降级为深海蓝质感底色，不阻断合成
    requested.length = 0;
    const secondRun = createMockCanvasContext();
    (globalThis as unknown as { uni: typeof uni }).uni.createCanvasContext = () => secondRun.ctx as unknown as UniApp.CanvasContext;

    const loader = createMatchShareImageLoader();
    const degradedPath = await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      {
        name: "散人夜场局",
        matchKindLabel: "散人约球",
        isPickupMatch: true,
        startTime: "2026-11-22T11:00:00Z",
        location: "工人体育场副场",
      },
      ["https://cdn.example.com/broken-1.jpg", "https://cdn.example.com/broken-2.jpg"],
      () => true,
      loader.load,
    );
    loader.clear();

    expect(degradedPath).toEqual("/tmp/fallback-card.jpg");
    expect(requested).toEqual([
      "https://cdn.example.com/broken-1.jpg",
      "https://cdn.example.com/broken-2.jpg",
    ]);
    expect(secondRun.images.length).toEqual(0);
    expect(secondRun.arcs.length >= 2).toEqual(true);
    expect(secondRun.texts.map((item) => item.value).includes("球服颜色待定")).toEqual(true);

    // 版本过期时立即中止且不绘制
    let staleError = "";
    try {
      await composeMatchShareCard(
        "match-share-card-canvas",
        {},
        { name: "过期任务" },
        [],
        () => false,
      );
    } catch (error) {
      staleError = error instanceof Error ? error.message : String(error);
    }
    expect(staleError).toEqual("分享卡内容已更新");
  } finally {
    (globalThis as unknown as { uni?: typeof uni }).uni = previousUni;
  }
});
