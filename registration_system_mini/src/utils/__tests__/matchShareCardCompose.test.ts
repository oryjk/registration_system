import { expect, test } from "bun:test";
import {
  MATCH_SHARE_CARD_HEIGHT,
  MATCH_SHARE_CARD_WIDTH,
  buildMatchShareCardViewModel,
  buildMatchupDisplay,
  buildTeamKitView,
  collectRegistrationAvatarUrls,
  composeMatchShareCard,
  createMatchShareImageLoader,
  drawKitRow,
  fitText,
  formatMatchShareTime,
  formatRegistrationStatusBadge,
  isLightColor,
  parseJerseyColor,
  strokeForKit,
  truncateText,
  wrapTextLines,
  type MatchShareCardInput,
} from "@/pages/matches/matchShareCardCompose";

interface MockCanvasOptions {
  withRadialGradient?: boolean;
  withStrokeText?: boolean;
  tempFilePath?: string;
}

function createMockCanvasContext(options: MockCanvasOptions = {}) {
  const { withRadialGradient = true, withStrokeText = true, tempFilePath = "/tmp/match-share-c2.jpg" } = options;
  const texts: Array<{ value: string; x: number; y: number; font: string; fillStyle: unknown }> = [];
  const strokeTexts: Array<{ value: string; x: number; y: number; font: string; strokeStyle: string }> = [];
  const images: unknown[][] = [];
  const fillRects: Array<{ x: number; y: number; w: number; h: number; fillStyle: unknown }> = [];
  const scales: Array<{ sx: number; sy: number }> = [];
  const translates: Array<{ x: number; y: number }> = [];
  const filledPaths: Array<{ fillStyle: unknown; moveToCount: number }> = [];
  const strokedPaths: Array<{ strokeStyle: string; lineWidth: number }> = [];
  const arcs: Array<{ x: number; y: number; r: number }> = [];
  const linearGradients: Array<{ stops: Array<[number, string]> }> = [];
  const radialGradients: Array<{ stops: Array<[number, string]> }> = [];
  let exportOptions: Record<string, unknown> | undefined;

  let currentMoveToCount = 0;

  const ctx: Record<string, unknown> = {
    font: "normal normal 32px sans-serif",
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    lineJoin: "miter",
    textAlign: "left",
    textBaseline: "alphabetic",
    clearRect: () => undefined,
    rect: () => undefined,
    fillRect: (x: number, y: number, w: number, h: number) => {
      fillRects.push({ x, y, w, h, fillStyle: ctx.fillStyle });
    },
    strokeRect: () => undefined,
    beginPath: () => {
      currentMoveToCount = 0;
    },
    closePath: () => undefined,
    moveTo: () => {
      currentMoveToCount += 1;
    },
    lineTo: () => undefined,
    quadraticCurveTo: () => undefined,
    arc: (x: number, y: number, r: number) => {
      arcs.push({ x, y, r });
    },
    fill: () => {
      filledPaths.push({ fillStyle: ctx.fillStyle, moveToCount: currentMoveToCount });
    },
    stroke: () => {
      strokedPaths.push({ strokeStyle: String(ctx.strokeStyle), lineWidth: Number(ctx.lineWidth) });
    },
    save: () => undefined,
    restore: () => undefined,
    clip: () => undefined,
    translate: (x: number, y: number) => {
      translates.push({ x, y });
    },
    scale: (sx: number, sy: number) => {
      scales.push({ sx, sy });
    },
    createLinearGradient: () => {
      const record = { stops: [] as Array<[number, string]> };
      linearGradients.push(record);
      return {
        addColorStop: (offset: number, color: string) => {
          record.stops.push([offset, color]);
        },
      };
    },
    measureText: (value: string) => {
      const sizeMatch = /(\d+)px/.exec(String(ctx.font));
      const size = sizeMatch ? Number(sizeMatch[1]) : 32;
      return { width: Array.from(value).length * size };
    },
    fillText: (value: string, x: number, y: number) => {
      texts.push({ value, x, y, font: String(ctx.font), fillStyle: ctx.fillStyle });
    },
    drawImage: (...args: unknown[]) => {
      images.push(args);
    },
  };

  if (withRadialGradient) {
    ctx.createRadialGradient = () => {
      const record = { stops: [] as Array<[number, string]> };
      radialGradients.push(record);
      return {
        addColorStop: (offset: number, color: string) => {
          record.stops.push([offset, color]);
        },
      };
    };
  }

  if (withStrokeText) {
    ctx.strokeText = (value: string, x: number, y: number) => {
      strokeTexts.push({ value, x, y, font: String(ctx.font), strokeStyle: String(ctx.strokeStyle) });
    };
  }

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
          queueMicrotask(() => {
            img.onload?.();
          });
        },
      };
      return img;
    },
    toTempFilePath: (opts: Record<string, unknown> & { success: (res: { tempFilePath: string }) => void }) => {
      exportOptions = opts;
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
    ctx: ctx as unknown as CanvasRenderingContext2D,
    canvas,
    createSelectorQuery,
    texts,
    strokeTexts,
    images,
    fillRects,
    scales,
    translates,
    filledPaths,
    strokedPaths,
    arcs,
    linearGradients,
    radialGradients,
    getExportOptions: () => exportOptions,
  };
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

