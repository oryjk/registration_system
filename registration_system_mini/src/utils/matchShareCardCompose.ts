import {
  beijingDateKey,
  beijingDateParts,
  formatTimeLabel,
  formatWeekdayLabel,
} from "@/utils/datetime";
import { resolveMinioImage, retainMinioImage } from "@/utils/minioImageCache";

export const MATCH_SHARE_CARD_WIDTH = 1000;
export const MATCH_SHARE_CARD_HEIGHT = 800;
export const MATCH_SHARE_CARD_CANVAS_ID = "match-share-card-canvas";

export interface MatchShareCardInput {
  /** 比赛名称 */
  name: string;
  /** 比赛类型标签，如「线下已约」「线上约队」「散人约球」「场馆组局」 */
  matchKindLabel?: string;
  /** 主队名称 */
  homeTeamLabel?: string;
  /** 对手名称 */
  opponentLabel?: string;
  /** 主队球衣颜色（HEX 或色名） */
  homeTeamColor?: string;
  /** 客队/对手球衣颜色（HEX 或色名） */
  awayTeamColor?: string;
  /** 比赛开始时刻（RFC3339 / UTC ISO） */
  startTime?: string;
  /** 比赛结束时刻（RFC3339 / UTC ISO） */
  endTime?: string;
  /** 当 startTime 不可用时的时间兜底文案 */
  clockFallback?: string;
  /** 比赛地点 */
  location?: string;
  /** 是否为散人约球（无主客队概念） */
  isPickupMatch?: boolean;
  /** 是否为场馆组局（详情不展示主客队对阵） */
  isVenueMatch?: boolean;
  /** 每队人数（人制），如 7 -> 7人制 */
  playersPerTeam?: number | null;
}

export interface ParsedJerseyColor {
  /** 规范化 6 位小写 HEX；无法识别色值时为空串 */
  swatch: string;
  /** 展示用中文色名、大写 HEX 或原始色名文案 */
  label: string;
}

export interface MatchShareJerseyItem {
  role: "home" | "away";
  roleLabel: "主" | "客";
  swatch: string;
  label: string;
  displayText: string;
}

export type MatchShareMatchup =
  | {
      mode: "versus";
      homeName: string;
      awayName: string;
      awayPending: boolean;
      headline: string;
    }
  | {
      mode: "headline";
      primaryText: string;
      secondaryText: string;
      headline: string;
    };

export interface MatchShareCardViewModel {
  badgeLabel: string;
  formatTag: string;
  title: string;
  matchup: MatchShareMatchup;
  timeLabel: string;
  locationLabel: string;
  jerseyItems: MatchShareJerseyItem[];
  jerseyFallbackText: string;
}

export interface ShareCardImageInfo {
  path: string;
  width: number;
  height: number;
}

// 兼容 TeamColorPicker.vue（14 色）与 TeamKitColor.vue 的既有球衣颜色映射。
const HEX_COLOR_LABELS: Record<string, string> = {
  "#ffffff": "白色",
  "#ff0000": "红色",
  "#ef4444": "红色",
  "#000000": "黑色",
  "#111310": "黑色",
  "#0000ff": "蓝色",
  "#2f6bff": "蓝色",
  "#00ff00": "绿色",
  "#008000": "绿色",
  "#22c55e": "绿色",
  "#ffff00": "黄色",
  "#facc15": "黄色",
  "#ff6b35": "橙色",
  "#b34dff": "紫色",
  "#ec4899": "粉色",
  "#06b6d4": "青色",
  "#38bdf8": "天蓝",
  "#c8ff00": "荧光绿",
  "#d8dde6": "银灰",
  "#94a3b8": "灰色",
  "#1e3a8a": "深蓝",
};

