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
  /** 主队上衣颜色（HEX 或色名） */
  homeTeamColor?: string;
  /** 主队球裤颜色（HEX 或色名） */
  homeShortsColor?: string;
  /** 主队球袜颜色（HEX 或色名） */
  homeSocksColor?: string;
  /** 客队/对手上衣颜色（HEX 或色名） */
  awayTeamColor?: string;
  /** 客队/对手球裤颜色（HEX 或色名） */
  awayShortsColor?: string;
  /** 客队/对手球袜颜色（HEX 或色名） */
  awaySocksColor?: string;
  /** 比赛自定义分享背景图 URL（用户上传；为空时绘制默认炽烈红黑球场射灯底） */
  customBgImageUrl?: string;
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

export type MatchShareKitPieceKind = "shirt" | "shorts" | "socks";

export interface MatchShareKitPiece {
  kind: MatchShareKitPieceKind;
  /** 规范化 6 位小写 HEX；非可识别色值时为空串 */
  swatch: string;
  /** 规范化色名，如「白色」「荧光绿」 */
  label: string;
  /** 紧凑单件文案，如「白衣」「黑裤」「白袜」「荧光绿衣」 */
  compactText: string;
}

export interface MatchShareTeamKit {
  shirt: ParsedJerseyColor | null;
  shorts: ParsedJerseyColor | null;
  socks: ParsedJerseyColor | null;
  /** 所有已设置的装备件（含纯文本颜色），按 上衣 -> 球裤 -> 球袜 排序 */
  pieces: MatchShareKitPiece[];
  /** 可绘制矢量图标的装备件（仅包含已识别 HEX 色值的件） */
  iconPieces: MatchShareKitPiece[];
  /** 底部紧凑配色文案，如「白衣 · 黑裤 · 白袜」或「队服待定」 */
  summaryText: string;
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
  venueMetaTag: string;
  homeKit: MatchShareTeamKit;
  awayKit: MatchShareTeamKit;
  jerseyItems: MatchShareJerseyItem[];
  jerseyFallbackText: string;
}

export interface ShareCardImageInfo {
  path: string;
  width: number;
  height: number;
}

type CanvasFontWeight = 400 | 500 | 600 | 700 | 800 | 900;

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
const KIT_SUFFIX_PATTERN = /(?:队服|球服|球衣|球裤|球袜|上衣|短裤|长袜|裤子|袜子)$/u;

/** 将 3/6 位 HEX 或中英文色名规范化为画布色值 + 中文标签。 */
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

  const normalizedName = lower.replace(KIT_SUFFIX_PATTERN, "").trim();
  const matched =
    NAMED_JERSEY_COLORS[normalizedName]
    ?? NAMED_JERSEY_COLORS[lower]
    ?? (normalizedName.length > 1 && /[衣裤袜]$/u.test(normalizedName)
      ? NAMED_JERSEY_COLORS[normalizedName.slice(0, -1)]
      : undefined);
  if (matched) return { ...matched };

  return {
    swatch: "",
    label: raw.replace(KIT_SUFFIX_PATTERN, "").trim() || raw,
  };
}

/** 判定装备颜色是否为浅色（白/银灰/荧光绿/黄等），浅色描深边、深色描白边。 */
export function isLightColor(hex?: string | null): boolean {
  if (!hex) return false;
  const clean = hex.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 185;
}

/** 根据装备底色返回高对比描边色。 */
export function strokeForKit(hex: string): string {
  return isLightColor(hex) ? "rgba(15, 23, 42, 0.55)" : "rgba(255, 255, 255, 0.88)";
}

function toCompactColorLabel(label: string): string {
  const chars = Array.from(label.trim());
  if (chars.length === 2 && chars[1] === "色") {
    return chars[0]!;
  }
  return label.trim();
}

function createKitPiece(
  kind: MatchShareKitPieceKind,
  parsed: ParsedJerseyColor | null,
): MatchShareKitPiece | null {
  if (!parsed) return null;
  const suffix = kind === "shirt" ? "衣" : kind === "shorts" ? "裤" : "袜";
  return {
    kind,
    swatch: parsed.swatch,
    label: parsed.label,
    compactText: `${toCompactColorLabel(parsed.label)}${suffix}`,
  };
}