test("parseJerseyColor, isLightColor and strokeForKit handle HEX, color names and light/dark borders", () => {
  expect(parseJerseyColor("#FFFFFF")).toEqual({ swatch: "#ffffff", label: "白色" });
  expect(parseJerseyColor("#ef4444")).toEqual({ swatch: "#ef4444", label: "红色" });
  expect(parseJerseyColor("#2F6BFF")).toEqual({ swatch: "#2f6bff", label: "蓝色" });
  expect(parseJerseyColor("#C8FF00")).toEqual({ swatch: "#c8ff00", label: "荧光绿" });
  expect(parseJerseyColor("#fff")).toEqual({ swatch: "#ffffff", label: "白色" });
  expect(parseJerseyColor("#f00")).toEqual({ swatch: "#ff0000", label: "红色" });
  expect(parseJerseyColor("#123456")).toEqual({ swatch: "#123456", label: "#123456" });

  expect(parseJerseyColor("白色")).toEqual({ swatch: "#ffffff", label: "白色" });
  expect(parseJerseyColor("红色队服")).toEqual({ swatch: "#ef4444", label: "红色" });
  expect(parseJerseyColor("黑色球裤")).toEqual({ swatch: "#111310", label: "黑色" });
  expect(parseJerseyColor("白袜")).toEqual({ swatch: "#ffffff", label: "白色" });
  expect(parseJerseyColor("蓝")).toEqual({ swatch: "#2f6bff", label: "蓝色" });
  expect(parseJerseyColor("white")).toEqual({ swatch: "#ffffff", label: "白色" });
  expect(parseJerseyColor("BLUE")).toEqual({ swatch: "#2f6bff", label: "蓝色" });
  expect(parseJerseyColor("蓝白间条球衣")).toEqual({ swatch: "", label: "蓝白间条" });

  expect(parseJerseyColor("")).toEqual(null);
  expect(parseJerseyColor("   ")).toEqual(null);
  expect(parseJerseyColor(null)).toEqual(null);

  // 浅色（白/银灰/荧光绿/黄）描深色边，深色（红/黑/蓝）描白色边
  expect(isLightColor("#FFFFFF")).toEqual(true);
  expect(isLightColor("#D8DDE6")).toEqual(true);
  expect(isLightColor("#C8FF00")).toEqual(true);
  expect(isLightColor("#FACC15")).toEqual(true);
  expect(isLightColor("#EF4444")).toEqual(false);
  expect(isLightColor("#111310")).toEqual(false);
  expect(isLightColor("#2F6BFF")).toEqual(false);

  expect(strokeForKit("#FFFFFF")).toEqual("rgba(15, 23, 42, 0.55)");
  expect(strokeForKit("#C8FF00")).toEqual("rgba(15, 23, 42, 0.55)");
  expect(strokeForKit("#EF4444")).toEqual("rgba(255, 255, 255, 0.88)");
  expect(strokeForKit("#111310")).toEqual("rgba(255, 255, 255, 0.88)");
});

function expectClose(actual: number | undefined, expected: number, epsilon = 1e-4) {
  expect(typeof actual === "number" && Math.abs(actual - expected) <= epsilon).toEqual(true);
}

