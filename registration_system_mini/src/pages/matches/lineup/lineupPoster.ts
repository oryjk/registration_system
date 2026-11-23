import type { PitchSlotView } from "@/types/lineup";
import {
  beijingDateParts,
  formatTimeRangeLabel,
  formatWeekdayLabel,
  pad,
} from "@/utils/datetime";
import {
  MATCH_SHARE_CARD_HEIGHT,
  MATCH_SHARE_CARD_WIDTH,
  drawLocationPinIcon,
  drawMatchShareBackdrop,
  drawMatchShareSlash,
  drawMatchShareText,
  exportCanvas2DToTempFile,
  fitText,
  loadCanvas2DImage,
  measureMatchShareTextWidth,
  queryCanvas2DNode,
  wrapTextLines,
  type MatchShareCanvasImage,
  type ResolvedCanvasBackdrop,
} from "@/utils/matchShareCardCompose";
import { resolveMinioImage, retainMinioImage } from "@/utils/minioImageCache";
import { avatarInitial, formatSubBadgeText } from "./helpers";

export const LINEUP_CARD = {
  canvasId: "lineup-card-canvas",
  width: MATCH_SHARE_CARD_WIDTH,
  height: MATCH_SHARE_CARD_HEIGHT,
} as const;

export interface LineupPosterImageInfo {
  path: string;
  width: number;
  height: number;
}

export interface LineupPosterInput {
  matchId: string;
  matchName: string;
  hostTeamName?: string;
  opponentName?: string;
  startTime: string;
  endTime: string;
  location: string;
  playersPerTeam: number;
  formation: string;
  pitchSlots: PitchSlotView[];
  /** 自定义上传的球队分享背景图 URL（球队会员功能）；为空时走默认 C2 红黑射灯底。 */
  customBgImageUrl?: string | null;
}

export interface LineupPosterSubLine {
  slot: number;
  label: string;
  starterName: string;
  subNames: string[];
  text: string;
}

interface LoadedCanvasAvatar {
  image: MatchShareCanvasImage;
  width: number;
  height: number;
}

// C2 比赛日阵型分享卡右侧战术球场几何参数（1000×800 画布内）
const PITCH_RECT = {
  x: 456,
  y: 114,
  w: 504,
  h: 550,
} as const;

// 装饰性海报画布色板（与 C2 比赛分享卡视觉语言统一）
const CARD_PALETTE = {
  slashRed: "#FF453A",
  accentOrange: "#FF8A3D",
  dividerOrange: "#FF6B35",
  goldLabel: "#FFD166",
  white: "#FFFFFF",
  ink: "#16070B",
  panelBg: "rgba(12, 6, 10, 0.62)",
  panelBorder: "rgba(255, 255, 255, 0.14)",
  grass: "#1B6B42",
  grassAlt: "#217A4C",
  pitchBorder: "rgba(255, 255, 255, 0.24)",
  marking: "rgba(255, 255, 255, 0.48)",
  dotBg: "#FFFFFF",
  dotEmptyBg: "rgba(255, 255, 255, 0.20)",
  nameBg: "rgba(12, 6, 10, 0.86)",
  subBg: "#FFD166",
  subFg: "#16070B",
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
    evict(src: string) {
      const normalized = src.trim();
      if (normalized) drop(normalized);
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

/** 提取左侧战术摘要卡展示的「替补对应」行列表。 */
export function buildPosterSubSummaryLines(
  pitchSlots: PitchSlotView[],
  maxLines = 4,
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
        text: `[${entry.label}] ${starterName} ⇄ ${subNames.join("、")}`,
      };
    });
  return rows.slice(0, maxLines);
}