/** 将单支球队的上衣/球裤/球袜字段整理为图标绘制列表与紧凑文案。 */
export function buildTeamKitView(
  shirtRaw?: string | null,
  shortsRaw?: string | null,
  socksRaw?: string | null,
): MatchShareTeamKit {
  const shirt = parseJerseyColor(shirtRaw);
  const shorts = parseJerseyColor(shortsRaw);
  const socks = parseJerseyColor(socksRaw);
  const pieces = [
    createKitPiece("shirt", shirt),
    createKitPiece("shorts", shorts),
    createKitPiece("socks", socks),
  ].filter((item): item is MatchShareKitPiece => item !== null);
  const iconPieces = pieces.filter((item) => Boolean(item.swatch));
  const summaryText = pieces.map((item) => item.compactText).join(" · ") || "队服待定";

  return {
    shirt,
    shorts,
    socks,
    pieces,
    iconPieces,
    summaryText,
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

/** 使用 datetime.ts 将比赛起止时刻格式化为北京时间展示文案（严禁直接截取 ISO 字符串）。 */
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

/** 将比赛详情字段转换为 C2 分享卡绘制所需的规范化视图模型。 */
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
  const venueMetaTag = [formatTag, badgeLabel].filter(Boolean).join(" · ");

  const homeKit = buildTeamKitView(input.homeTeamColor, input.homeShortsColor, input.homeSocksColor);
  const awayKit = buildTeamKitView(input.awayTeamColor, input.awayShortsColor, input.awaySocksColor);

  const jerseyItems: MatchShareJerseyItem[] = [];
  if (homeKit.shirt) {
    jerseyItems.push({
      role: "home",
      roleLabel: "主",
      swatch: homeKit.shirt.swatch,
      label: homeKit.shirt.label,
      displayText: `${homeKit.shirt.label}（主）`,
    });
  }
  if (awayKit.shirt) {
    jerseyItems.push({
      role: "away",
      roleLabel: "客",
      swatch: awayKit.shirt.swatch,
      label: awayKit.shirt.label,
      displayText: `${awayKit.shirt.label}（客）`,
    });
  }

  return {
    badgeLabel,
    formatTag,
    title,
    matchup,
    timeLabel,
    locationLabel,
    venueMetaTag,
    homeKit,
    awayKit,
    jerseyItems,
    jerseyFallbackText: homeKit.pieces.length > 0 || awayKit.pieces.length > 0 ? "" : "队服待定",
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
    evict(src: string) {
      const normalized = src.trim();
      if (normalized) drop(normalized);
    },
    clear() {
      for (const src of Array.from(images.keys())) {
        drop(src);
      }
    },
  };
}

// ==================== Canvas 兼容层 ====================

function setCanvasFont(
  ctx: UniApp.CanvasContext,
  size: number,
  weight: CanvasFontWeight = 700,
  italic = false,
  family = "sans-serif",
) {
  // 先调用 setFontSize，再写 ctx.font，避免微信旧版 CanvasContext 被 setFontSize 冲掉加粗/斜体。
  if (typeof ctx.setFontSize === "function") {
    ctx.setFontSize(size);
  }
  const stylePrefix = italic ? "italic " : "";
  ctx.font = `${stylePrefix}${weight} ${size}px ${family}`;
}

function setCanvasLineJoinRound(ctx: UniApp.CanvasContext) {
  if (typeof ctx.setLineJoin === "function") {
    ctx.setLineJoin("round");
  }
}

function drawStrokeRectCompat(
  ctx: UniApp.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (typeof ctx.strokeRect === "function") {
    ctx.strokeRect(x, y, width, height);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.closePath();
  ctx.stroke();
}

/**
 * 微信小程序 CanvasContext 不支持 createRadialGradient，仅提供 createCircularGradient(x, y, r)；
 * 若运行时也不支持圆形渐变，自动降级为线性渐变或纯色。
 */
function createCircularOrLinearGradient(
  ctx: UniApp.CanvasContext,
  cx: number,
  cy: number,
  radius: number,
  fallbackX0: number,
  fallbackY0: number,
  fallbackX1: number,
  fallbackY1: number,
  stops: ReadonlyArray<readonly [number, string]>,
): UniApp.CanvasGradient | string {
  const compatCtx = ctx as UniApp.CanvasContext & {
    createCircularGradient?: (x: number, y: number, r: number) => UniApp.CanvasGradient;
    createLinearGradient?: (x0: number, y0: number, x1: number, y1: number) => UniApp.CanvasGradient;
  };
  let gradient: UniApp.CanvasGradient | null = null;
  if (typeof compatCtx.createCircularGradient === "function") {
    gradient = compatCtx.createCircularGradient(cx, cy, radius);
  } else if (typeof compatCtx.createLinearGradient === "function") {
    gradient = compatCtx.createLinearGradient(fallbackX0, fallbackY0, fallbackX1, fallbackY1);
  }
  if (!gradient) {
    return stops[0]?.[1] ?? "#200910";
  }
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  return gradient;
}

function measureWidthWithFont(
  ctx: UniApp.CanvasContext,
  value: string,
  size: number,
  weight: CanvasFontWeight = 700,
): number {
  setCanvasFont(ctx, size, weight);
  const measured = ctx.measureText(value)?.width;
  if (typeof measured === "number" && Number.isFinite(measured) && measured > 0) {
    return measured;
  }
  return Array.from(value).length * size;
}

/** 自适应字号拟合：从 startSize 步进缩小至 minSize，仍超宽时优雅拼接省略号。 */
export function fitText(
  ctx: UniApp.CanvasContext,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  weight: CanvasFontWeight = 900,
): { size: number; text: string } {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean || maxWidth <= 0) return { size: startSize, text: "" };

  let size = startSize;
  while (size > minSize) {
    if (measureWidthWithFont(ctx, clean, size, weight) <= maxWidth) {
      return { size, text: clean };
    }
    size = Math.max(minSize, size - 3);
  }

  if (measureWidthWithFont(ctx, clean, minSize, weight) <= maxWidth) {
    return { size: minSize, text: clean };
  }

  let chars = Array.from(clean);
  while (
    chars.length > 1
    && measureWidthWithFont(ctx, `${chars.join("")}…`, minSize, weight) > maxWidth
  ) {
    chars = chars.slice(0, -1);
  }
  return { size: minSize, text: `${chars.join("")}…` };
}

function drawText(
  ctx: UniApp.CanvasContext,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: "left" | "center" | "right" = "left",
  weight: CanvasFontWeight = 700,
  italic = false,
  family = "sans-serif",
) {
  setCanvasFont(ctx, size, weight, italic, family);
  ctx.setFillStyle(color);
  ctx.setTextAlign(align);
  ctx.setTextBaseline("middle");
  ctx.fillText(value, x, y);
}

function drawSlash(
  ctx: UniApp.CanvasContext,
  x: number,
  y: number,
  w: number,
  h: number,
  skew: number,
  fill: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w + skew, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.setFillStyle(fill);
  ctx.fill();
  ctx.restore();
}

// ==================== 矢量球服装备图标（上衣 / 球裤 / 球袜） ====================

export function drawShirtIcon(
  ctx: UniApp.CanvasContext,
  cx: number,
  cy: number,
  size: number,
  fill: string,
) {
  const s = size / 100;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-22, -42);
  ctx.quadraticCurveTo(0, -30, 22, -42);
  ctx.lineTo(48, -22);
  ctx.lineTo(36, 2);
  ctx.lineTo(24, -6);
  ctx.lineTo(24, 44);
  ctx.lineTo(-24, 44);
  ctx.lineTo(-24, -6);
  ctx.lineTo(-36, 2);
  ctx.lineTo(-48, -22);
  ctx.closePath();
  ctx.setFillStyle(fill);
  ctx.fill();
  ctx.setLineWidth(4);
  setCanvasLineJoinRound(ctx);
  ctx.setStrokeStyle(strokeForKit(fill));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-16, -39);
  ctx.quadraticCurveTo(0, -24, 16, -39);
  ctx.setLineWidth(3);
  ctx.setStrokeStyle(isLightColor(fill) ? "rgba(15, 23, 42, 0.32)" : "rgba(255, 255, 255, 0.45)");
  ctx.stroke();
  ctx.restore();
}