test("buildTeamKitView and drawKitRow cover all 5 kit combinations with accurate icon count, sizing and copy", () => {
  // 1. 全套：衣 + 裤 + 袜
  const fullKit = buildTeamKitView("#FFFFFF", "#111310", "#FFFFFF");
  expect(fullKit.iconPieces.map((p) => p.kind)).toEqual(["shirt", "shorts", "socks"]);
  expect(fullKit.summaryText).toEqual("白衣 · 黑裤 · 白袜");
  const fullCanvas = createMockCanvasContext();
  expect(drawKitRow(fullCanvas.ctx, fullKit.iconPieces, 759, 244, 86, 18)).toEqual(3);
  expect(fullCanvas.scales.length).toEqual(3);
  expectClose(fullCanvas.scales[0]?.sx, 0.86);
  expectClose(fullCanvas.scales[1]?.sx, 0.86 * 0.92);
  expectClose(fullCanvas.scales[2]?.sx, 0.86 * 0.92);

  // 2. 仅上衣（放大 1.18x 居中展示）
  const shirtOnlyKit = buildTeamKitView("#C8FF00", "", "");
  expect(shirtOnlyKit.iconPieces.map((p) => p.kind)).toEqual(["shirt"]);
  expect(shirtOnlyKit.summaryText).toEqual("荧光绿衣");
  const shirtOnlyCanvas = createMockCanvasContext();
  expect(drawKitRow(shirtOnlyCanvas.ctx, shirtOnlyKit.iconPieces, 759, 244, 86, 18)).toEqual(1);
  expect(shirtOnlyCanvas.scales.length).toEqual(1);
  expectClose(shirtOnlyCanvas.scales[0]?.sx, (86 * 1.18) / 100);
  expectClose(shirtOnlyCanvas.translates[0]?.x, 759, 0.01);

  // 3. 衣 + 裤（无袜）
  const shirtShortsKit = buildTeamKitView("#FACC15", "#111310", "");
  expect(shirtShortsKit.iconPieces.map((p) => p.kind)).toEqual(["shirt", "shorts"]);
  expect(shirtShortsKit.summaryText).toEqual("黄衣 · 黑裤");
  const shirtShortsCanvas = createMockCanvasContext();
  expect(drawKitRow(shirtShortsCanvas.ctx, shirtShortsKit.iconPieces, 759, 244, 86, 18)).toEqual(2);
  expect(shirtShortsCanvas.scales.length).toEqual(2);

  // 4. 衣 + 袜（无裤）
  const shirtSocksKit = buildTeamKitView("#FFFFFF", "", "#2F6BFF");
  expect(shirtSocksKit.iconPieces.map((p) => p.kind)).toEqual(["shirt", "socks"]);
  expect(shirtSocksKit.summaryText).toEqual("白衣 · 蓝袜");
  const shirtSocksCanvas = createMockCanvasContext();
  expect(drawKitRow(shirtSocksCanvas.ctx, shirtSocksKit.iconPieces, 759, 244, 86, 18)).toEqual(2);
  expect(shirtSocksCanvas.scales.length).toEqual(2);

  // 5. 全未设置（不画空图标，展示「队服待定」）
  const emptyKit = buildTeamKitView("", "", "");
  expect(emptyKit.iconPieces.length).toEqual(0);
  expect(emptyKit.summaryText).toEqual("队服待定");
  const emptyCanvas = createMockCanvasContext();
  expect(drawKitRow(emptyCanvas.ctx, emptyKit.iconPieces, 759, 244, 86, 18)).toEqual(0);
  expect(emptyCanvas.scales.length).toEqual(0);
  expect(emptyCanvas.filledPaths.length).toEqual(0);
});

test("buildMatchShareCardViewModel assembles C2 kit summaries, venue tag and fallback values", () => {
  const base: MatchShareCardInput = {
    name: "周日晚场约战",
    matchKindLabel: "约队赛",
    homeTeamLabel: "洺悦御府",
    opponentLabel: "河西周四 FC",
    startTime: "2026-11-23T11:30:00Z",
    endTime: "2026-11-23T13:30:00Z",
    location: "东湖公园足球中心 5号场",
    playersPerTeam: 8,
  };

  const full = buildMatchShareCardViewModel({
    ...base,
    homeTeamColor: "#FFFFFF",
    homeShortsColor: "#111310",
    homeSocksColor: "#FFFFFF",
    awayTeamColor: "#EF4444",
    awayShortsColor: "#FFFFFF",
    awaySocksColor: "#EF4444",
  });
  expect(full.badgeLabel).toEqual("约队赛");
  expect(full.formatTag).toEqual("8人制");
  expect(full.venueMetaTag).toEqual("8人制 · 约队赛");
  expect(full.homeKit.summaryText).toEqual("白衣 · 黑裤 · 白袜");
  expect(full.awayKit.summaryText).toEqual("红衣 · 白裤 · 红袜");
  expect(full.jerseyFallbackText).toEqual("");

  const neither = buildMatchShareCardViewModel({
    ...base,
    matchKindLabel: "其他类型",
    location: "",
  });
  expect(neither.badgeLabel).toEqual("赛事报名");
  expect(neither.locationLabel).toEqual("地点待定");
  expect(neither.homeKit.summaryText).toEqual("队服待定");
  expect(neither.awayKit.summaryText).toEqual("队服待定");
  expect(neither.jerseyFallbackText).toEqual("队服待定");
});