/** 计算球员圆点在 1000×800 C2 阵型分享卡右侧战术球场内的像素坐标。 */
export function posterPlayerPoint(x: number, y: number): { x: number; y: number } {
  const clampedX = Math.max(0.06, Math.min(0.94, Number.isFinite(x) ? x : 0.5));
  const clampedY = Math.max(0.06, Math.min(0.94, Number.isFinite(y) ? y : 0.5));
  const padX = 44;
  const padTop = 36;
  const padBottom = 56;
  return {
    x: PITCH_RECT.x + padX + clampedX * (PITCH_RECT.w - padX * 2),
    y: PITCH_RECT.y + padTop + clampedY * (PITCH_RECT.h - padTop - padBottom),
  };
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
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

function drawTopTimeBanner(ctx: CanvasRenderingContext2D, startTime: string, endTime: string) {
  const timeText = formatLineupMatchTime(startTime, endTime);
  drawMatchShareSlash(ctx, 118, 26, 764, 68, 22, CARD_PALETTE.slashRed);
  const fittedTime = fitText(ctx, timeText, 710, 38, 26, 900);
  drawMatchShareText(ctx, fittedTime.text, 511, 61, fittedTime.size, CARD_PALETTE.white, "center", 900);
}

function drawLeftTacticalCard(ctx: CanvasRenderingContext2D, input: LineupPosterInput) {
  const cardX = 40;
  const cardY = 114;
  const cardW = 396;
  const cardH = 550;
  const contentX = cardX + 34;
  const contentW = cardW - 56;

  // 深红黑通透战术信息卡片 + 左侧火焰橙能量条
  ctx.save();
  ctx.fillStyle = CARD_PALETTE.panelBg;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.fillStyle = CARD_PALETTE.accentOrange;
  ctx.fillRect(cardX, cardY, 12, cardH);
  ctx.strokeStyle = CARD_PALETTE.panelBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(cardX, cardY, cardW, cardH);
  ctx.restore();

  // 顶部角色标签
  drawMatchShareText(ctx, "STARTING LINEUP · 首发阵型", contentX, cardY + 38, 20, CARD_PALETTE.goldLabel, "left", 800);

  // 比赛/球队主标题（最多 2 行，大号粗黑字体）
  const headline = input.matchName?.trim() || input.hostTeamName?.trim() || "本场首发阵型";
  const singleTitle = fitText(ctx, headline, contentW, 44, 34, 900);
  let nextY = cardY + 114;
  if (!singleTitle.text.endsWith("…")) {
    drawMatchShareText(ctx, singleTitle.text, contentX, cardY + 100, singleTitle.size, CARD_PALETTE.white, "left", 900);
    nextY = cardY + 148;
  } else {
    const titleLines = wrapTextLines(
      headline,
      contentW,
      (text) => measureMatchShareTextWidth(ctx, text, 34, 900),
      2,
    );
    drawMatchShareText(ctx, titleLines[0] || headline, contentX, cardY + 90, 34, CARD_PALETTE.white, "left", 900);
    if (titleLines[1]) {
      drawMatchShareText(ctx, titleLines[1], contentX, cardY + 134, 34, CARD_PALETTE.white, "left", 900);
      nextY = cardY + 178;
    } else {
      nextY = cardY + 142;
    }
  }

  // 若有主队/对手信息则附一行简洁副标题
  const teamMeta = input.hostTeamName?.trim()
    ? (input.opponentName?.trim() ? `${input.hostTeamName.trim()} vs ${input.opponentName.trim()}` : input.hostTeamName.trim())
    : "";
  if (teamMeta && teamMeta !== headline) {
    const fittedMeta = fitText(ctx, teamMeta, contentW, 22, 18, 700);
    drawMatchShareText(ctx, fittedMeta.text, contentX, nextY, fittedMeta.size, "rgba(255, 255, 255, 0.72)", "left", 700);
    nextY += 34;
  } else {
    nextY += 8;
  }

  // 火焰斜切阵型徽章（如：8人制 · 3-3-1）
  const formationBadge = `${input.playersPerTeam}人制 · ${input.formation}`;
  const badgeW = Math.min(contentW - 12, Math.max(220, measureMatchShareTextWidth(ctx, formationBadge, 28, 900) + 46));
  const badgeH = 54;
  drawMatchShareSlash(ctx, contentX, nextY, badgeW, badgeH, 14, CARD_PALETTE.slashRed);
  drawMatchShareText(
    ctx,
    formationBadge,
    contentX + badgeW / 2 + 7,
    nextY + badgeH / 2 + 1,
    28,
    CARD_PALETTE.white,
    "center",
    900,
  );
  nextY += badgeH + 26;

  // 火焰橙分割线
  ctx.save();
  ctx.fillStyle = CARD_PALETTE.dividerOrange;
  ctx.fillRect(contentX, nextY, contentW, 4);
  ctx.restore();
  nextY += 34;

  // 首发与替补人数汇总
  const starterCount = input.pitchSlots.filter((s) => s.starter !== null).length;
  const subCount = input.pitchSlots.reduce((sum, s) => sum + s.subs.length, 0);
  const starterStat = `首发 ${starterCount}/${input.playersPerTeam}`;
  const subStat = `替补 ${subCount}人`;
  drawMatchShareText(ctx, starterStat, contentX, nextY, 26, CARD_PALETTE.white, "left", 900);
  const starterW = measureMatchShareTextWidth(ctx, starterStat, 26, 900);
  drawMatchShareText(ctx, "·", contentX + starterW + 14, nextY, 26, "rgba(255, 255, 255, 0.45)", "left", 800);
  drawMatchShareText(ctx, subStat, contentX + starterW + 36, nextY, 26, CARD_PALETTE.goldLabel, "left", 900);
  nextY += 44;

  // 替补对应列表（最多展示 4 条，确保文字清晰不拥挤）
  const subLines = buildPosterSubSummaryLines(input.pitchSlots, 4);
  const totalWithSubs = input.pitchSlots.filter((s) => s.subs.length > 0).length;
  const remainingHeight = cardY + cardH - 22 - nextY;
  const maxVisibleLines = Math.max(1, Math.min(4, Math.floor(remainingHeight / 36)));

  if (subLines.length > 0) {
    subLines.slice(0, maxVisibleLines).forEach((line, idx) => {
      const fitted = fitText(ctx, line.text, contentW, 21, 18, 700);
      drawMatchShareText(
        ctx,
        fitted.text,
        contentX,
        nextY + idx * 36,
        fitted.size,
        "rgba(255, 255, 255, 0.90)",
        "left",
        700,
      );
    });
    if (totalWithSubs > maxVisibleLines && nextY + maxVisibleLines * 36 <= cardY + cardH - 18) {
      drawMatchShareText(
        ctx,
        `另有 ${totalWithSubs - maxVisibleLines} 个位置已安排替补…`,
        contentX,
        nextY + maxVisibleLines * 36,
        19,
        "rgba(255, 255, 255, 0.62)",
        "left",
        600,
      );
    }
  } else {
    drawMatchShareText(
      ctx,
      starterCount > 0 ? "首发阵型已排定" : "待队长排定首发",
      contentX,
      nextY,
      22,
      "rgba(255, 255, 255, 0.84)",
      "left",
      700,
    );
    drawMatchShareText(
      ctx,
      "点击卡片查看完整站位安排",
      contentX,
      nextY + 36,
      20,
      "rgba(255, 255, 255, 0.62)",
      "left",
      600,
    );
  }
}

function drawPitchField(ctx: CanvasRenderingContext2D) {
  const { x, y, w, h } = PITCH_RECT;
  const radius = 20;

  ctx.save();
  drawRoundRect(ctx, x, y, w, h, radius);
  ctx.clip();

  const stripeHeight = h / 8;
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 === 1 ? CARD_PALETTE.grassAlt : CARD_PALETTE.grass;
    ctx.fillRect(x, y + i * stripeHeight, w, stripeHeight + 1);
  }

  const insetX = w * 0.035;
  const insetY = h * 0.03;
  ctx.strokeStyle = CARD_PALETTE.marking;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + insetX, y + insetY, w - insetX * 2, h - insetY * 2);

  // 中线与中圈
  const midY = y + h / 2;
  ctx.beginPath();
  ctx.moveTo(x + insetX, midY);
  ctx.lineTo(x + w - insetX, midY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + w / 2, midY, w * 0.13, 0, Math.PI * 2, false);
  ctx.stroke();

  // 上下禁区
  const boxW = w * 0.48;
  const boxH = h * 0.135;
  const boxX = x + (w - boxW) / 2;
  ctx.strokeRect(boxX, y + insetY, boxW, boxH);
  ctx.strokeRect(boxX, y + h - insetY - boxH, boxW, boxH);
  ctx.restore();

  // 球场外框微亮描边
  ctx.save();
  drawRoundRect(ctx, x, y, w, h, radius);
  ctx.strokeStyle = CARD_PALETTE.pitchBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawPitchPlayers(
  ctx: CanvasRenderingContext2D,
  pitchSlots: PitchSlotView[],
  avatars: Map<string, LoadedCanvasAvatar>,
  playersPerTeam: number,
) {
  const compact = playersPerTeam >= 9;
  const radius = compact ? 19 : 22;
  const nameFont = compact ? 15 : 17;
  const subFont = compact ? 12 : 13;

  for (const entry of pitchSlots) {
    const point = posterPlayerPoint(entry.x, entry.y);
    const starter = entry.starter;
    const avatar = starter?.avatar_url ? avatars.get(starter.avatar_url) : undefined;

    // 圆形头像或首字占位
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2, false);
    ctx.clip();
    ctx.fillStyle = starter ? CARD_PALETTE.dotBg : CARD_PALETTE.dotEmptyBg;
    ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
    if (avatar) {
      const side = Math.min(avatar.width, avatar.height);
      ctx.drawImage(
        avatar.image as Parameters<CanvasRenderingContext2D["drawImage"]>[0],
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
      drawMatchShareText(ctx, avatarInitial(starter.nickname), point.x, point.y + 1, compact ? 17 : 20, CARD_PALETTE.ink, "center", 800);
    } else {
      drawMatchShareText(ctx, "+", point.x, point.y, compact ? 20 : 24, CARD_PALETTE.white, "center", 700);
    }
    ctx.restore();

    // 白色高亮圆环
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2, false);
    ctx.strokeStyle = starter ? CARD_PALETTE.white : "rgba(255, 255, 255, 0.72)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // 姓名胶囊
    const displayName = starter ? clippedText(starter.nickname, 5) : entry.label;
    const nameWidth = Math.max(58, measureMatchShareTextWidth(ctx, displayName, nameFont, 700) + 18);
    const nameHeight = compact ? 22 : 25;
    const nameY = point.y + radius + 5;
    ctx.save();
    ctx.fillStyle = CARD_PALETTE.nameBg;
    drawRoundRect(ctx, point.x - nameWidth / 2, nameY, nameWidth, nameHeight, nameHeight / 2);
    ctx.fill();
    ctx.restore();
    drawMatchShareText(ctx, displayName, point.x, nameY + nameHeight / 2 + 0.5, nameFont, CARD_PALETTE.white, "center", 700);

    // 替补小标
    if (entry.subs.length > 0) {
      const subLabel = formatSubBadgeText(entry.subs);
      const subWidth = Math.max(48, measureMatchShareTextWidth(ctx, subLabel, subFont, 700) + 14);
      const subHeight = compact ? 18 : 20;
      const subY = nameY + nameHeight + 3;
      ctx.save();
      ctx.fillStyle = CARD_PALETTE.subBg;
      drawRoundRect(ctx, point.x - subWidth / 2, subY, subWidth, subHeight, subHeight / 2);
      ctx.fill();
      ctx.restore();
      drawMatchShareText(ctx, subLabel, point.x, subY + subHeight / 2 + 0.5, subFont, CARD_PALETTE.subFg, "center", 800);
    }
  }
}