const NAMED_JERSEY_COLORS: Record<string, ParsedJerseyColor> = {
  白色: { swatch: "#ffffff", label: "白色" },
  白: { swatch: "#ffffff", label: "白色" },
  white: { swatch: "#ffffff", label: "白色" },
  红色: { swatch: "#ef4444", label: "红色" },
  红: { swatch: "#ef4444", label: "红色" },
  red: { swatch: "#ef4444", label: "红色" },
  黑色: { swatch: "#111310", label: "黑色" },
  黑: { swatch: "#111310", label: "黑色" },
  black: { swatch: "#111310", label: "黑色" },
  蓝色: { swatch: "#2f6bff", label: "蓝色" },
  蓝: { swatch: "#2f6bff", label: "蓝色" },
  blue: { swatch: "#2f6bff", label: "蓝色" },
  绿色: { swatch: "#22c55e", label: "绿色" },
  绿: { swatch: "#22c55e", label: "绿色" },
  green: { swatch: "#22c55e", label: "绿色" },
  黄色: { swatch: "#facc15", label: "黄色" },
  黄: { swatch: "#facc15", label: "黄色" },
  yellow: { swatch: "#facc15", label: "黄色" },
  橙色: { swatch: "#ff6b35", label: "橙色" },
  橙: { swatch: "#ff6b35", label: "橙色" },
  橘色: { swatch: "#ff6b35", label: "橙色" },
  橘: { swatch: "#ff6b35", label: "橙色" },
  orange: { swatch: "#ff6b35", label: "橙色" },
  紫色: { swatch: "#b34dff", label: "紫色" },
  紫: { swatch: "#b34dff", label: "紫色" },
  purple: { swatch: "#b34dff", label: "紫色" },
  粉色: { swatch: "#ec4899", label: "粉色" },
  粉: { swatch: "#ec4899", label: "粉色" },
  粉红: { swatch: "#ec4899", label: "粉色" },
  粉红色: { swatch: "#ec4899", label: "粉色" },
  pink: { swatch: "#ec4899", label: "粉色" },
  青色: { swatch: "#06b6d4", label: "青色" },
  青: { swatch: "#06b6d4", label: "青色" },
  cyan: { swatch: "#06b6d4", label: "青色" },
  天蓝: { swatch: "#38bdf8", label: "天蓝" },
  天蓝色: { swatch: "#38bdf8", label: "天蓝" },
  浅蓝: { swatch: "#38bdf8", label: "天蓝" },
  浅蓝色: { swatch: "#38bdf8", label: "天蓝" },
  skyblue: { swatch: "#38bdf8", label: "天蓝" },
  荧光绿: { swatch: "#c8ff00", label: "荧光绿" },
  荧光绿色: { swatch: "#c8ff00", label: "荧光绿" },
  lime: { swatch: "#c8ff00", label: "荧光绿" },
  银灰: { swatch: "#d8dde6", label: "银灰" },
  银灰色: { swatch: "#d8dde6", label: "银灰" },
  银色: { swatch: "#d8dde6", label: "银灰" },
  silver: { swatch: "#d8dde6", label: "银灰" },
  灰色: { swatch: "#94a3b8", label: "灰色" },
  灰: { swatch: "#94a3b8", label: "灰色" },
  gray: { swatch: "#94a3b8", label: "灰色" },
  grey: { swatch: "#94a3b8", label: "灰色" },
  深蓝: { swatch: "#1e3a8a", label: "深蓝" },
  深蓝色: { swatch: "#1e3a8a", label: "深蓝" },
  藏蓝: { swatch: "#1e3a8a", label: "深蓝" },
  藏蓝色: { swatch: "#1e3a8a", label: "深蓝" },
  海军蓝: { swatch: "#1e3a8a", label: "深蓝" },
  navy: { swatch: "#1e3a8a", label: "深蓝" },
};

const PLACEHOLDER_TEAM_LABELS = new Set(["", "待定", "对手待定", "未定"]);

/** 将 3/6 位 HEX 或中英文色名规范化为画布色点 + 中文标签。 */
export function parseJerseyColor(rawColor?: string | null): ParsedJerseyColor | null {
  const raw = rawColor?.trim() || "";
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(lower)) {
    return {
      swatch: lower,
      label: HEX_COLOR_LABELS[lower] ?? lower.toUpperCase(),
    };
  }
  if (/^#[0-9a-f]{3}$/.test(lower)) {
    const expanded = `#${lower
      .slice(1)
      .split("")
      .map((char) => char + char)
      .join("")}`;
    return {
      swatch: expanded,
      label: HEX_COLOR_LABELS[expanded] ?? expanded.toUpperCase(),
    };
  }

  const normalizedName = lower.replace(/(?:队服|球服|球衣)$/u, "").trim();
  const matched = NAMED_JERSEY_COLORS[normalizedName] ?? NAMED_JERSEY_COLORS[lower];
  if (matched) return { ...matched };

  return {
    swatch: "",
    label: raw.replace(/(?:队服|球服|球衣)$/u, "").trim() || raw,
  };
}