test("fitText, truncateText and wrapTextLines shrink and ellipsize long team names and addresses", () => {
  const { ctx } = createMockCanvasContext();

  // 短队名保持最大 78px
  const shortFit = fitText(ctx, "洺悦御府", 480, 78, 46, 900);
  expect(shortFit).toEqual({ size: 78, text: "洺悦御府" });

  // 中等长度队名自动缩小字号但不截断
  const mediumFit = fitText(ctx, "成都高新南区联队", 480, 78, 46, 900);
  expect(mediumFit.size < 78 && mediumFit.size >= 46).toEqual(true);
  expect(mediumFit.text).toEqual("成都高新南区联队");

  // 超长队名缩至最小 46px 并以省略号结尾，绝不越过 480px 撞到右侧装备块
  const longFit = fitText(ctx, "成都高新南区天府绿茵足球俱乐部一队", 480, 78, 46, 900);
  expect(longFit.size).toEqual(46);
  expect(longFit.text.endsWith("…")).toEqual(true);
  expect(Array.from(longFit.text).length * 46 <= 480).toEqual(true);

  expect(truncateText("  朝阳公园   3号场 ", 20)).toEqual("朝阳公园 3号场");
  expect(truncateText("北京市朝阳区奥林匹克森林公园南园足球场A区3号场地", 10)).toEqual("北京市朝阳区奥林匹…");
  expect(truncateText("测试", 1)).toEqual("…");
  expect(truncateText("", 5)).toEqual("");

  const measure = (value: string) => Array.from(value).length * 34;
  const longAddress = "北京市朝阳区奥林匹克森林公园南园综合体育中心足球场A区标准11人制3号场地东侧入口";
  const twoLines = wrapTextLines(longAddress, 340, measure, 2);
  expect(twoLines.length).toEqual(2);
  expect(twoLines[1]!.endsWith("…")).toEqual(true);
});