function drawBottomVenueBar(ctx: CanvasRenderingContext2D, location: string) {
  const barY = 684;
  const barH = 116;
  ctx.save();
  ctx.fillStyle = CARD_PALETTE.white;
  ctx.fillRect(0, barY, MATCH_SHARE_CARD_WIDTH, barH);
  ctx.fillStyle = CARD_PALETTE.slashRed;
  ctx.fillRect(0, barY, 18, barH);
  ctx.restore();

  const locationOnly = location?.trim() || "场地待定";
  const withActionHint = `${locationOnly}  ·  点击查看完整阵型`;
  const pinHeight = 42;
  const pinSlotWidth = 34;
  const pinGap = 14;
  const maxTextWidth = 872;
  const barCenterX = 509;
  const barCenterY = barY + barH / 2;

  const drawPinAndLines = (lines: string[], fontSize: number) => {
    const widths = lines.map((line) => measureMatchShareTextWidth(ctx, line, fontSize, 900));
    const blockTextWidth = Math.min(maxTextWidth, Math.max(...widths, 0));
    const totalWidth = pinSlotWidth + pinGap + blockTextWidth;
    const startX = Math.max(40, barCenterX - totalWidth / 2);
    const pinCx = startX + pinSlotWidth / 2;
    const textX = startX + pinSlotWidth + pinGap;

    drawLocationPinIcon(ctx, pinCx, barCenterY, pinHeight);
    if (lines.length <= 1) {
      drawMatchShareText(ctx, lines[0] || locationOnly, textX, barCenterY, fontSize, CARD_PALETTE.ink, "left", 900);
      return;
    }
    const lineGap = Math.round(fontSize * 1.42);
    drawMatchShareText(ctx, lines[0]!, textX, barCenterY - lineGap / 2, fontSize, CARD_PALETTE.ink, "left", 900);
    drawMatchShareText(ctx, lines[1]!, textX, barCenterY + lineGap / 2, fontSize, CARD_PALETTE.ink, "left", 900);
  };

  for (const candidate of [withActionHint, locationOnly]) {
    const fitted = fitText(ctx, candidate, maxTextWidth, 34, 28, 900);
    if (!fitted.text.endsWith("…")) {
      drawPinAndLines([fitted.text], fitted.size);
      return;
    }
  }

  const twoLineSizes = [28, 26, 24] as const;
  let chosenSize: number = 24;
  let chosenLines: string[] = [];
  for (const candidateSize of twoLineSizes) {
    const lines = wrapTextLines(
      locationOnly,
      maxTextWidth,
      (text) => measureMatchShareTextWidth(ctx, text, candidateSize, 900),
      2,
    );
    chosenSize = candidateSize;
    chosenLines = lines;
    if (!lines[lines.length - 1]?.endsWith("…")) {
      break;
    }
  }
  drawPinAndLines(chosenLines.length ? chosenLines : [locationOnly], chosenSize);
}

