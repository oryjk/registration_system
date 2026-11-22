import type { PitchSlotView } from "@/types/lineup";
import {
  beijingDateParts,
  formatTimeRangeLabel,
  formatWeekdayLabel,
  pad,
} from "@/utils/datetime";
import { resolveMinioImage, retainMinioImage } from "@/utils/minioImageCache";
import { avatarInitial, formatSubBadgeText } from "./helpers";

export const LINEUP_POSTER = {
  canvasId: "lineup-poster-canvas",
  width: 750,
  height: 1280,
} as const;

export const LINEUP_CARD = {
  canvasId: "lineup-card-canvas",
  width: 750,
  height: 600,
} as const;

export interface LineupPosterImageInfo {
  path: string;
  width: number;
  height: number;
}

export interface LineupPosterInput {
  matchId: string;
  matchName: string;
  startTime: string;
  endTime: string;
  location: string;
  playersPerTeam: number;
  formation: string;
  pitchSlots: PitchSlotView[];
}

export interface LineupPosterSubLine {
  slot: number;
  label: string;
  starterName: string;
  subNames: string[];
  text: string;
}

// 装饰性海报画布色板（独立于页面语义 token）
const PALETTE = {
  pageBg: "#f5f7f9",
  paper: "#fffffe",
  ink: "#00214d",
  body: "#1b2d45",
  muted: "#65758b",
  line: "#e4eaf2",
  accent: "#00ebc7",
  accentSoft: "#dcfff8",
  grass: "#237a4b",
  grassAlt: "#298653",
  marking: "rgba(255, 255, 255, 0.5)",
  dotBg: "#fffffe",
  dotEmptyBg: "rgba(255, 255, 255, 0.22)",
  nameBg: "rgba(0, 33, 77, 0.72)",
  subBg: "#fde24f",
  subFg: "#00214d",
} as const;

const getImageInfo = (src: string): Promise<LineupPosterImageInfo> =>
  new Promise((resolve, reject) => uni.getImageInfo({ src, success: resolve, fail: reject }));

/** 页面级图片缓存，复用 MinIO 本地缓存并在页面卸载时释放引用。 */
export function createLineupImageLoader() {
  const images = new Map<string, Promise<LineupPosterImageInfo>>();
  const releases = new Map<string, () => void>();

  function drop(src: string) {
    releases.get(src)?.();
    releases.delete(src);
    images.delete(src);
  }

  return {
    load(src: string): Promise<LineupPosterImageInfo> {
      const cached = images.get(src);
      if (cached) return cached;
      const task = resolveMinioImage(src)
        .then(getImageInfo)
        .catch((error) => {
          if (images.get(src) === task) drop(src);
          throw error;
        });
      if (images.size >= 32) {
        const oldest = images.keys().next().value;
        if (oldest) drop(oldest);
      }
      releases.set(src, retainMinioImage(src));
      images.set(src, task);
      return task;
    },
    clear() {
      for (const src of Array.from(images.keys())) drop(src);
    },
  };
}