test("composeMatchShareCard renders C2 fiery backdrop with full/mixed/empty kits and long names", async () => {
  const previousUni = (globalThis as unknown as { uni?: typeof uni }).uni;
  const mock = createMockCanvasContext({ withRadialGradient: true, withStrokeText: true });

  (globalThis as unknown as { uni: typeof uni }).uni = {
    getImageInfo: () => {
      throw new Error("should not download image when no customBgImageUrl is provided");
    },
    createSelectorQuery: mock.createSelectorQuery,
  } as unknown as typeof uni;

  try {
    const longLocation = "北京市朝阳区奥林匹克森林公园南园综合体育中心足球场A区标准11人制3号场地东侧入口";
    const path = await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      {
        name: "周日晚场友谊赛",
        matchKindLabel: "约队赛",
        homeTeamLabel: "成都高新南区天府绿茵风暴超级俱乐部联队",
        opponentLabel: "河西周四 FC",
        homeTeamColor: "#FFFFFF",
        homeShortsColor: "#111310",
        homeSocksColor: "#22C55E",
        awayTeamColor: "#2F6BFF",
        startTime: "2026-11-23T11:30:00Z",
        endTime: "2026-11-23T13:30:00Z",
        location: longLocation,
        playersPerTeam: 8,
      },
      [],
      () => true,
    );

    const exportOptions = mock.getExportOptions();
    expect(path).toEqual("/tmp/match-share-c2.jpg");
    expect([mock.canvas.width, mock.canvas.height]).toEqual([
      MATCH_SHARE_CARD_WIDTH,
      MATCH_SHARE_CARD_HEIGHT,
    ]);
    expect([exportOptions?.width, exportOptions?.height, exportOptions?.destWidth, exportOptions?.destHeight]).toEqual([
      MATCH_SHARE_CARD_WIDTH,
      MATCH_SHARE_CARD_HEIGHT,
      1000,
      800,
    ]);

    // Canvas 2D 原生使用 createRadialGradient 绘制红黑射灯底 + MATCHDAY 暗纹
    expect(mock.radialGradients.length).toEqual(1);
    expect(mock.linearGradients.length).toEqual(2);
    expect(mock.images.length).toEqual(0);
    expect(mock.strokeTexts.some((t) => t.value === "MATCHDAY")).toEqual(true);
    // font 统一使用标准关键字 bold/normal + sans-serif，并叠加同色 strokeText 强化海报体量感
    expect(mock.texts.every((t) => /^(?:normal|italic) (?:normal|bold) \d+px sans-serif$/.test(t.font))).toEqual(true);
    expect(mock.strokeTexts.some((t) => t.value === "VS")).toEqual(true);
    expect(mock.strokeTexts.some((t) => t.value === "河西周四 FC")).toEqual(true);

    const rendered = mock.texts.map((item) => item.value);
    expect(rendered.includes("11月23日 周一 19:30-21:30")).toEqual(true);
    expect(rendered.includes("主队 HOME")).toEqual(true);
    expect(rendered.includes("对手 AWAY")).toEqual(true);
    expect(rendered.includes("VS")).toEqual(true);
    expect(rendered.includes("河西周四 FC")).toEqual(true);
    // 主队全套 3 件 + 客队仅上衣 1 件 = 4 个矢量装备图标
    expect(mock.scales.length).toEqual(4);
    expect(rendered.includes("白衣 · 黑裤 · 绿袜")).toEqual(true);
    expect(rendered.includes("蓝衣")).toEqual(true);

    // 超长主队名在 46px 处截断，未越界
    const homeNameDraw = mock.texts.find((t) => t.x === 80 && t.y === 128 + 132);
    expect(homeNameDraw?.value.endsWith("…")).toEqual(true);
    expect(homeNameDraw?.font).toEqual("normal bold 46px sans-serif");

    // 底部地点通栏：高对比纯白底 #FFFFFF + 左侧 #FF453A 竖条 + 同色矢量定位针 + 深墨字 #16070B，超长场地自动 2 行完整展示
    expect(
      mock.fillRects.some(
        (r) => r.x === 0 && r.y === 684 && r.w === MATCH_SHARE_CARD_WIDTH && r.h === 116 && r.fillStyle === "#FFFFFF",
      ),
    ).toEqual(true);
    expect(
      mock.fillRects.some((r) => r.x === 0 && r.y === 684 && r.w === 18 && r.h === 116 && r.fillStyle === "#FF453A"),
    ).toEqual(true);
    const venueDraws = mock.texts.filter((t) => t.y >= 684);
    expect(venueDraws.length).toEqual(2);
    expect(venueDraws.every((t) => t.fillStyle === "#16070B")).toEqual(true);
    expect(mock.arcs.filter((a) => a.y >= 684).length).toEqual(2);
    const combinedVenue = venueDraws.map((t) => t.value).join("");
    expect(combinedVenue).toEqual("北京市朝阳区奥林匹克森林公园南园综合体育中心足球场A区标准11人制3号场地东侧入口");
    expect(combinedVenue.includes("📍")).toEqual(false);
    expect(combinedVenue.includes("…")).toEqual(false);
  } finally {
    (globalThis as unknown as { uni?: typeof uni }).uni = previousUni;
  }
});

