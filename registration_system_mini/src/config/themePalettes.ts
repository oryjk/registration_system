/**
 * 强调色主题配置：薄荷海军蓝（默认）、青柠、晴空蓝、珊瑚紫与曜夜橙。
 * 主题切换通过 page-meta 的 page-style 覆盖 page 级 CSS 变量实现，
 * 因此主题值必须以字面量形式提供（token 文件里是同一套默认值）。
 */
export type AccentThemeId = "mint" | "lime" | "blue" | "coral" | "night";

export interface AccentThemePalette {
  id: AccentThemeId;
  /** 主题展示名。 */
  label: string;
  /** 主强调色，对应 --ui-primitive-accent；原生 switch 等只收 hex 的属性也用它。 */
  accent: string;
  /** 强调色底上的文字；深色主题可配置白字。 */
  accentFg: string;
  /** 软底色，对应 --ui-primitive-accent-soft。 */
  accentSoft: string;
  /** 软底上的深色文字，对应 --ui-primitive-accent-deep。 */
  accentDeep: string;
  /** 主强调色 RGB 三元组（不含 rgb()），供 rgba() 透明变体使用。 */
  accentRgb: string;
  /** 主按钮底色，对应 --ui-primitive-cta；晴空蓝主题为蓝底白字。 */
  cta: string;
  /** 主按钮文字色，对应 --ui-primitive-cta-fg。 */
  ctaFg: string;
  /** hero 深底色，对应 --ui-primitive-hero；晴空蓝主题使用深蓝。 */
  hero: string;
  /** hero 底上的文字色，对应 --ui-primitive-hero-fg；各主题均为白色系。 */
  heroFg: string;
}

export const DEFAULT_ACCENT_THEME: AccentThemeId = "mint";

export const ACCENT_THEMES: Record<AccentThemeId, AccentThemePalette> = {
  mint: {
    id: "mint",
    label: "薄荷蓝",
    accent: "#00ebc7",
    accentFg: "#00214d",
    accentSoft: "#dcfff8",
    accentDeep: "#00214d",
    accentRgb: "0, 235, 199",
    cta: "#00ebc7",
    ctaFg: "#00214d",
    hero: "#00214d",
    heroFg: "#fffffe",
  },
  lime: {
    id: "lime",
    label: "青柠",
    accent: "#b9f24b",
    accentFg: "#111310",
    accentSoft: "#dff8a8",
    accentDeep: "#4f6800",
    accentRgb: "185, 242, 75",
    cta: "#111310",
    ctaFg: "#fffdf8",
    hero: "#172018",
    heroFg: "#fffdf8",
  },
  blue: {
    id: "blue",
    label: "晴空蓝",
    accent: "#3da9fc",
    accentFg: "#fffffe",
    accentSoft: "#e8f4ff",
    accentDeep: "#094067",
    accentRgb: "61, 169, 252",
    cta: "#3da9fc",
    ctaFg: "#fffffe",
    hero: "#094067",
    heroFg: "#fffffe",
  },
  coral: {
    id: "coral",
    label: "珊瑚紫",
    accent: "#ff6e6c",
    accentFg: "#1f1235",
    accentSoft: "#fff0ef",
    accentDeep: "#1f1235",
    accentRgb: "255, 110, 108",
    cta: "#ff6e6c",
    ctaFg: "#1f1235",
    hero: "#1f1235",
    heroFg: "#ffffff",
  },
  night: {
    id: "night",
    label: "曜夜橙",
    accent: "#ff8906",
    accentFg: "#fffffe",
    accentSoft: "#352416",
    accentDeep: "#ffb45c",
    accentRgb: "255, 137, 6",
    cta: "#ff8906",
    ctaFg: "#fffffe",
    hero: "#0f0e17",
    heroFg: "#fffffe",
  },
};

export function isAccentThemeId(value: unknown): value is AccentThemeId {
  return value === "mint" || value === "lime" || value === "blue" || value === "coral" || value === "night";
}

/**
 * 生成注入 page-meta page-style 的变量覆盖串。
 * 每个主题（含默认薄荷蓝）都返回显式值：uni-h5 对空串不更新 page style，
 * 若默认主题返回空串，从其他主题切回时旧覆盖会残留在 uni-page-body 上。
 */
