/**
 * 强调色主题配置：青柠（默认）与活力橙。
 * 主题切换通过 page-meta 的 page-style 覆盖 page 级 CSS 变量实现，
 * 因此主题值必须以字面量形式提供（token 文件里是同一套默认值）。
 */
export type AccentThemeId = "lime" | "orange";

export interface AccentThemePalette {
  id: AccentThemeId;
  /** 主题展示名。 */
  label: string;
  /** 主强调色，对应 --neo-primitive-accent；原生 switch 等只收 hex 的属性也用它。 */
  accent: string;
  /** 软底色，对应 --neo-primitive-accent-soft。 */
  accentSoft: string;
  /** 软底上的深色文字，对应 --neo-primitive-accent-deep。 */
  accentDeep: string;
  /** 主强调色 RGB 三元组（不含 rgb()），供 rgba() 透明变体使用。 */
  accentRgb: string;
  /** 主按钮底色，对应 --neo-primitive-cta；活力橙主题为橙底墨字。 */
  cta: string;
  /** 主按钮文字色，对应 --neo-primitive-cta-fg。 */
  ctaFg: string;
  /** hero 深底色，对应 --neo-primitive-hero；活力橙主题换暖棕。 */
  hero: string;
  /** hero 底上的文字色，对应 --neo-primitive-hero-fg；两套主题均为白色系。 */
  heroFg: string;
}

export const DEFAULT_ACCENT_THEME: AccentThemeId = "lime";

export const ACCENT_THEMES: Record<AccentThemeId, AccentThemePalette> = {
  lime: {
    id: "lime",
    label: "青柠",
    accent: "#b9f24b",
    accentSoft: "#dff8a8",
    accentDeep: "#4f6800",
    accentRgb: "185, 242, 75",
    cta: "#111310",
    ctaFg: "#fffdf8",
    hero: "#172018",
    heroFg: "#fffdf8",
  },
  orange: {
    id: "orange",
    label: "活力橙",
    accent: "#ff8a2b",
    accentSoft: "#ffd9ae",
    accentDeep: "#7a4500",
    accentRgb: "255, 138, 43",
    cta: "#ff8a2b",
    ctaFg: "#111310",
    hero: "#2b1c0e",
    heroFg: "#fffdf8",
  },
};

export function isAccentThemeId(value: unknown): value is AccentThemeId {
  return value === "lime" || value === "orange";
}

/**
 * 生成注入 page-meta page-style 的变量覆盖串。
 * 每个主题（含默认青柠）都返回显式值：uni-h5 对空串不更新 page style，
 * 若默认主题返回空串，从其他主题切回时旧覆盖会残留在 uni-page-body 上。
 */
export function buildAccentThemePageStyle(theme: AccentThemeId): string {
  const palette = ACCENT_THEMES[theme];
  return [
    `--neo-primitive-accent:${palette.accent}`,
    `--neo-primitive-accent-soft:${palette.accentSoft}`,
    `--neo-primitive-accent-deep:${palette.accentDeep}`,
    `--neo-primitive-accent-rgb:${palette.accentRgb}`,
    `--neo-primitive-cta:${palette.cta}`,
    `--neo-primitive-cta-fg:${palette.ctaFg}`,
    `--neo-primitive-hero:${palette.hero}`,
    `--neo-primitive-hero-fg:${palette.heroFg}`,
  ].join(";");
}