export function drawShortsIcon(
  ctx: UniApp.CanvasContext,
  cx: number,
  cy: number,
  size: number,
  fill: string,
) {
  const s = size / 100;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-30, -36);
  ctx.lineTo(30, -36);
  ctx.lineTo(38, 36);
  ctx.lineTo(8, 36);
  ctx.lineTo(0, 6);
  ctx.lineTo(-8, 36);
  ctx.lineTo(-38, 36);
  ctx.closePath();
  ctx.setFillStyle(fill);
  ctx.fill();
  ctx.setLineWidth(4);
  setCanvasLineJoinRound(ctx);
  ctx.setStrokeStyle(strokeForKit(fill));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-29, -24);
  ctx.lineTo(29, -24);
  ctx.setLineWidth(3);
  ctx.setStrokeStyle(isLightColor(fill) ? "rgba(15, 23, 42, 0.28)" : "rgba(255, 255, 255, 0.42)");
  ctx.stroke();
  ctx.restore();
}

export function drawSocksIcon(
  ctx: UniApp.CanvasContext,
  cx: number,
  cy: number,
  size: number,
  fill: string,
) {
  const s = size / 100;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);

  const drawOne = (ox: number, flip: boolean) => {
    const mx = (x: number) => (flip ? -x : x);
    ctx.save();
    ctx.translate(ox, 0);
    ctx.beginPath();
    ctx.moveTo(mx(-12), -40);
    ctx.lineTo(mx(10), -40);
    ctx.lineTo(mx(10), 14);
    ctx.quadraticCurveTo(mx(10), 22, mx(19), 27);
    ctx.quadraticCurveTo(mx(28), 32, mx(23), 40);
    ctx.quadraticCurveTo(mx(15), 45, mx(-2), 36);
    ctx.quadraticCurveTo(mx(-12), 30, mx(-12), 18);
    ctx.closePath();
    ctx.setFillStyle(fill);
    ctx.fill();
    ctx.setLineWidth(4);
    setCanvasLineJoinRound(ctx);
    ctx.setStrokeStyle(strokeForKit(fill));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mx(-11), -28);
    ctx.lineTo(mx(9), -28);
    ctx.setLineWidth(3);
    ctx.setStrokeStyle(isLightColor(fill) ? "rgba(15, 23, 42, 0.28)" : "rgba(255, 255, 255, 0.45)");
    ctx.stroke();
    ctx.restore();
  };

  drawOne(-17, true);
  drawOne(17, false);
  ctx.restore();
}