/** 按 Unicode 字符数优雅截断文本（纯函数，不依赖 Canvas）。 */
export function truncateText(value: string, maxChars: number): string {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean || maxChars <= 0) return "";
  const chars = Array.from(clean);
  if (chars.length <= maxChars) return clean;
  if (maxChars === 1) return "…";
  return `${chars.slice(0, maxChars - 1).join("")}…`;
}

/** 按像素宽度将文本折行到最多 maxLines 行，末行超出自动拼接省略号。 */
export function wrapTextLines(
  value: string,
  maxWidth: number,
  measureWidth: (text: string) => number,
  maxLines = 1,
): string[] {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean || maxLines <= 0 || maxWidth <= 0) return [];

  const chars = Array.from(clean);
  const lines: string[] = [];
  let offset = 0;

  while (offset < chars.length && lines.length < maxLines) {
    let line = "";
    while (offset < chars.length && measureWidth(line + chars[offset]) <= maxWidth) {
      line += chars[offset++]!;
    }
    if (!line) {
      line = chars[offset++]!;
    }
    if (lines.length === maxLines - 1 && offset < chars.length) {
      let trimmed = Array.from(line);
      while (trimmed.length > 0 && measureWidth(`${trimmed.join("")}…`) > maxWidth) {
        trimmed = trimmed.slice(0, -1);
      }
      line = trimmed.length > 0 ? `${trimmed.join("")}…` : "…";
    }
    lines.push(line.trim());
  }

  return lines;
}

/** 使用 datetime.ts 将比赛起止时刻格式化为北京时间展示文案（不截取 ISO 字符串）。 */
export function formatMatchShareTime(
  startTime?: string | null,
  endTime?: string | null,
  clockFallback?: string | null,
): string {
  const startRaw = startTime?.trim() || "";
  if (startRaw) {
    const startParts = beijingDateParts(startRaw);
    if (Number.isFinite(startParts.year)) {
      const datePrefix = `${startParts.month}月${startParts.day}日 ${formatWeekdayLabel(startRaw)}`;
      const startClock = formatTimeLabel(startRaw);
      const endRaw = endTime?.trim() || "";
      if (endRaw) {
        const endParts = beijingDateParts(endRaw);
        if (Number.isFinite(endParts.year)) {
          const endClock = formatTimeLabel(endRaw);
          if (beijingDateKey(endRaw) !== beijingDateKey(startRaw)) {
            return `${datePrefix} ${startClock}-${endParts.month}月${endParts.day}日 ${endClock}`;
          }
          return `${datePrefix} ${startClock}-${endClock}`;
        }
      }
      return `${datePrefix} ${startClock}`;
    }
  }

  const fallback = clockFallback?.trim() || "";
  return fallback || "时间待定";
}