test("composeMatchShareCard overlays customBgImageUrl with dark crimson veil and gracefully degrades on download failure", async () => {
  const previousUni = (globalThis as unknown as { uni?: typeof uni }).uni;
  const customRun = createMockCanvasContext({
    withRadialGradient: true,
    withStrokeText: true,
    tempFilePath: "/tmp/custom-bg-card.jpg",
  });
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
      if (src.includes("custom-ok")) {
        success({ path: `local://${src}`, width: 1600, height: 900 });
      } else {
        fail(new Error("download failed"));
      }
    },
    createSelectorQuery: customRun.createSelectorQuery,
  } as unknown as typeof uni;

  try {
    // 1. 自定义背景图下载成功：通过 canvas.createImage() 载入后 cover 铺底 + 深红黑暗幕 + 渐变暗角 + 射灯，不画 MATCHDAY 水印
    const okPath = await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      {
        name: "自定义背景夜场赛",
        homeTeamLabel: "洺悦御府",
        opponentLabel: "朝阳联队",
        customBgImageUrl: "https://cdn.example.com/custom-ok.jpg",
        startTime: "2026-11-22T11:00:00Z",
        endTime: "2026-11-22T13:00:00Z",
      },
      [],
      () => true,
    );
    expect(okPath).toEqual("/tmp/custom-bg-card.jpg");
    expect(requested).toEqual(["https://cdn.example.com/custom-ok.jpg"]);
    expect(customRun.images.length).toEqual(1);
    expect((customRun.images[0]?.[0] as { src?: string })?.src).toEqual("local://https://cdn.example.com/custom-ok.jpg");
    // 1600x900 按 cover 铺满 1000x800：scale = 800/900，drawWidth ≈ 1422.22，水平居中裁切
    expectClose(Number(customRun.images[0]?.[3]), (1600 * 800) / 900, 0.01);
    expectClose(Number(customRun.images[0]?.[4]), 800, 0.01);
    expect(customRun.fillRects.some((r) => r.fillStyle === "rgba(18, 7, 11, 0.62)")).toEqual(true);
    expect(customRun.strokeTexts.some((t) => t.value === "MATCHDAY")).toEqual(false);
    // 未设置球服时，双方均显示「队服待定」且不画任何矢量图标
    expect(customRun.scales.length).toEqual(0);
    expect(customRun.texts.filter((t) => t.value === "队服待定").length).toEqual(2);

    // 2. 自定义背景图下载失败：无感降级回默认 C2 红黑射灯底（即使运行时缺 createRadialGradient / strokeText 也正常渲染）
    requested.length = 0;
    const degradedRun = createMockCanvasContext({
      withRadialGradient: false,
      withStrokeText: false,
      tempFilePath: "/tmp/custom-bg-card.jpg",
    });
    (globalThis as unknown as { uni: typeof uni }).uni.createSelectorQuery =
      degradedRun.createSelectorQuery as unknown as typeof uni.createSelectorQuery;

    const loader = createMatchShareImageLoader();
    const degradedPath = await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      {
        name: "降级红黑底测试",
        homeTeamLabel: "甲队",
        opponentLabel: "乙队",
        homeTeamColor: "#EF4444",
        homeShortsColor: "#FFFFFF",
        customBgImageUrl: "https://cdn.example.com/broken-custom.jpg",
      },
      [],
      () => true,
      loader.load,
    );
    loader.clear();

    expect(degradedPath).toEqual("/tmp/custom-bg-card.jpg");
    expect(requested).toEqual(["https://cdn.example.com/broken-custom.jpg"]);
    expect(degradedRun.images.length).toEqual(0);
    expect(degradedRun.radialGradients.length).toEqual(0);
    // 缺 createRadialGradient 时退化为 createLinearGradient（底色 1 + 左右射灯 2 = 3）
    expect(degradedRun.linearGradients.length).toEqual(3);
    // 缺 strokeText 时回退 fillText 绘制 MATCHDAY
    expect(degradedRun.texts.some((t) => t.value === "MATCHDAY")).toEqual(true);
    expect(degradedRun.scales.length).toEqual(2);
    expect(degradedRun.texts.some((t) => t.value === "红衣 · 白裤")).toEqual(true);
    expect(degradedRun.texts.some((t) => t.value === "队服待定")).toEqual(true);
  } finally {
    (globalThis as unknown as { uni?: typeof uni }).uni = previousUni;
  }
});

