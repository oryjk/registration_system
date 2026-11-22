export interface KitColorOption {
  name: string;
  shortName: string;
  value: string;
}

/** 球队球服 14 色板（与原 TeamColorPicker.vue 保持一致）。 */
export const KIT_COLOR_OPTIONS: readonly KitColorOption[] = [
  { name: "白色", shortName: "白", value: "#FFFFFF" },
  { name: "绿色", shortName: "绿", value: "#22C55E" },
  { name: "红色", shortName: "红", value: "#EF4444" },
  { name: "蓝色", shortName: "蓝", value: "#2F6BFF" },
  { name: "黑色", shortName: "黑", value: "#111310" },
  { name: "黄色", shortName: "黄", value: "#FACC15" },
  { name: "橙色", shortName: "橙", value: "#FF6B35" },
  { name: "紫色", shortName: "紫", value: "#B34DFF" },
  { name: "粉色", shortName: "粉", value: "#EC4899" },
  { name: "青色", shortName: "青", value: "#06B6D4" },
  { name: "天蓝", shortName: "天蓝", value: "#38BDF8" },
  { name: "荧光绿", shortName: "荧光绿", value: "#C8FF00" },
  { name: "银灰", shortName: "银灰", value: "#D8DDE6" },
  { name: "灰色", shortName: "灰", value: "#94A3B8" },
] as const;

const LEGACY_HEX_NAMES: Record<string, { name: string; shortName: string }> = {
  "#ffffff": { name: "白色", shortName: "白" },
  "#ff0000": { name: "红色", shortName: "红" },
  "#000000": { name: "黑色", shortName: "黑" },
  "#0000ff": { name: "蓝色", shortName: "蓝" },
  "#00ff00": { name: "绿色", shortName: "绿" },
  "#008000": { name: "绿色", shortName: "绿" },
  "#ffff00": { name: "黄色", shortName: "黄" },
};

const NAMED_COLOR_TO_HEX: Record<string, string> = {
  白色: "#FFFFFF",
  红色: "#EF4444",
  黑色: "#111310",
  蓝色: "#2F6BFF",
  绿色: "#22C55E",
  黄色: "#FACC15",
  橙色: "#FF6B35",
  紫色: "#B34DFF",
  粉色: "#EC4899",
  青色: "#06B6D4",
  天蓝: "#38BDF8",
  荧光绿: "#C8FF00",
  银灰: "#D8DDE6",
  灰色: "#94A3B8",
  white: "#FFFFFF",
  red: "#EF4444",
  black: "#111310",
  blue: "#2F6BFF",
  green: "#22C55E",
  yellow: "#FACC15",
};

const PALETTE_BY_HEX = new Map<string, { name: string; shortName: string }>(
  KIT_COLOR_OPTIONS.map((item) => [item.value.toLowerCase(), { name: item.name, shortName: item.shortName }]),
);

/** 将输入的颜色字符串规范化为 6 位大写 hex；无法识别时返回空串。 */
export function normalizeKitColorHex(value?: string | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(lower)) {
    return lower.toUpperCase();
  }
  if (/^#[0-9a-f]{3}$/.test(lower)) {
    const expanded = `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`;
    return expanded.toUpperCase();
  }
  return NAMED_COLOR_TO_HEX[trimmed] ?? NAMED_COLOR_TO_HEX[lower] ?? "";
}

/** 按色值查找标准中文色名（如 #FFFFFF -> "白色"）；找不到返回空串。 */
export function findKitColorName(hex?: string | null): string {
  const normalized = normalizeKitColorHex(hex);
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  return PALETTE_BY_HEX.get(lower)?.name ?? LEGACY_HEX_NAMES[lower]?.name ?? "";
}

/** 按色值查找短色名（用于紧凑搭配文案，如 "白"、"荧光绿"）。 */
export function findKitColorShortName(hex?: string | null): string {
  const normalized = normalizeKitColorHex(hex);
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  return PALETTE_BY_HEX.get(lower)?.shortName ?? LEGACY_HEX_NAMES[lower]?.shortName ?? "";
}

/** 判断颜色是否偏浅（相对亮度 >= 0.72），用于自动选择深/浅细边框。 */
export function isLightKitColor(hex?: string | null): boolean {
  const normalized = normalizeKitColorHex(hex);
  if (!normalized) return false;
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance >= 0.72;
}

/**
 * 为球服色块/图标计算自动对比边框色：
 * 浅色配深色细边框，深色配浅色细边框。
 */
export function kitStrokeColor(hex?: string | null, onDark = false): string {
  if (isLightKitColor(hex)) {
    return onDark ? "rgba(15, 23, 42, 0.36)" : "rgba(0, 33, 77, 0.28)";
  }
  return onDark ? "rgba(255, 255, 255, 0.78)" : "rgba(255, 255, 255, 0.52)";
}

export interface KitColorParts {
  shirt?: string | null;
  shorts?: string | null;
  socks?: string | null;
}

function resolvePieceLabel(raw: string | null | undefined, suffix: "衣" | "裤" | "袜"): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const shortName = findKitColorShortName(trimmed);
  if (shortName) return `${shortName}${suffix}`;
  const normalized = normalizeKitColorHex(trimmed);
  if (normalized) return `自定义${suffix}`;
  return `${trimmed}${suffix}`;
}

/**
 * 格式化球服搭配摘要：
 * - 全设：白衣 · 黑裤 · 白袜
 * - 有裤无袜：白衣 · 黑裤
 * - 无裤有袜：白衣 · 白袜
 * - 仅上衣：白衣
 * - 均未设：队服待定
 */
export function formatKitSummary(parts: KitColorParts): string {
  const tokens = [
    resolvePieceLabel(parts.shirt, "衣"),
    resolvePieceLabel(parts.shorts, "裤"),
    resolvePieceLabel(parts.socks, "袜"),
  ].filter(Boolean);
  return tokens.length > 0 ? tokens.join(" · ") : "队服待定";
}