/** 格式化比赛时间为北京时间文案（不截取 ISO 字符串）。 */
export function formatLineupMatchTime(startTime: string, endTime: string): string {
  if (!startTime) return "时间待定";
  const parts = beijingDateParts(startTime);
  if (!Number.isFinite(parts.year)) return "时间待定";
  const dateText = `${parts.month}月${parts.day}日 ${formatWeekdayLabel(startTime)}`;
  if (endTime) {
    const endParts = beijingDateParts(endTime);
    if (Number.isFinite(endParts.year)) {
      return `${dateText} ${formatTimeRangeLabel(startTime, endTime)}`;
    }
  }
  return `${dateText} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function buildLineupSharePayload(params: {
  matchId: string;
  matchName: string;
  playersPerTeam: number;
  formation: string;
  imageUrl?: string;
}) {
  const titleName = clippedText(params.matchName.trim() || "本场比赛", 16);
  return {
    title: `${titleName} · ${params.playersPerTeam}人制 ${params.formation} 阵型`,
    path: `/pages/matches/lineup/index?matchId=${encodeURIComponent(params.matchId)}`,
    ...(params.imageUrl ? { imageUrl: params.imageUrl } : {}),
  };
}

export function clippedText(value: string, limit: number): string {
  const chars = Array.from(value.trim());
  if (chars.length <= limit) return chars.join("");
  return `${chars.slice(0, Math.max(1, limit - 1)).join("")}…`;
}

/** 提取海报底部展示的「替补对应」行列表。 */
export function buildPosterSubSummaryLines(
  pitchSlots: PitchSlotView[],
  maxLines = 6,
): LineupPosterSubLine[] {
  const rows = pitchSlots
    .filter((entry) => entry.subs.length > 0)
    .map((entry) => {
      const starterName = entry.starter?.nickname?.trim() || "待定";
      const subNames = entry.subs.map((sub) => sub.nickname?.trim() || `队员${sub.user_id}`);
      return {
        slot: entry.slot,
        label: entry.label,
        starterName,
        subNames,
        text: `[${entry.label}] ${starterName} ⇄ 替补：${subNames.join("、")}`,
      };
    });
  return rows.slice(0, maxLines);
}

/** 计算球员圆点在海报/分享卡球场区域内的像素坐标。 */
export function posterPlayerPoint(x: number, y: number, card = false): { x: number; y: number } {
  const clampedX = Math.max(0.06, Math.min(0.94, Number.isFinite(x) ? x : 0.5));
  const clampedY = Math.max(0.06, Math.min(0.94, Number.isFinite(y) ? y : 0.5));
  if (card) {
    // 分享卡球场区：x=95..655 (w=560), y=108..540 (h=432)，四周留边距防文字裁切
    return {
      x: 95 + 36 + clampedX * (560 - 72),
      y: 108 + 26 + clampedY * (432 - 58),
    };
  }
  // 竖版海报球场区：x=32..718 (w=686), y=194..874 (h=680)
  return {
    x: 32 + 44 + clampedX * (686 - 88),
    y: 194 + 34 + clampedY * (680 - 78),
  };
}

function drawRoundRect(
  ctx: UniApp.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawText(
  ctx: UniApp.CanvasContext,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: "left" | "center" | "right" = "left",
  weight = 400,
) {
  ctx.setFillStyle(color);
  ctx.setTextAlign(align);
  ctx.setTextBaseline("middle");
  ctx.font = `${weight} ${size}px sans-serif`;
  ctx.fillText(value, x, y);
}

function drawPitchField(
  ctx: UniApp.CanvasContext,
  field: { x: number; y: number; w: number; h: number },
  radius: number,
) {
  ctx.save();
  drawRoundRect(ctx, field.x, field.y, field.w, field.h, radius);
  ctx.clip();

  const stripeHeight = field.h / 8;
  for (let i = 0; i < 8; i += 1) {
    ctx.setFillStyle(i % 2 === 1 ? PALETTE.grassAlt : PALETTE.grass);
    ctx.fillRect(field.x, field.y + i * stripeHeight, field.w, stripeHeight + 1);
  }

  const insetX = field.w * 0.03;
  const insetY = field.h * 0.025;
  ctx.setStrokeStyle(PALETTE.marking);
  ctx.setLineWidth(2);
  ctx.strokeRect(field.x + insetX, field.y + insetY, field.w - insetX * 2, field.h - insetY * 2);

  // 中线与中圈
  const midY = field.y + field.h / 2;
  ctx.beginPath();
  ctx.moveTo(field.x + insetX, midY);
  ctx.lineTo(field.x + field.w - insetX, midY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(field.x + field.w / 2, midY, field.w * 0.12, 0, Math.PI * 2);
  ctx.stroke();

  // 上下禁区
  const boxW = field.w * 0.48;
  const boxH = field.h * 0.135;
  const boxX = field.x + (field.w - boxW) / 2;
  ctx.strokeRect(boxX, field.y + insetY, boxW, boxH);
  ctx.strokeRect(boxX, field.y + field.h - insetY - boxH, boxW, boxH);

  ctx.restore();
}

function drawPitchPlayers(
  ctx: UniApp.CanvasContext,
  pitchSlots: PitchSlotView[],
  images: Map<string, LineupPosterImageInfo>,
  card: boolean,
) {
  const radius = card ? 20 : 28;
  const nameFont = card ? 15 : 20;
  const subFont = card ? 12 : 15;

  for (const entry of pitchSlots) {
    const point = posterPlayerPoint(entry.x, entry.y, card);
    const starter = entry.starter;
    const avatar = starter?.avatar_url ? images.get(starter.avatar_url) : undefined;

    // 头像圆点
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.setFillStyle(starter ? PALETTE.dotBg : PALETTE.dotEmptyBg);
    ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
    if (avatar) {
      const side = Math.min(avatar.width, avatar.height);
      ctx.drawImage(
        avatar.path,
        (avatar.width - side) / 2,
        (avatar.height - side) / 2,
        side,
        side,
        point.x - radius,
        point.y - radius,
        radius * 2,
        radius * 2,
      );
    } else if (starter) {
      drawText(ctx, avatarInitial(starter.nickname), point.x, point.y + 1, card ? 18 : 24, PALETTE.ink, "center", 600);
    } else {
      drawText(ctx, "+", point.x, point.y, card ? 22 : 28, PALETTE.paper, "center", 600);
    }
    ctx.restore();

    // 白色外描边
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.setStrokeStyle(starter ? PALETTE.paper : "rgba(255, 255, 255, 0.72)");
    ctx.setLineWidth(card ? 2 : 3);
    ctx.stroke();
    ctx.restore();

    // 姓名胶囊
    const displayName = starter ? clippedText(starter.nickname, card ? 5 : 6) : entry.label;
    const nameWidth = Math.max(card ? 52 : 68, Array.from(displayName).length * nameFont + (card ? 14 : 18));
    const nameHeight = card ? 22 : 28;
    const nameY = point.y + radius + (card ? 5 : 7);
    ctx.setFillStyle(PALETTE.nameBg);
    drawRoundRect(ctx, point.x - nameWidth / 2, nameY, nameWidth, nameHeight, nameHeight / 2);
    ctx.fill();
    drawText(ctx, displayName, point.x, nameY + nameHeight / 2, nameFont, PALETTE.paper, "center", 600);

    // 替补小标
    if (entry.subs.length > 0) {
      const subLabel = formatSubBadgeText(entry.subs);
      const subWidth = Math.max(card ? 44 : 58, Array.from(subLabel).length * subFont + (card ? 12 : 16));
      const subHeight = card ? 18 : 22;
      const subY = nameY + nameHeight + (card ? 3 : 4);
      ctx.setFillStyle(PALETTE.subBg);
      drawRoundRect(ctx, point.x - subWidth / 2, subY, subWidth, subHeight, subHeight / 2);
      ctx.fill();
      drawText(ctx, subLabel, point.x, subY + subHeight / 2, subFont, PALETTE.subFg, "center", 600);
    }
  }
}

export function drawLineupPoster(
  ctx: UniApp.CanvasContext,
  input: LineupPosterInput,
  images: Map<string, LineupPosterImageInfo>,
  codeImage: LineupPosterImageInfo | null,
  kind: "poster" | "card",
): void {
  const isCard = kind === "card";
  const width = isCard ? LINEUP_CARD.width : LINEUP_POSTER.width;
  const height = isCard ? LINEUP_CARD.height : LINEUP_POSTER.height;
  const formationTag = `${input.playersPerTeam}人制 · ${input.formation}`;
  const timeText = formatLineupMatchTime(input.startTime, input.endTime);

  // 背景底色
  ctx.setFillStyle(PALETTE.pageBg);
  ctx.fillRect(0, 0, width, height);

  if (isCard) {
    // 5:4 微信分享卡片
    ctx.setFillStyle(PALETTE.paper);
    ctx.fillRect(0, 0, width, 96);

    drawText(ctx, clippedText(input.matchName || "比赛阵型", 16), 28, 36, 30, PALETTE.ink, "left", 600);
    drawText(ctx, clippedText(`${timeText}${input.location ? ` · ${input.location}` : ""}`, 34), 28, 72, 20, PALETTE.muted, "left", 400);

    // 右上阵型胶囊
    const badgeW = Math.max(150, Array.from(formationTag).length * 18 + 26);
    ctx.setFillStyle(PALETTE.accent);
    drawRoundRect(ctx, width - 28 - badgeW, 18, badgeW, 42, 21);
    ctx.fill();
    drawText(ctx, formationTag, width - 28 - badgeW / 2, 39, 22, PALETTE.ink, "center", 600);

    const field = { x: 95, y: 108, w: 560, h: 432 };
    drawPitchField(ctx, field, 20);
    drawPitchPlayers(ctx, input.pitchSlots, images, true);

    // 底部汇总条
    const starterCount = input.pitchSlots.filter((s) => s.starter !== null).length;
    const subCount = input.pitchSlots.reduce((sum, s) => sum + s.subs.length, 0);
    const footerCopy = `首发 ${starterCount}/${input.playersPerTeam} · 替补 ${subCount} 人 · 点击查看完整阵型与替补对应`;
    drawText(ctx, footerCopy, width / 2, 572, 21, PALETTE.body, "center", 600);
    return;
  }

  // 竖版海报 750 x 1280
  ctx.setFillStyle(PALETTE.paper);
  drawRoundRect(ctx, 24, 24, 702, 152, 24);
  ctx.fill();

  // 顶部比赛信息
  drawText(ctx, clippedText(input.matchName || "比赛阵型", 16), 48, 66, 34, PALETTE.ink, "left", 600);
  drawText(ctx, clippedText(timeText, 30), 48, 112, 22, PALETTE.body, "left", 400);
  drawText(ctx, clippedText(input.location || "场地待定", 24), 48, 146, 22, PALETTE.muted, "left", 400);

  // 右上阵型标签
  const tagW = Math.max(176, Array.from(formationTag).length * 20 + 28);
  ctx.setFillStyle(PALETTE.accent);
  drawRoundRect(ctx, 702 - tagW, 46, tagW, 46, 23);
  ctx.fill();
  drawText(ctx, formationTag, 702 - tagW / 2, 69, 24, PALETTE.ink, "center", 600);

  // 球场
  const field = { x: 32, y: 194, w: 686, h: 680 };
  drawPitchField(ctx, field, 24);
  drawPitchPlayers(ctx, input.pitchSlots, images, false);

  // 底部「替补对应」与小程序码区
  ctx.setFillStyle(PALETTE.paper);
  drawRoundRect(ctx, 24, 892, 702, 364, 24);
  ctx.fill();

  const hasCode = Boolean(codeImage);
  const textLimit = hasCode ? 20 : 32;
  const subLines = buildPosterSubSummaryLines(input.pitchSlots, 6);
  const totalWithSubs = input.pitchSlots.filter((s) => s.subs.length > 0).length;
  const starterCount = input.pitchSlots.filter((s) => s.starter !== null).length;
  const totalSubs = input.pitchSlots.reduce((sum, s) => sum + s.subs.length, 0);

  drawText(ctx, "替补对应与人员安排", 48, 932, 28, PALETTE.ink, "left", 600);
  drawText(
    ctx,
    `已安排首发 ${starterCount}/${input.playersPerTeam} 人 · 替补 ${totalSubs} 人`,
    48,
    968,
    21,
    PALETTE.muted,
    "left",
    400,
  );

  if (subLines.length > 0) {
    subLines.forEach((line, index) => {
      const rowY = 1012 + index * 36;
      drawText(ctx, clippedText(line.text, textLimit), 48, rowY, 22, PALETTE.body, "left", 500);
    });
    if (totalWithSubs > subLines.length) {
      drawText(
        ctx,
        `另有 ${totalWithSubs - subLines.length} 个位置已指定替补，打开小程序查看全部`,
        48,
        1012 + subLines.length * 36,
        20,
        PALETTE.muted,
        "left",
        400,
      );
    }
  } else {
    drawText(ctx, "本场暂未指定位置替补", 48, 1026, 23, PALETTE.muted, "left", 400);
    drawText(ctx, "所有位置首发已就绪，点击或扫码查看实时阵型", 48, 1068, 21, PALETTE.muted, "left", 400);
  }

  // 右侧小程序码（有则画，无则优雅降级不阻断）
  if (codeImage) {
    const boxSize = 180;
    const boxX = 702 - boxSize;
    const boxY = 936;
    ctx.setFillStyle(PALETTE.paper);
    ctx.setStrokeStyle(PALETTE.line);
    ctx.setLineWidth(2);
    drawRoundRect(ctx, boxX, boxY, boxSize, boxSize, 18);
    ctx.fill();
    ctx.stroke();
    ctx.drawImage(codeImage.path, boxX + 12, boxY + 12, boxSize - 24, boxSize - 24);
    drawText(ctx, "微信扫码看阵型", boxX + boxSize / 2, boxY + boxSize + 24, 20, PALETTE.muted, "center", 500);
  } else {
    drawText(ctx, "微信内打开可随时查看最新排阵", 48, 1226, 20, PALETTE.muted, "left", 400);
  }
}

/** 合成竖版海报或 5:4 分享图，返回临时文件路径。 */
export async function composeLineupImage(
  canvasId: string,
  pageInstance: unknown,
  input: LineupPosterInput,
  kind: "poster" | "card",
  miniCodeUrl: string | null,
  isCurrent: () => boolean,
  loadImage: (src: string) => Promise<LineupPosterImageInfo> = getImageInfo,
): Promise<string> {
  if (!isCurrent()) throw new Error("阵型内容已更新");

  const avatarUrls = Array.from(
    new Set(
      input.pitchSlots
        .map((entry) => entry.starter?.avatar_url)
        .filter((url): url is string => Boolean(url && url.trim())),
    ),
  );

  const [loadedAvatars, codeImage] = await Promise.all([
    Promise.all(
      avatarUrls.map(async (url) => {
        try {
          const info = await loadImage(url);
          return [url, info] as const;
        } catch {
          return null;
        }
      }),
    ),
    kind === "poster" && miniCodeUrl ? loadImage(miniCodeUrl).catch(() => null) : Promise.resolve(null),
  ]);

  if (!isCurrent()) throw new Error("阵型内容已更新");

  const images = new Map<string, LineupPosterImageInfo>();
  for (const pair of loadedAvatars) {
    if (pair) images.set(pair[0], pair[1]);
  }

  const spec = kind === "poster" ? LINEUP_POSTER : LINEUP_CARD;
  const ctx = uni.createCanvasContext(canvasId, pageInstance as never);
  drawLineupPoster(ctx, input, images, codeImage, kind);

  return new Promise<string>((resolve, reject) => {
    ctx.draw(false, () => {
      if (!isCurrent()) {
        reject(new Error("阵型内容已更新"));
        return;
      }
      uni.canvasToTempFilePath(
        {
          canvasId,
          x: 0,
          y: 0,
          width: spec.width,
          height: spec.height,
          destWidth: spec.width,
          destHeight: spec.height,
          fileType: "jpg",
          quality: 0.92,
          success: (res) => {
            if (!isCurrent()) {
              reject(new Error("阵型内容已更新"));
              return;
            }
            resolve(res.tempFilePath);
          },
          fail: reject,
        },
        pageInstance as never,
      );
    });
  });
}