// 每次切换都显式恢复基础色，避免从晴空蓝切回后残留正文、边框等颜色。
const basePrimitives = {
  "icon-filter": "none",
  "success-fg": "#226342",
  "success-bg": "#e8f5ee",
  "warning-fg": "#805414",
  "warning-bg": "#fff3db",
  "danger-fg": "#a13432",
  "danger-bg": "#fdecea",
  "neutral-fg": "#526174",
  "neutral-bg": "#f0f2f5",
  "red-soft": "#ffd2cc",
  surface: "#fffffe",
  canvas: "#fffffe",
  "surface-rgb": "255, 255, 254",
  "amber-soft": "#fde24f",
  "blue-soft": "#dce6ff",
  secondary: "#00214d",
  ink: "#00214d",
  "ink-rgb": "0, 33, 77",
  "text-muted": "#1b2d45",
  "text-disabled": "#666a63",
  muted: "#ece9e1",
  "muted-strong": "#e5e1d9",
  track: "#f0ece4",
  "skeleton-surface": "#f7f3eb",
  "skeleton-block": "#dedad2",
  line: "#e4eaf2",
  "line-strong": "#c6d2df",
  "shadow-rgb": "24, 55, 100",
  danger: "#ff5470",
};
const bluePrimitives: typeof basePrimitives = {
  ...basePrimitives,
  ink: "#094067",
  "ink-rgb": "9, 64, 103",
  "text-muted": "#5f6c7b",
  "text-disabled": "#8796a3",
  muted: "#edf3f8",
  "muted-strong": "#dce7ef",
  track: "#edf3f8",
  "skeleton-surface": "#f4f8fb",
  "skeleton-block": "#dce7ef",
  line: "#e0eaf2",
  "line-strong": "#90b4ce",
  "shadow-rgb": "9, 64, 103",
  secondary: "#90b4ce",
  danger: "#ef4565",
};

const coralPrimitives: typeof basePrimitives = {
  ...basePrimitives,
  surface: "#ffffff",
  canvas: "#ffffff",
  "surface-rgb": "255, 255, 255",
  ink: "#1f1235",
  "ink-rgb": "31, 18, 53",
  "text-muted": "#1b1425",
  "text-disabled": "#94899f",
  muted: "#f3eff7",
  "muted-strong": "#e5dfed",
  track: "#f3eff7",
  "skeleton-surface": "#f8f5fa",
  "skeleton-block": "#e5dfed",
  line: "#e9e2ef",
  "line-strong": "#67568c",
  "shadow-rgb": "31, 18, 53",
  secondary: "#67568c",
  "amber-soft": "#fbdd74",
  "blue-soft": "#ede5f5",
};

const nightPrimitives: typeof basePrimitives = {
  ...basePrimitives,
  "icon-filter": "brightness(0) invert(1)",
  canvas: "#0f0e17",
  surface: "#1b1926",
  "surface-rgb": "27, 25, 38",
  ink: "#fffffe",
  // 遮罩仍用深色，不能随白色标题变成白雾。
  "ink-rgb": "0, 0, 0",
  "text-muted": "#a7a9be",
  "text-disabled": "#777588",
  muted: "#272433",
  "muted-strong": "#343040",
  track: "#302c3d",
  "skeleton-surface": "#242130",
  "skeleton-block": "#373246",
  line: "#343040",
  "line-strong": "#565064",
  "shadow-rgb": "0, 0, 0",
  secondary: "#f25f4c",
  danger: "#e53170",
  "amber-soft": "#49351c",
  "blue-soft": "#292d48",
  "red-soft": "#482735",
  "success-fg": "#8edbb1",
  "success-bg": "#19382b",
  "warning-fg": "#ffd18a",
  "warning-bg": "#3a2d1d",
  "danger-fg": "#ff9db0",
  "danger-bg": "#402030",
  "neutral-fg": "#b8bbce",
  "neutral-bg": "#292633",
};

const themePrimitives: Record<AccentThemeId, typeof basePrimitives> = {
  mint: basePrimitives,
  lime: basePrimitives,
  blue: bluePrimitives,
  coral: coralPrimitives,
  night: nightPrimitives,
};

export function buildAccentThemePageStyle(theme: AccentThemeId): string {
  const palette = ACCENT_THEMES[theme];
  const primitives = themePrimitives[theme];
  return [
    ...Object.entries(primitives).map(([key, value]) => `--ui-primitive-${key}:${value}`),
    `--now-color-accent:${palette.accent}`,
    `--now-color-on-accent:${palette.accentFg}`,
    `--now-color-accent-text:${palette.accentDeep}`,
    `--now-color-soft:${palette.accentSoft}`,
    `--ui-primitive-accent:${palette.accent}`,
    `--ui-primitive-accent-fg:${palette.accentFg}`,
    `--ui-primitive-accent-soft:${palette.accentSoft}`,
    `--ui-primitive-accent-deep:${palette.accentDeep}`,
    `--ui-primitive-accent-rgb:${palette.accentRgb}`,
    `--ui-primitive-cta:${palette.cta}`,
    `--ui-primitive-cta-fg:${palette.ctaFg}`,
    `--ui-primitive-hero:${palette.hero}`,
    `--ui-primitive-hero-fg:${palette.heroFg}`,
  ].join(";");
}

/** Native pull-to-refresh and rubber-band areas cannot read CSS variables. */
export function getThemeWindowBackground(theme: AccentThemeId): string {
  return themePrimitives[theme].canvas;
}