/** 按需绘制装备横排：仅 1 件（如仅上衣）自动放大 1.18x，缺省项完全不占位。 */
export function drawKitRow(
  ctx: UniApp.CanvasContext,
  items: readonly MatchShareKitPiece[],
  anchorX: number,
  cy: number,
  iconSize: number,
  gap: number,
  align: "left" | "center" | "right" = "center",
): number {
  if (!items.length) return 0;
  const actualSize = items.length === 1 ? iconSize * 1.18 : iconSize;
  const step = actualSize + gap;
  const totalW = items.length * actualSize + (items.length - 1) * gap;
  let startX = anchorX - totalW / 2 + actualSize / 2;
  if (align === "left") startX = anchorX + actualSize / 2;
  if (align === "right") startX = anchorX - totalW + actualSize / 2;

  items.forEach((item, idx) => {
    const x = startX + idx * step;
    if (item.kind === "shirt") drawShirtIcon(ctx, x, cy, actualSize, item.swatch);
    if (item.kind === "shorts") drawShortsIcon(ctx, x, cy, actualSize * 0.92, item.swatch);
    if (item.kind === "socks") drawSocksIcon(ctx, x, cy, actualSize * 0.92, item.swatch);
  });
  return items.length;
}

// ==================== 方案 C2：炽烈球场灯光 · 上下同排横带 ====================