/** 在标准 Canvas 2D 上绘制 1000×800（5:4）C2 比赛日风格阵型分享卡片。 */
export function drawLineupShareCard(
  ctx: CanvasRenderingContext2D,
  input: LineupPosterInput,
  avatars: Map<string, LoadedCanvasAvatar>,
  backdrop: ResolvedCanvasBackdrop | null,
): void {
  drawMatchShareBackdrop(ctx, backdrop, LINEUP_CARD.width, LINEUP_CARD.height, "LINEUP");
  drawTopTimeBanner(ctx, input.startTime, input.endTime);
  drawLeftTacticalCard(ctx, input);
  drawPitchField(ctx);
  drawPitchPlayers(ctx, input.pitchSlots, avatars, input.playersPerTeam);
  drawBottomVenueBar(ctx, input.location);
}

/**
 * 使用标准 `<canvas type="2d">` 合成 1000×800（5:4）微信阵型分享卡片（支持转发群/好友与朋友圈）。
 * 支持球队会员自定义分享背景图，下载或解码失败时优雅降级为 C2 默认炽烈红黑球场射灯底。
 */
export async function composeLineupShareCard(
  canvasId: string,
  pageInstance: unknown,
  input: LineupPosterInput,
  isCurrent: () => boolean,
  loadImage: (src: string) => Promise<LineupPosterImageInfo> = getImageInfo,
): Promise<string> {
  if (!isCurrent()) throw new Error("阵型内容已更新");

  const canvas = await queryCanvas2DNode(canvasId, pageInstance);
  if (!isCurrent()) throw new Error("阵型内容已更新");

  const avatarUrls = Array.from(
    new Set(
      input.pitchSlots
        .map((entry) => entry.starter?.avatar_url)
        .filter((url): url is string => Boolean(url && url.trim())),
    ),
  );
  const customBgUrl = input.customBgImageUrl?.trim() || "";

  const [loadedAvatars, loadedBackdrop] = await Promise.all([
    Promise.all(
      avatarUrls.map(async (url) => {
        try {
          const info = await loadImage(url);
          if (!isCurrent() || !info?.path) return null;
          const img = await loadCanvas2DImage(canvas, info.path);
          const width = img.width || info.width;
          const height = img.height || info.height;
          if (width > 0 && height > 0) {
            return [url, { image: img, width, height }] as const;
          }
          return null;
        } catch {
          return null;
        }
      }),
    ),
    customBgUrl
      ? (async (): Promise<ResolvedCanvasBackdrop | null> => {
          try {
            const info = await loadImage(customBgUrl);
            if (!isCurrent() || !info?.path) return null;
            const img = await loadCanvas2DImage(canvas, info.path);
            const width = img.width || info.width;
            const height = img.height || info.height;
            if (width > 0 && height > 0) {
              return { image: img, width, height };
            }
            return null;
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null),
  ]);

  if (!isCurrent()) throw new Error("阵型内容已更新");

  const avatars = new Map<string, LoadedCanvasAvatar>();
  for (const pair of loadedAvatars) {
    if (pair) avatars.set(pair[0], pair[1]);
  }

  canvas.width = LINEUP_CARD.width;
  canvas.height = LINEUP_CARD.height;
  const ctx = canvas.getContext("2d");
  drawLineupShareCard(ctx, input, avatars, loadedBackdrop);

  return exportCanvas2DToTempFile(canvas, isCurrent, LINEUP_CARD.width, LINEUP_CARD.height);
}