test("composeMatchShareCard renders pickup match headline layout with/without kit and aborts when stale", async () => {
  const previousUni = (globalThis as unknown as { uni?: typeof uni }).uni;
  const pickupWithKit = createMockCanvasContext({ tempFilePath: "/tmp/pickup-card.jpg" });

  (globalThis as unknown as { uni: typeof uni }).uni = {
    getImageInfo: () => {
      throw new Error("unexpected getImageInfo");
    },
    createSelectorQuery: pickupWithKit.createSelectorQuery,
  } as unknown as typeof uni;

  try {
    // 散人约球（有球服配置）：展示通栏大字卡 + 人制散人标签 + 装备图标，不出现 VS
    const path1 = await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      {
        name: "工人体育场周三夜场散人局",
        matchKindLabel: "散人约球",
        isPickupMatch: true,
        playersPerTeam: 8,
        homeTeamColor: "#FFFFFF",
        homeShortsColor: "#111310",
        startTime: "2026-11-25T11:30:00Z",
        endTime: "2026-11-25T13:30:00Z",
        location: "工人体育场副场",
      },
      [],
      () => true,
    );
    expect(path1).toEqual("/tmp/pickup-card.jpg");
    const rendered1 = pickupWithKit.texts.map((t) => t.value);
    expect(rendered1.includes("工人体育场周三夜场散人局")).toEqual(true);
    expect(rendered1.includes("8人制 · 散人约球 · 欢迎报名")).toEqual(true);
    expect(rendered1.includes("白衣 · 黑裤")).toEqual(true);
    expect(rendered1.includes("VS")).toEqual(false);
    expect(pickupWithKit.scales.length).toEqual(2);

    // 散人约球（未配置球服）：不画空图标，显示「队服待定」
    const pickupNoKit = createMockCanvasContext({ tempFilePath: "/tmp/pickup-card.jpg" });
    (globalThis as unknown as { uni: typeof uni }).uni.createSelectorQuery =
      pickupNoKit.createSelectorQuery as unknown as typeof uni.createSelectorQuery;
    await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      {
        name: "周五晚散人快乐局",
        matchKindLabel: "散人约球",
        isPickupMatch: true,
        playersPerTeam: 7,
        startTime: "2026-11-27T12:00:00Z",
        location: "朝阳公园足球场",
      },
      [],
      () => true,
    );
    expect(pickupNoKit.scales.length).toEqual(0);
    expect(pickupNoKit.texts.some((t) => t.value === "队服待定")).toEqual(true);
    expect(pickupNoKit.texts.some((t) => t.value === "7人制 · 散人约球 · 欢迎报名")).toEqual(true);

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

test("formatRegistrationStatusBadge and collectRegistrationAvatarUrls handle all thresholds and deduplicate", () => {
  expect(formatRegistrationStatusBadge(0, 8)).toEqual({
    text: "0/8 · 抢先报名",
    accentColor: "#FFD166",
    pillBg: "rgba(255, 209, 102, 0.16)",
    ratio: 0,
  });
  expect(formatRegistrationStatusBadge(6, 8)).toEqual({
    text: "已报 6/8 · 差 2 人",
    accentColor: "#FFD166",
    pillBg: "rgba(255, 209, 102, 0.18)",
    ratio: 0.75,
  });
  expect(formatRegistrationStatusBadge(9, 8)).toEqual({
    text: "已报 9/8 · 已成行",
    accentColor: "#00EBC7",
    pillBg: "rgba(0, 235, 199, 0.16)",
    ratio: 1,
  });
  expect(formatRegistrationStatusBadge(5, null).text).toEqual("已报 5 人");
  expect(formatRegistrationStatusBadge(0, null).text).toEqual("火热报名中");

  const urls = collectRegistrationAvatarUrls({
    mode: "dual",
    home: {
      joinedCount: 3,
      requiredCount: 8,
      avatars: [
        { name: "张三", avatarUrl: "https://cdn.example.com/a.jpg" },
        { name: "李四", avatarUrl: "https://cdn.example.com/a.jpg" },
        { name: "王五", avatarUrl: "" },
      ],
    },
    away: {
      joinedCount: 2,
      requiredCount: 8,
      avatars: [
        { name: "赵六", avatarUrl: "https://cdn.example.com/b.jpg" },
        { name: "钱七", avatarUrl: "https://cdn.example.com/a.jpg" },
      ],
    },
  });
  expect(urls).toEqual(["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]);
});

test("composeMatchShareCard renders Plan A registration strip for single, empty, dual and headline modes", async () => {
  const previousUni = (globalThis as unknown as { uni?: typeof uni }).uni;
  const requested: string[] = [];

  const installUniMock = (mock: ReturnType<typeof createMockCanvasContext>) => {
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
        if (src.includes("broken")) {
          fail(new Error("avatar download failed"));
        } else {
          success({ path: `local://${src}`, width: 200, height: 200 });
        }
      },
      createSelectorQuery: mock.createSelectorQuery,
    } as unknown as typeof uni;
  };

  try {
    // 1. 单队报名：已报 18/8（已去掉右侧「已报」胶囊，整条可展示 16 个大头像 +「+2」+ 底部进度条），且含 1 个下载失败头像优雅回退首字圆圈
    const singleMock = createMockCanvasContext({ tempFilePath: "/tmp/reg-single.jpg" });
    installUniMock(singleMock);
    const singleAvatars = Array.from({ length: 18 }, (_, idx) => ({
      name: idx === 1 ? "小明" : `球员${idx + 1}`,
      avatarUrl: idx === 1 ? "https://cdn.example.com/broken.jpg" : `https://cdn.example.com/u${idx + 1}.jpg`,
      tone: "#2563EB",
    }));
    const singlePath = await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      {
        name: "周四友谊赛",
        matchKindLabel: "线下已约",
        homeTeamLabel: "洺悦御府",
        opponentLabel: "河西周四 FC",
        homeTeamColor: "#FFFFFF",
        awayTeamColor: "#EF4444",
        startTime: "2026-11-26T12:00:00Z",
        endTime: "2026-11-26T14:00:00Z",
        location: "悦享运动公园",
        playersPerTeam: 8,
        registration: {
          mode: "single",
          group: {
            joinedCount: 18,
            requiredCount: 8,
            avatars: singleAvatars,
          },
        },
      },
      [],
      () => true,
    );
    expect(singlePath).toEqual("/tmp/reg-single.jpg");
    const singleTexts = singleMock.texts.map((t) => t.value);
    // 已彻底去掉右侧「已报」状态胶囊
    expect(singleTexts.some((t) => t.includes("已报 18/8"))).toEqual(false);
    // 下载失败的第 2 位球员回退绘制首字「小」
    expect(singleTexts.includes("小")).toEqual(true);
    // 超出 16 个可见槽位绘制「+2」溢出圆圈
    expect(singleTexts.includes("+2")).toEqual(true);
    // 16 个可见头像中 15 个下载成功并绘制进 canvas
    expect(singleMock.images.length).toEqual(15);
    // 保留底部 6px 成行进度条（#00EBC7）
    expect(
      singleMock.fillRects.some((r) => r.y === 556 + 94 && r.h === 6 && r.fillStyle === "#00EBC7"),
    ).toEqual(true);

    // 2. 单队 0 人报名：无「已报」胶囊，保留虚位以待占位圆、引导文案与底部进度条底槽
    requested.length = 0;
    const emptyMock = createMockCanvasContext({ tempFilePath: "/tmp/reg-empty.jpg" });
    installUniMock(emptyMock);
    await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      {
        name: "周五晚场",
        homeTeamLabel: "洺悦御府",
        opponentLabel: "对手待定",
        playersPerTeam: 8,
        registration: {
          mode: "single",
          group: {
            joinedCount: 0,
            requiredCount: 8,
            avatars: [],
          },
        },
      },
      [],
      () => true,
    );
    expect(requested.length).toEqual(0);
    const emptyTexts = emptyMock.texts.map((t) => t.value);
    expect(emptyTexts.some((t) => t.includes("抢先报名"))).toEqual(false);
    expect(emptyTexts.includes("虚位以待 · 快来抢占首名")).toEqual(true);
    expect(emptyMock.fillRects.some((r) => r.y === 556 + 94 && r.h === 6)).toEqual(true);

    // 3. 线上约队双队模式：左右展示主队与客队进度及各自头像
    requested.length = 0;
    const dualMock = createMockCanvasContext({ tempFilePath: "/tmp/reg-dual.jpg" });
    installUniMock(dualMock);
    await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      {
        name: "周六线上约队",
        matchKindLabel: "线上约队",
        homeTeamLabel: "洺悦御府",
        opponentLabel: "朝阳联队",
        playersPerTeam: 8,
        registration: {
          mode: "dual",
          home: {
            label: "主队",
            joinedCount: 9,
            requiredCount: 8,
            avatars: [
              { name: "张三", avatarUrl: "https://cdn.example.com/h1.jpg" },
              { name: "李四", avatarUrl: "" },
            ],
          },
          away: {
            label: "客队",
            joinedCount: 6,
            requiredCount: 8,
            avatars: [{ name: "王五", avatarUrl: "https://cdn.example.com/a1.jpg" }],
          },
        },
      },
      [],
      () => true,
    );
    const dualTexts = dualMock.texts.map((t) => t.value);
    expect(dualTexts.includes("主队 9/8")).toEqual(true);
    expect(dualTexts.includes("客队 6/8")).toEqual(true);
    expect(dualTexts.includes("李")).toEqual(true);
    expect(dualMock.images.length).toEqual(2);

    // 4. 散人约球大字卡模式：展示报名胶囊、居中大头像排与 +N
    requested.length = 0;
    const pickupMock = createMockCanvasContext({ tempFilePath: "/tmp/reg-pickup.jpg" });
    installUniMock(pickupMock);
    const pickupAvatars = Array.from({ length: 14 }, (_, idx) => ({
      name: `散人${idx + 1}`,
      avatarUrl: `https://cdn.example.com/p${idx + 1}.jpg`,
    }));
    await composeMatchShareCard(
      "match-share-card-canvas",
      {},
      {
        name: "工人体育场周三夜场散人局",
        matchKindLabel: "散人约球",
        isPickupMatch: true,
        playersPerTeam: 8,
        homeTeamColor: "#FFFFFF",
        registration: {
          mode: "single",
          group: {
            joinedCount: 14,
            requiredCount: 16,
            avatars: pickupAvatars,
          },
        },
      },
      [],
      () => true,
    );
    const pickupTexts = pickupMock.texts.map((t) => t.value);
    expect(pickupTexts.includes("已报 14/16 · 差 2 人")).toEqual(true);
    expect(pickupTexts.includes("+3")).toEqual(true);
    // 最多并发拉取前 11 个可见头像，避免超大局拉取多余图片
    expect(requested.length).toEqual(11);
    expect(pickupMock.images.length).toEqual(11);
  } finally {
    (globalThis as unknown as { uni?: typeof uni }).uni = previousUni;
  }
});
