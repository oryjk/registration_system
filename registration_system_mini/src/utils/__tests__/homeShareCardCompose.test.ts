import { expect, test } from "bun:test";
import {
  HOME_SHARE_CARD_HEIGHT,
  HOME_SHARE_CARD_WIDTH,
  buildHomeShareCardViewModel,
  buildHomeShareTitle,
  collectHomeShareImageUrls,
  composeHomeShareCard,
} from "@/utils/homeShareCardCompose";

function createMockHomeCanvas(tempFilePath = "/tmp/home-share-a.jpg") {
  const texts: Array<{ value: string; x: number; y: number; fillStyle: unknown }> = [];
  const images: unknown[][] = [];
  const fillRects: Array<{ x: number; y: number; w: number; h: number; fillStyle: unknown }> = [];
  let exportOptions: Record<string, unknown> | undefined;

  const ctx: Record<string, unknown> = {
    font: "normal bold 32px sans-serif",
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    lineJoin: "miter",
    lineCap: "butt",
    textAlign: "left",
    textBaseline: "middle",
    clearRect: () => undefined,
    fillRect: (x: number, y: number, w: number, h: number) => {
      fillRects.push({ x, y, w, h, fillStyle: ctx.fillStyle });
    },
    strokeRect: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    quadraticCurveTo: () => undefined,
    arc: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    clip: () => undefined,
    setLineDash: () => undefined,
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    measureText: (value: string) => {
      const match = /(\d+)px/.exec(String(ctx.font));
      const size = match ? Number(match[1]) : 32;
      return { width: Array.from(value).length * size };
    },
    fillText: (value: string, x: number, y: number) => {
      texts.push({ value, x, y, fillStyle: ctx.fillStyle });
    },
    strokeText: () => undefined,
    drawImage: (...args: unknown[]) => {
      images.push(args);
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
        width: 240,
        height: 240,
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
    canvas,
    createSelectorQuery,
    texts,
    images,
    fillRects,
    getExportOptions: () => exportOptions,
  };
}

test("buildHomeShareTitle and buildHomeShareCardViewModel adapt to team+match, team-idle and guest states", () => {
  expect(
    buildHomeShareTitle({
      inviterName: "最灵活的胖纸",
      teamName: "洺悦御府",
      nextMatch: { title: "周四友谊赛", joinedPlayers: 12, avatars: [] },
    }),
  ).toEqual("最灵活的胖纸邀你踢球：洺悦御府即将开踢，等你上场！");

  expect(
    buildHomeShareTitle({
      inviterName: "最灵活的胖纸",
      teamName: "洺悦御府",
    }),
  ).toEqual("最灵活的胖纸邀你一起踢球 · 洺悦御府");

  expect(buildHomeShareTitle({})).toEqual("周末去哪踢？组队、报名、排阵型，拉上球友直接开踢！");

  const teamWithMatch = buildHomeShareCardViewModel({
    inviterName: "最灵活的胖纸",
    teamName: "洺悦御府",
    teamLogoUrl: "https://cdn.example.com/logo.png",
    teamMemberCount: 24,
    teamCreditScore: 100,
    upcomingMatchCount: 2,
    nextMatch: {
      title: "周四友谊赛",
      dateLabel: "周四 20:00",
      venue: "悦享运动公园",
      joinedPlayers: 14,
      avatars: [
        { name: "东东", avatarUrl: "https://cdn.example.com/u1.png" },
        { name: "杰哥", avatarUrl: "https://cdn.example.com/logo.png" },
      ],
    },
  });
  expect(teamWithMatch.mode).toEqual("team-next-match");
  expect(teamWithMatch.ribbonText).toEqual("最灵活的胖纸 · 邀你一起上场踢球");
  expect(teamWithMatch.memberPillText).toEqual("24 位球友在队");
  expect(teamWithMatch.schedulePillText).toEqual("近期 2 场约战待踢");
  expect(teamWithMatch.creditBadgeText).toEqual("信誉 100分");
  expect(teamWithMatch.nextMatchKicker).toEqual("下场开踢 · 周四 20:00");
  expect(teamWithMatch.nextMatchHeadline).toEqual("周四友谊赛 · 悦享运动公园");
  expect(teamWithMatch.nextMatchJoinedLabel).toEqual("已报 14 人");
  expect(collectHomeShareImageUrls(teamWithMatch)).toEqual([
    "https://cdn.example.com/logo.png",
    "https://cdn.example.com/u1.png",
  ]);

  const teamIdle = buildHomeShareCardViewModel({
    teamName: "朝阳联队",
    teamMemberCount: 16,
  });
  expect(teamIdle.mode).toEqual("team-idle");
  expect(teamIdle.ribbonText).toEqual("球队召集令 · 邀你一起上场踢球");

  const brand = buildHomeShareCardViewModel({});
  expect(brand.mode).toEqual("brand");
  expect(brand.ribbonText).toEqual("约球开踢 · 你的球友都在这");
});

test("composeHomeShareCard renders Plan A across all three modes with graceful image fallbacks", async () => {
  const previousUni = (globalThis as unknown as { uni?: typeof uni }).uni;
  const requested: string[] = [];

  const installUniMock = (mock: ReturnType<typeof createMockHomeCanvas>) => {
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
          fail(new Error("image failed"));
        } else {
          success({ path: `local://${src}`, width: 240, height: 240 });
        }
      },
      createSelectorQuery: mock.createSelectorQuery,
    } as unknown as typeof uni;
  };

  try {
    // 1. 有球队 + 下场赛程：队徽 + 10 个大头像（含 1 个失败回退首字）+「+4」+ 纯白行动底栏
    const activeMock = createMockHomeCanvas("/tmp/home-active.jpg");
    installUniMock(activeMock);
    const avatars = Array.from({ length: 14 }, (_, idx) => ({
      name: idx === 0 ? "东东" : `球友${idx + 1}`,
      avatarUrl: idx === 0 ? "https://cdn.example.com/broken.jpg" : `https://cdn.example.com/a${idx + 1}.jpg`,
    }));
    const activePath = await composeHomeShareCard(
      "home-share-card-canvas",
      {},
      {
        inviterName: "最灵活的胖纸",
        teamName: "洺悦御府",
        teamLogoUrl: "https://cdn.example.com/logo.jpg",
        teamMemberCount: 24,
        teamCreditScore: 100,
        upcomingMatchCount: 2,
        nextMatch: {
          title: "周四友谊赛",
          dateLabel: "周四 20:00",
          venue: "悦享运动公园",
          joinedPlayers: 14,
          avatars,
        },
      },
      () => true,
    );
    expect(activePath).toEqual("/tmp/home-active.jpg");
    expect([activeMock.canvas.width, activeMock.canvas.height]).toEqual([
      HOME_SHARE_CARD_WIDTH,
      HOME_SHARE_CARD_HEIGHT,
    ]);
    const activeTexts = activeMock.texts.map((t) => t.value);
    expect(activeTexts.includes("洺悦御府")).toEqual(true);
    expect(activeTexts.includes("24 位球友在队")).toEqual(true);
    expect(activeTexts.includes("已报 14 人")).toEqual(true);
    expect(activeTexts.includes("东")).toEqual(true);
    expect(activeTexts.includes("+4")).toEqual(true);
    expect(activeTexts.includes("点击加入球局 · 一键报名 / 排阵 / 约队")).toEqual(true);
    // 队徽 1 张 + 前 10 头像中 9 张成功 = 10 张图
    expect(activeMock.images.length).toEqual(10);
    expect(activeMock.fillRects.some((r) => r.y === 684 && r.h === 116 && r.fillStyle === "#FFFFFF")).toEqual(true);

    // 2. 有球队无赛程：展示球队铭牌 + 4 项俱乐部能力卡
    requested.length = 0;
    const idleMock = createMockHomeCanvas("/tmp/home-idle.jpg");
    installUniMock(idleMock);
    await composeHomeShareCard(
      "home-share-card-canvas",
      {},
      {
        teamName: "朝阳联队",
        teamMemberCount: 18,
      },
      () => true,
    );
    expect(requested.length).toEqual(0);
    const idleTexts = idleMock.texts.map((t) => t.value);
    expect(idleTexts.includes("朝阳联队")).toEqual(true);
    expect(idleTexts.includes("一键报名统计")).toEqual(true);
    expect(idleTexts.includes("可视化排阵型")).toEqual(true);

    // 3. 游客/无球队兜底态：展示品牌拉新主视觉，无需下载任何远端图片
    requested.length = 0;
    const guestMock = createMockHomeCanvas("/tmp/home-guest.jpg");
    installUniMock(guestMock);
    await composeHomeShareCard("home-share-card-canvas", {}, {}, () => true);
    expect(requested.length).toEqual(0);
    const guestTexts = guestMock.texts.map((t) => t.value);
    expect(guestTexts.includes("周末去哪踢？")).toEqual(true);
    expect(guestTexts.includes("点击开启绿茵之旅 · 找球队 / 找球局")).toEqual(true);

    // 4. 版本过期立即中止
    let aborted = "";
    try {
      await composeHomeShareCard("home-share-card-canvas", {}, {}, () => false);
    } catch (err) {
      aborted = err instanceof Error ? err.message : String(err);
    }
    expect(aborted).toEqual("首页分享卡内容已更新");
  } finally {
    (globalThis as unknown as { uni?: typeof uni }).uni = previousUni;
  }
});