function normalizeTeamLabel(value?: string | null): string {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function isPlaceholderTeamLabel(value: string): boolean {
  return PLACEHOLDER_TEAM_LABELS.has(value);
}

/** 组装分享卡核心对阵区文案，兼容球队对阵、对手待定、散人约球与场馆组局。 */
export function buildMatchupDisplay(input: MatchShareCardInput): MatchShareMatchup {
  const title = input.name?.trim().replace(/\s+/g, " ") || "比赛报名";
  const formatPrefix = input.playersPerTeam && input.playersPerTeam > 0
    ? `${input.playersPerTeam}人制 · `
    : "";

  if (input.isPickupMatch) {
    const secondaryText = `${formatPrefix}散人约球 · 欢迎报名`;
    return {
      mode: "headline",
      primaryText: title,
      secondaryText,
      headline: title,
    };
  }

  if (input.isVenueMatch) {
    const secondaryText = `${formatPrefix}场馆组局 · 欢迎报名`;
    return {
      mode: "headline",
      primaryText: title,
      secondaryText,
      headline: title,
    };
  }

  const home = normalizeTeamLabel(input.homeTeamLabel);
  const away = normalizeTeamLabel(input.opponentLabel);
  const hasHome = !isPlaceholderTeamLabel(home);
  const hasAway = !isPlaceholderTeamLabel(away);

  if (!hasHome && !hasAway) {
    const secondaryText = `${formatPrefix}对手待定`;
    return {
      mode: "headline",
      primaryText: title,
      secondaryText,
      headline: `${title} · 对手待定`,
    };
  }

  const homeName = hasHome ? home : "主队";
  const awayName = hasAway ? away : "对手待定";
  return {
    mode: "versus",
    homeName,
    awayName,
    awayPending: !hasAway,
    headline: `${homeName} VS ${awayName}`,
  };
}

/** 将比赛详情字段转换为分享卡绘制所需的规范化视图模型。 */
export function buildMatchShareCardViewModel(input: MatchShareCardInput): MatchShareCardViewModel {
  const rawKind = input.matchKindLabel?.trim() || "";
  const badgeLabel = rawKind && rawKind !== "其他类型" ? rawKind : "赛事报名";
  const formatTag = input.playersPerTeam && input.playersPerTeam > 0
    ? `${input.playersPerTeam}人制`
    : "";
  const title = input.name?.trim().replace(/\s+/g, " ") || "比赛报名";
  const matchup = buildMatchupDisplay(input);
  const timeLabel = formatMatchShareTime(input.startTime, input.endTime, input.clockFallback);
  const locationLabel = input.location?.trim().replace(/\s+/g, " ") || "地点待定";

  const jerseyItems: MatchShareJerseyItem[] = [];
  const homeKit = parseJerseyColor(input.homeTeamColor);
  if (homeKit) {
    jerseyItems.push({
      role: "home",
      roleLabel: "主",
      swatch: homeKit.swatch,
      label: homeKit.label,
      displayText: `${homeKit.label}（主）`,
    });
  }
  const awayKit = parseJerseyColor(input.awayTeamColor);
  if (awayKit) {
    jerseyItems.push({
      role: "away",
      roleLabel: "客",
      swatch: awayKit.swatch,
      label: awayKit.label,
      displayText: `${awayKit.label}（客）`,
    });
  }

  return {
    badgeLabel,
    formatTag,
    title,
    matchup,
    timeLabel,
    locationLabel,
    jerseyItems,
    jerseyFallbackText: jerseyItems.length > 0 ? "" : "球服颜色待定",
  };
}

function getImageInfo(src: string): Promise<ShareCardImageInfo> {
  return new Promise((resolve, reject) => {
    uni.getImageInfo({ src, success: resolve, fail: reject });
  });
}

/** 页面级背景图加载器：合并并发下载、保留 MinIO 缓存租约，页面卸载时统一释放。 */
export function createMatchShareImageLoader() {
  const images = new Map<string, Promise<ShareCardImageInfo>>();
  const releases = new Map<string, () => void>();

  function drop(src: string) {
    releases.get(src)?.();
    releases.delete(src);
    images.delete(src);
  }

  return {
    load(src: string): Promise<ShareCardImageInfo> {
      const cached = images.get(src);
      if (cached) return cached;
      const task = resolveMinioImage(src)
        .then(getImageInfo)
        .catch((failure) => {
          if (images.get(src) === task) drop(src);
          throw failure;
        });
      if (images.size >= 8) {
        const oldest = images.keys().next().value;
        if (oldest) drop(oldest);
      }
      releases.set(src, retainMinioImage(src));
      images.set(src, task);
      return task;
    },
    clear() {
      for (const src of Array.from(images.keys())) {
        drop(src);
      }
    },
  };
}

function setFont(ctx: UniApp.CanvasContext, size: number, weight: 400 | 500 | 600 | 700 = 400) {
  ctx.font = `${weight} ${size}px sans-serif`;
}

function drawText(
  ctx: UniApp.CanvasContext,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: "left" | "center" | "right" = "left",
  weight: 400 | 500 | 600 | 700 = 400,
) {
  setFont(ctx, size, weight);
  ctx.setFillStyle(color);
  ctx.setTextAlign(align);
  ctx.setTextBaseline("middle");
  ctx.fillText(value, x, y);
}

function drawRoundRectPath(
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

function drawPill(
  ctx: UniApp.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  drawRoundRectPath(ctx, x, y, width, height, radius);
  ctx.setFillStyle(fill);
  ctx.fill();
  if (stroke) {
    ctx.setStrokeStyle(stroke);
    ctx.setLineWidth(2);
    ctx.stroke();
  }
}

function measureWidthWithFont(
  ctx: UniApp.CanvasContext,
  value: string,
  size: number,
  weight: 400 | 500 | 600 | 700 = 400,
): number {
  setFont(ctx, size, weight);
  const measured = ctx.measureText(value)?.width;
  if (typeof measured === "number" && Number.isFinite(measured) && measured > 0) {
    return measured;
  }
  return Array.from(value).length * size;
}

function drawBackdrop(
  ctx: UniApp.CanvasContext,
  backdrop: ShareCardImageInfo | null,
  width: number,
  height: number,
) {
  // 深海蓝质感底色（背景图缺失或加载失败时作为最终画布背景）。
  const baseGradient = ctx.createLinearGradient(0, 0, width, height);
  baseGradient.addColorStop(0, "#001738");
  baseGradient.addColorStop(0.55, "#00214d");
  baseGradient.addColorStop(1, "#0a365c");
  ctx.setFillStyle(baseGradient);
  ctx.fillRect(0, 0, width, height);

  if (backdrop && backdrop.width > 0 && backdrop.height > 0) {
    const ratio = Math.max(width / backdrop.width, height / backdrop.height);
    const drawWidth = backdrop.width * ratio;
    const drawHeight = backdrop.height * ratio;
    ctx.drawImage(
      backdrop.path,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );

    // 深海蓝渐变暗幕：保证微信聊天小图上前景白字始终保持高对比度。
    const veil = ctx.createLinearGradient(0, 0, 0, height);
    veil.addColorStop(0, "rgba(0, 26, 62, 0.72)");
    veil.addColorStop(0.45, "rgba(0, 33, 77, 0.80)");
    veil.addColorStop(1, "rgba(0, 20, 48, 0.94)");
    ctx.setFillStyle(veil);
    ctx.fillRect(0, 0, width, height);
  } else {
    // 无图降级时补两处极轻柔光圈，避免纯平单调。
    ctx.beginPath();
    ctx.arc(width - 90, 90, 240, 0, Math.PI * 2);
    ctx.closePath();
    ctx.setFillStyle("rgba(0, 235, 199, 0.09)");
    ctx.fill();

    ctx.beginPath();
    ctx.arc(110, height - 110, 260, 0, Math.PI * 2);
    ctx.closePath();
    ctx.setFillStyle("rgba(56, 189, 248, 0.08)");
    ctx.fill();
  }

  // 顶部 8px 品牌薄荷蓝细饰条。
  ctx.setFillStyle("#00ebc7");
  ctx.fillRect(0, 0, width, 8);
}

function drawHeaderSection(ctx: UniApp.CanvasContext, view: MatchShareCardViewModel) {
  const left = 56;
  const maxContentWidth = MATCH_SHARE_CARD_WIDTH - left * 2;
  const badgeHeight = 50;
  const badgeY = 42;
  const badgeTextWidth = measureWidthWithFont(ctx, view.badgeLabel, 26, 600);
  const badgeWidth = Math.max(136, Math.min(300, Math.ceil(badgeTextWidth + 48)));

  drawPill(ctx, left, badgeY, badgeWidth, badgeHeight, 25, "#00ebc7");
  drawText(
    ctx,
    view.badgeLabel,
    left + badgeWidth / 2,
    badgeY + badgeHeight / 2,
    26,
    "#00214d",
    "center",
    600,
  );

  if (view.formatTag) {
    const tagX = left + badgeWidth + 16;
    const tagTextWidth = measureWidthWithFont(ctx, view.formatTag, 24, 500);
    const tagWidth = Math.max(104, Math.ceil(tagTextWidth + 40));
    drawPill(
      ctx,
      tagX,
      badgeY,
      tagWidth,
      badgeHeight,
      25,
      "rgba(255, 255, 255, 0.14)",
      "rgba(255, 255, 255, 0.28)",
    );
    drawText(
      ctx,
      view.formatTag,
      tagX + tagWidth / 2,
      badgeY + badgeHeight / 2,
      24,
      "#fffffe",
      "center",
      500,
    );
  }

  // 对阵模式顶部展示比赛标题（最多 1 行）；headline 模式主标题已放在核心大字区，避免重复。
  if (view.matchup.mode === "versus") {
    const titleLines = wrapTextLines(
      view.title,
      maxContentWidth,
      (text) => measureWidthWithFont(ctx, text, 34, 600),
      1,
    );
    if (titleLines[0]) {
      drawText(ctx, titleLines[0], left, 134, 34, "rgba(255, 255, 254, 0.90)", "left", 600);
    }
  } else {
    drawText(ctx, "邀请你参加比赛报名", left, 134, 30, "rgba(189, 238, 231, 0.88)", "left", 500);
  }
}

function drawTeamSide(
  ctx: UniApp.CanvasContext,
  roleLabel: string,
  roleColor: string,
  teamName: string,
  teamColor: string,
  centerX: number,
  maxWidth: number,
) {
  drawText(ctx, roleLabel, centerX, 204, 24, roleColor, "center", 600);

  const singleLineWidth = measureWidthWithFont(ctx, teamName, 48, 700);
  if (singleLineWidth <= maxWidth) {
    drawText(ctx, teamName, centerX, 274, 48, teamColor, "center", 700);
    return;
  }

  const lines = wrapTextLines(
    teamName,
    maxWidth,
    (text) => measureWidthWithFont(ctx, text, 42, 700),
    2,
  );
  if (lines.length === 1) {
    drawText(ctx, lines[0]!, centerX, 274, 42, teamColor, "center", 700);
  } else {
    drawText(ctx, lines[0]!, centerX, 252, 42, teamColor, "center", 700);
    if (lines[1]) {
      drawText(ctx, lines[1], centerX, 302, 42, teamColor, "center", 700);
    }
  }
}

function drawMatchupSection(ctx: UniApp.CanvasContext, view: MatchShareCardViewModel) {
  const left = 56;
  const maxContentWidth = MATCH_SHARE_CARD_WIDTH - left * 2;

  if (view.matchup.mode === "versus") {
    const vsWidth = 96;
    const vsHeight = 54;
    const vsX = MATCH_SHARE_CARD_WIDTH / 2 - vsWidth / 2;
    const vsY = 247;
    drawPill(ctx, vsX, vsY, vsWidth, vsHeight, 27, "#00ebc7");
    drawText(
      ctx,
      "VS",
      MATCH_SHARE_CARD_WIDTH / 2,
      vsY + vsHeight / 2,
      32,
      "#00214d",
      "center",
      700,
    );

    const sideWidth = 368;
    drawTeamSide(
      ctx,
      "主队",
      "rgba(189, 238, 231, 0.85)",
      view.matchup.homeName,
      "#fffffe",
      left + sideWidth / 2,
      sideWidth,
    );
    drawTeamSide(
      ctx,
      "对手",
      "#00ebc7",
      view.matchup.awayName,
      view.matchup.awayPending ? "rgba(255, 255, 254, 0.72)" : "#fffffe",
      MATCH_SHARE_CARD_WIDTH - left - sideWidth / 2,
      sideWidth,
    );
    return;
  }

  const primaryWidth52 = measureWidthWithFont(ctx, view.matchup.primaryText, 52, 700);
  const primarySize = primaryWidth52 <= maxContentWidth ? 52 : 44;
  const primaryLines = wrapTextLines(
    view.matchup.primaryText,
    maxContentWidth,
    (text) => measureWidthWithFont(ctx, text, primarySize, 700),
    1,
  );
  if (primaryLines[0]) {
    drawText(ctx, primaryLines[0], MATCH_SHARE_CARD_WIDTH / 2, 248, primarySize, "#fffffe", "center", 700);
  }
  const secondaryLines = wrapTextLines(
    view.matchup.secondaryText,
    maxContentWidth,
    (text) => measureWidthWithFont(ctx, text, 30, 500),
    1,
  );
  if (secondaryLines[0]) {
    drawText(ctx, secondaryLines[0], MATCH_SHARE_CARD_WIDTH / 2, 310, 30, "#bdeee7", "center", 500);
  }
}

function drawRowTag(ctx: UniApp.CanvasContext, label: string, x: number, centerY: number) {
  const width = 92;
  const height = 44;
  drawPill(ctx, x, centerY - height / 2, width, height, 12, "rgba(0, 235, 199, 0.16)");
  drawText(ctx, label, x + width / 2, centerY, 26, "#00ebc7", "center", 600);
}

function drawJerseyRow(
  ctx: UniApp.CanvasContext,
  view: MatchShareCardViewModel,
  valueX: number,
  maxValueWidth: number,
  centerY: number,
) {
  if (view.jerseyItems.length === 0) {
    drawText(ctx, view.jerseyFallbackText, valueX, centerY, 32, "rgba(255, 255, 254, 0.68)", "left", 500);
    return;
  }

  const dotRadius = 15;
  const dotGap = 14;
  const itemGap = 44;
  const fontCandidates: Array<34 | 30 | 26> = [34, 30, 26];

  let chosenSize: 34 | 30 | 26 = 34;
  for (const size of fontCandidates) {
    const totalWidth = view.jerseyItems.reduce((sum, item, index) => {
      const swatchSpace = item.swatch ? dotRadius * 2 + dotGap : 0;
      const textWidth = measureWidthWithFont(ctx, item.displayText, size, 600);
      return sum + (index > 0 ? itemGap : 0) + swatchSpace + textWidth;
    }, 0);
    chosenSize = size;
    if (totalWidth <= maxValueWidth) break;
  }

  let cursorX = valueX;
  const perItemMaxWidth = view.jerseyItems.length > 1
    ? Math.floor((maxValueWidth - itemGap) / view.jerseyItems.length)
    : maxValueWidth;

  for (const item of view.jerseyItems) {
    let availableTextWidth = perItemMaxWidth;
    if (item.swatch) {
      const dotCenterX = cursorX + dotRadius;
      ctx.beginPath();
      ctx.arc(dotCenterX, centerY, dotRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.setFillStyle(item.swatch);
      ctx.fill();
      ctx.setStrokeStyle("rgba(255, 255, 255, 0.80)");
      ctx.setLineWidth(3);
      ctx.stroke();
      cursorX += dotRadius * 2 + dotGap;
      availableTextWidth = Math.max(80, perItemMaxWidth - (dotRadius * 2 + dotGap));
    }

    const [safeText] = wrapTextLines(
      item.displayText,
      availableTextWidth,
      (text) => measureWidthWithFont(ctx, text, chosenSize, 600),
      1,
    );
    const drawn = safeText || item.displayText;
    drawText(ctx, drawn, cursorX, centerY, chosenSize, "#fffffe", "left", 600);
    cursorX += measureWidthWithFont(ctx, drawn, chosenSize, 600) + itemGap;
  }
}

function drawInfoCard(ctx: UniApp.CanvasContext, view: MatchShareCardViewModel) {
  const cardX = 56;
  const cardY = 368;
  const cardWidth = MATCH_SHARE_CARD_WIDTH - cardX * 2;
  const cardHeight = 380;

  // 半透明深色毛玻璃圆角卡片。
  drawPill(
    ctx,
    cardX,
    cardY,
    cardWidth,
    cardHeight,
    28,
    "rgba(4, 21, 46, 0.76)",
    "rgba(255, 255, 255, 0.18)",
  );

  const tagX = cardX + 36;
  const valueX = tagX + 116;
  const valueWidth = cardX + cardWidth - 36 - valueX;

  // 第 1 行：比赛时间（高度 116px）
  const timeCenterY = cardY + 58;
  drawRowTag(ctx, "时间", tagX, timeCenterY);
  const timeSize: 38 | 34 | 30 = measureWidthWithFont(ctx, view.timeLabel, 38, 600) <= valueWidth
    ? 38
    : measureWidthWithFont(ctx, view.timeLabel, 34, 600) <= valueWidth
      ? 34
      : 30;
  const [timeLine] = wrapTextLines(
    view.timeLabel,
    valueWidth,
    (text) => measureWidthWithFont(ctx, text, timeSize, 600),
    1,
  );
  drawText(ctx, timeLine || view.timeLabel, valueX, timeCenterY, timeSize, "#fffffe", "left", 600);

  // 分隔线 1
  ctx.setFillStyle("rgba(255, 255, 255, 0.11)");
  ctx.fillRect(tagX, cardY + 116, cardWidth - 72, 2);

  // 第 2 行：比赛地点（高度 146px，支持 1~2 行优雅截断）
  const locationCenterY = cardY + 116 + 73;
  drawRowTag(ctx, "地点", tagX, locationCenterY);
  const locationLines = wrapTextLines(
    view.locationLabel,
    valueWidth,
    (text) => measureWidthWithFont(ctx, text, 34, 500),
    2,
  );
  if (locationLines.length <= 1) {
    drawText(ctx, locationLines[0] || view.locationLabel, valueX, locationCenterY, 34, "#fffffe", "left", 500);
  } else {
    drawText(ctx, locationLines[0]!, valueX, locationCenterY - 24, 34, "#fffffe", "left", 500);
    drawText(ctx, locationLines[1]!, valueX, locationCenterY + 24, 34, "#fffffe", "left", 500);
  }

  // 分隔线 2
  ctx.setFillStyle("rgba(255, 255, 255, 0.11)");
  ctx.fillRect(tagX, cardY + 262, cardWidth - 72, 2);

  // 第 3 行：球服颜色（高度 118px）
  const jerseyCenterY = cardY + 262 + 59;
  drawRowTag(ctx, "球服", tagX, jerseyCenterY);
  drawJerseyRow(ctx, view, valueX, valueWidth, jerseyCenterY);
}

async function resolveFirstAvailableBackdrop(
  backgroundUrls: readonly string[],
  loadImage: (src: string) => Promise<ShareCardImageInfo>,
  isCurrent: () => boolean,
): Promise<ShareCardImageInfo | null> {
  const uniqueUrls = Array.from(
    new Set(backgroundUrls.map((url) => url.trim()).filter(Boolean)),
  );
  for (const url of uniqueUrls) {
    if (!isCurrent()) throw new Error("分享卡内容已更新");
    try {
      const info = await loadImage(url);
      if (info && info.path && info.width > 0 && info.height > 0) {
        return info;
      }
    } catch {
      // 单张候选底图失败时继续尝试下一张，全失败则降级深海蓝底色。
    }
  }
  return null;
}

/**
 * 将比赛时间、地点、球服颜色与对阵信息合成到 1000×800（5:4）微信分享卡片上。
 * 背景图加载失败时自动降级为深海蓝质感底色，不阻断卡片合成。
 */
export async function composeMatchShareCard(
  canvasId: string,
  pageInstance: unknown,
  input: MatchShareCardInput,
  backgroundUrls: readonly string[] = [],
  isCurrent: () => boolean = () => true,
  loadImage: (src: string) => Promise<ShareCardImageInfo> = getImageInfo,
): Promise<string> {
  if (!isCurrent()) throw new Error("分享卡内容已更新");

  const view = buildMatchShareCardViewModel(input);
  const backdrop = await resolveFirstAvailableBackdrop(backgroundUrls, loadImage, isCurrent);
  if (!isCurrent()) throw new Error("分享卡内容已更新");

  const ctx = uni.createCanvasContext(canvasId, pageInstance as never);
  drawBackdrop(ctx, backdrop, MATCH_SHARE_CARD_WIDTH, MATCH_SHARE_CARD_HEIGHT);
  drawHeaderSection(ctx, view);
  drawMatchupSection(ctx, view);
  drawInfoCard(ctx, view);

  return new Promise<string>((resolve, reject) => {
    ctx.draw(false, () => {
      if (!isCurrent()) {
        reject(new Error("分享卡内容已更新"));
        return;
      }
      uni.canvasToTempFilePath(
        {
          canvasId,
          x: 0,
          y: 0,
          width: MATCH_SHARE_CARD_WIDTH,
          height: MATCH_SHARE_CARD_HEIGHT,
          destWidth: MATCH_SHARE_CARD_WIDTH,
          destHeight: MATCH_SHARE_CARD_HEIGHT,
          fileType: "jpg",
          quality: 0.92,
          success: (result) => {
            if (isCurrent()) {
              resolve(result.tempFilePath);
            } else {
              reject(new Error("分享卡内容已更新"));
            }
          },
          fail: reject,
        },
        pageInstance as never,
      );
    });
  });
}