function drawStadiumSpotlights(
  ctx: UniApp.CanvasContext,
  leftAlpha: number,
  rightAlpha: number,
) {
  ctx.save();
  const beam1 = ctx.createLinearGradient(120, 0, 470, 580);
  beam1.addColorStop(0, `rgba(255, 110, 48, ${leftAlpha})`);
  beam1.addColorStop(1, "rgba(255, 110, 48, 0)");
  ctx.setFillStyle(beam1);
  ctx.beginPath();
  ctx.moveTo(60, 0);
  ctx.lineTo(270, 0);
  ctx.lineTo(620, 640);
  ctx.lineTo(290, 640);
  ctx.closePath();
  ctx.fill();

  const beam2 = ctx.createLinearGradient(880, 0, 530, 580);
  beam2.addColorStop(0, `rgba(255, 59, 88, ${rightAlpha})`);
  beam2.addColorStop(1, "rgba(255, 59, 88, 0)");
  ctx.setFillStyle(beam2);
  ctx.beginPath();
  ctx.moveTo(940, 0);
  ctx.lineTo(730, 0);
  ctx.lineTo(380, 640);
  ctx.lineTo(710, 640);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFireBackdrop(ctx: UniApp.CanvasContext, width: number, height: number) {
  const bg = createCircularOrLinearGradient(
    ctx,
    500,
    240,
    740,
    500,
    0,
    500,
    height,
    [
      [0, "#66121E"],
      [0.52, "#200910"],
      [1, "#09090D"],
    ],
  );
  ctx.setFillStyle(bg);
  ctx.fillRect(0, 0, width, height);

  drawStadiumSpotlights(ctx, 0.3, 0.28);

  // 中央巨大镂空 MATCHDAY 暗纹
  ctx.save();
  setCanvasFont(ctx, 156, 900, true, "'Arial Black', Impact, sans-serif");
  ctx.setTextAlign("center");
  ctx.setTextBaseline("middle");
  if (typeof ctx.strokeText === "function") {
    ctx.setStrokeStyle("rgba(255, 255, 255, 0.065)");
    ctx.setLineWidth(4);
    ctx.strokeText("MATCHDAY", 500, 400);
  } else {
    ctx.setFillStyle("rgba(255, 255, 255, 0.04)");
    ctx.fillText("MATCHDAY", 500, 400);
  }
  ctx.restore();
}

function drawCustomPhotoBackdrop(
  ctx: UniApp.CanvasContext,
  backdrop: ShareCardImageInfo,
  width: number,
  height: number,
) {
  ctx.setFillStyle("#09090D");
  ctx.fillRect(0, 0, width, height);

  const ratio = Math.max(width / backdrop.width, height / backdrop.height);
  const drawWidth = backdrop.width * ratio;
  const drawHeight = backdrop.height * ratio;

  ctx.save();
  if (typeof ctx.rect === "function" && typeof ctx.clip === "function") {
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
  }
  ctx.drawImage(
    backdrop.path,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  ctx.restore();

  // 深红黑质感暗幕 + 上下渐变暗角 + 柔和球场射灯，确保任意照片上前景白字与装备清晰锐利。
  ctx.setFillStyle("rgba(18, 7, 11, 0.62)");
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createLinearGradient(0, 0, 0, height);
  vignette.addColorStop(0, "rgba(18, 7, 11, 0.30)");
  vignette.addColorStop(0.5, "rgba(32, 9, 16, 0.14)");
  vignette.addColorStop(1, "rgba(9, 9, 13, 0.48)");
  ctx.setFillStyle(vignette);
  ctx.fillRect(0, 0, width, height);

  drawStadiumSpotlights(ctx, 0.2, 0.18);
}

function drawBackdrop(
  ctx: UniApp.CanvasContext,
  backdrop: ShareCardImageInfo | null,
  width: number,
  height: number,
) {
  if (typeof ctx.clearRect === "function") {
    ctx.clearRect(0, 0, width, height);
  }
  if (backdrop && backdrop.width > 0 && backdrop.height > 0) {
    drawCustomPhotoBackdrop(ctx, backdrop, width, height);
    return;
  }
  drawFireBackdrop(ctx, width, height);
}

function drawTopTimeAndBottomVenue(ctx: UniApp.CanvasContext, view: MatchShareCardViewModel) {
  // 顶部火焰斜切时间条
  drawSlash(ctx, 140, 38, 720, 74, 24, "#FF453A");
  const fittedTime = fitText(ctx, view.timeLabel, 672, 40, 26, 900);
  drawText(ctx, fittedTime.text, 512, 76, fittedTime.size, "#FFFFFF", "center", 900);

  // 底部高对比白底黑字地点条
  ctx.setFillStyle("#FFFFFF");
  ctx.fillRect(0, 712, MATCH_SHARE_CARD_WIDTH, 88);
  ctx.setFillStyle("#FF453A");
  ctx.fillRect(0, 712, 18, 88);

  const suffix = view.venueMetaTag ? `  ·  ${view.venueMetaTag}` : "";
  const fullLine = `📍 ${view.locationLabel}${suffix}`;
  const maxVenueWidth = 932;

  let venueFontSize = 34;
  let venueText = fullLine;
  if (measureWidthWithFont(ctx, fullLine, 34, 900) <= maxVenueWidth) {
    venueFontSize = 34;
    venueText = fullLine;
  } else {
    const fittedFull = fitText(ctx, fullLine, maxVenueWidth, 32, 26, 900);
    if (!fittedFull.text.endsWith("…")) {
      venueFontSize = fittedFull.size;
      venueText = fittedFull.text;
    } else if (suffix) {
      venueFontSize = 26;
      const suffixWidth = measureWidthWithFont(ctx, suffix, venueFontSize, 900);
      const locationBudget = Math.max(180, maxVenueWidth - suffixWidth);
      const fittedLocation = fitText(
        ctx,
        `📍 ${view.locationLabel}`,
        locationBudget,
        venueFontSize,
        venueFontSize,
        900,
      );
      venueText = `${fittedLocation.text}${suffix}`;
    } else {
      const fallbackFit = fitText(ctx, fullLine, maxVenueWidth, 26, 22, 900);
      venueFontSize = fallbackFit.size;
      venueText = fallbackFit.text;
    }
  }

  drawText(ctx, venueText, 508, 757, venueFontSize, "#16070B", "center", 900);
}

function drawTeamBandRow(
  ctx: UniApp.CanvasContext,
  options: {
    y: number;
    accent: string;
    role: string;
    labelColor: string;
    teamName: string;
    pending: boolean;
    kit: MatchShareTeamKit;
  },
) {
  const { y, accent, role, labelColor, teamName, pending, kit } = options;

  // 通栏球队+装备横带
  ctx.setFillStyle("rgba(12, 6, 10, 0.58)");
  ctx.fillRect(42, y, 916, 218);
  // 左侧 14px 能量竖条
  ctx.setFillStyle(accent);
  ctx.fillRect(42, y, 14, 218);
  ctx.setStrokeStyle("rgba(255, 255, 255, 0.12)");
  ctx.setLineWidth(2);
  drawStrokeRectCompat(ctx, 42, y, 916, 218);

  // 左侧：角色标签 + 自适应超大粗体队名（78px 起缩至 46px 并省略）
  drawText(ctx, role, 82, y + 48, 24, labelColor, "left", 800);
  const fittedName = fitText(ctx, teamName, 480, 78, 46, 900);
  drawText(
    ctx,
    fittedName.text,
    80,
    y + 132,
    fittedName.size,
    pending ? "rgba(255, 255, 255, 0.72)" : "#FFFFFF",
    "left",
    900,
  );

  // 右侧同一块内：专属装备子块（x: 584, w: 350）
  ctx.setFillStyle("rgba(255, 255, 255, 0.08)");
  ctx.fillRect(584, y + 20, 350, 178);

  if (kit.iconPieces.length > 0) {
    drawKitRow(ctx, kit.iconPieces, 759, y + 92, 86, 18, "center");
    const fittedSummary = fitText(ctx, kit.summaryText, 326, 24, 18, 800);
    drawText(ctx, fittedSummary.text, 759, y + 168, fittedSummary.size, "#FFFFFF", "center", 800);
  } else {
    const fittedSummary = fitText(ctx, kit.summaryText, 316, 26, 20, 800);
    drawText(
      ctx,
      fittedSummary.text,
      759,
      y + 109,
      fittedSummary.size,
      kit.pieces.length === 0 ? "rgba(255, 255, 255, 0.72)" : "#FFFFFF",
      "center",
      800,
    );
  }
}

function drawVersusSection(
  ctx: UniApp.CanvasContext,
  view: MatchShareCardViewModel,
  matchup: Extract<MatchShareMatchup, { mode: "versus" }>,
) {
  drawTeamBandRow(ctx, {
    y: 152,
    accent: "#FF8A3D",
    role: "主队 HOME",
    labelColor: "#FFD166",
    teamName: matchup.homeName,
    pending: false,
    kit: view.homeKit,
  });

  drawTeamBandRow(ctx, {
    y: 448,
    accent: "#FF3B5C",
    role: "对手 AWAY",
    labelColor: "#FF9EAA",
    teamName: matchup.awayName,
    pending: matchup.awayPending,
    kit: view.awayKit,
  });

  // 中间火焰 VS 撕裂线
  ctx.setFillStyle("#FF6B35");
  ctx.fillRect(42, 407, 386, 6);
  ctx.fillRect(572, 407, 386, 6);
  drawSlash(ctx, 430, 376, 140, 66, 20, "#FF453A");
  drawText(ctx, "VS", 510, 411, 46, "#FFFFFF", "center", 900, true, "'Arial Black', sans-serif");
}

function drawHeadlineSection(
  ctx: UniApp.CanvasContext,
  view: MatchShareCardViewModel,
  matchup: Extract<MatchShareMatchup, { mode: "headline" }>,
) {
  const cardX = 42;
  const cardY = 162;
  const cardW = 916;
  const cardH = 496;

  // 散人约球 / 场馆组局通栏热血大字卡
  ctx.setFillStyle("rgba(12, 6, 10, 0.60)");
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.setFillStyle("#FF8A3D");
  ctx.fillRect(cardX, cardY, 14, cardH);
  ctx.setStrokeStyle("rgba(255, 255, 255, 0.14)");
  ctx.setLineWidth(2);
  drawStrokeRectCompat(ctx, cardX, cardY, cardW, cardH);

  // 顶部标签（如「8人制 · 散人约球 · 欢迎报名」）
  const fittedTag = fitText(ctx, matchup.secondaryText, 820, 28, 22, 800);
  drawText(ctx, fittedTag.text, 500, cardY + 62, fittedTag.size, "#FFD166", "center", 800);

  const hasHomeKit = view.homeKit.pieces.length > 0;
  const hasAwayKit = view.awayKit.pieces.length > 0;
  const hasAnyKit = hasHomeKit || hasAwayKit;

  if (hasAnyKit) {
    const fittedTitle = fitText(ctx, matchup.primaryText, 820, 74, 42, 900);
    drawText(ctx, fittedTitle.text, 500, cardY + 162, fittedTitle.size, "#FFFFFF", "center", 900);

    ctx.setFillStyle("rgba(255, 107, 53, 0.55)");
    ctx.fillRect(140, cardY + 236, 720, 4);

    // 装备展示区
    ctx.setFillStyle("rgba(255, 255, 255, 0.08)");
    ctx.fillRect(140, cardY + 266, 720, 192);

    if (hasHomeKit && hasAwayKit) {
      if (view.homeKit.iconPieces.length > 0) {
        drawKitRow(ctx, view.homeKit.iconPieces, 320, cardY + 340, 74, 14, "center");
      }
      const homeLabel = fitText(ctx, view.homeKit.summaryText, 320, 24, 18, 800);
      drawText(ctx, homeLabel.text, 320, cardY + 420, homeLabel.size, "#FFFFFF", "center", 800);

      ctx.setFillStyle("rgba(255, 255, 255, 0.16)");
      ctx.fillRect(499, cardY + 292, 2, 140);

      if (view.awayKit.iconPieces.length > 0) {
        drawKitRow(ctx, view.awayKit.iconPieces, 680, cardY + 340, 74, 14, "center");
      }
      const awayLabel = fitText(ctx, view.awayKit.summaryText, 320, 24, 18, 800);
      drawText(ctx, awayLabel.text, 680, cardY + 420, awayLabel.size, "#FFFFFF", "center", 800);
    } else {
      const singleKit = hasHomeKit ? view.homeKit : view.awayKit;
      if (singleKit.iconPieces.length > 0) {
        drawKitRow(ctx, singleKit.iconPieces, 500, cardY + 342, 88, 22, "center");
        const label = fitText(ctx, singleKit.summaryText, 660, 26, 20, 800);
        drawText(ctx, label.text, 500, cardY + 424, label.size, "#FFFFFF", "center", 800);
      } else {
        const label = fitText(ctx, singleKit.summaryText, 660, 28, 20, 800);
        drawText(ctx, label.text, 500, cardY + 362, label.size, "#FFFFFF", "center", 800);
      }
    }
    return;
  }

  // 无装备配置时，居中突出超大比赛名称与热血能量条
  const singleFit = fitText(ctx, matchup.primaryText, 820, 78, 52, 900);
  if (!singleFit.text.endsWith("…")) {
    drawText(ctx, singleFit.text, 500, cardY + 226, singleFit.size, "#FFFFFF", "center", 900);
  } else {
    const lines = wrapTextLines(
      matchup.primaryText,
      820,
      (text) => measureWidthWithFont(ctx, text, 56, 900),
      2,
    );
    if (lines.length <= 1) {
      drawText(ctx, lines[0] || matchup.primaryText, 500, cardY + 226, 56, "#FFFFFF", "center", 900);
    } else {
      drawText(ctx, lines[0]!, 500, cardY + 194, 56, "#FFFFFF", "center", 900);
      drawText(ctx, lines[1]!, 500, cardY + 266, 56, "#FFFFFF", "center", 900);
    }
  }

  ctx.setFillStyle("#FF6B35");
  ctx.fillRect(340, cardY + 356, 320, 6);
  drawText(ctx, "队服待定", 500, cardY + 412, 26, "rgba(255, 255, 255, 0.72)", "center", 800);
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
      // 单张自定义底图下载失败时继续尝试下一张，全失败自动无感降级为默认红黑射灯底。
    }
  }
  return null;
}

/**
 * 将比赛时间、对阵球队、衣/裤/袜装备矢量图标与地点信息合成到 1000×800（5:4）微信分享卡片（方案 C2）。
 * 支持自定义背景图铺底 + 深红黑暗幕；未传或加载失败时无感降级为默认炽烈红黑球场射灯底。
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
  const candidateUrls = [
    ...(input.customBgImageUrl?.trim() ? [input.customBgImageUrl.trim()] : []),
    ...backgroundUrls,
  ];
  const backdrop = await resolveFirstAvailableBackdrop(candidateUrls, loadImage, isCurrent);
  if (!isCurrent()) throw new Error("分享卡内容已更新");

  const ctx = uni.createCanvasContext(canvasId, pageInstance as never);
  drawBackdrop(ctx, backdrop, MATCH_SHARE_CARD_WIDTH, MATCH_SHARE_CARD_HEIGHT);
  drawTopTimeAndBottomVenue(ctx, view);
  if (view.matchup.mode === "versus") {
    drawVersusSection(ctx, view, view.matchup);
  } else {
    drawHeadlineSection(ctx, view, view.matchup);
  }

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
