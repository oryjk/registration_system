import { describe, expect, test } from "bun:test";

const storage = new Map<string, unknown>();

(globalThis as typeof globalThis & { uni: UniApp.Uni }).uni = {
  getStorageSync: (key: string) => storage.get(key) ?? "",
  setStorageSync: (key: string, value: unknown) => {
    storage.set(key, value);
  },
  removeStorageSync: (key: string) => {
    storage.delete(key);
  },
} as UniApp.Uni;

// 主题 store 在模块加载时同步读取本地存储：预置 orange 后再动态导入，验证首屏主题恢复。
storage.set("registration_system_mini_theme_accent", "orange");
const { useAccentTheme } = await import("@/stores/theme");
const { getStoredAccentTheme, setStoredAccentTheme } = await import("@/utils/themeStorage");
const { ACCENT_THEMES, buildAccentThemePageStyle, isAccentThemeId } = await import("@/config/themePalettes");

describe("accent theme palettes", () => {
  test("default lime theme also carries explicit overrides so switching back can replace the page style", () => {
    // uni-h5 对空串 page-style 不更新：默认主题必须返回显式值，否则切回时旧覆盖残留。
    const style = buildAccentThemePageStyle("lime");
    expect(style.includes(`--neo-primitive-accent:${ACCENT_THEMES.lime.accent}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-accent-soft:${ACCENT_THEMES.lime.accentSoft}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-accent-deep:${ACCENT_THEMES.lime.accentDeep}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-accent-rgb:${ACCENT_THEMES.lime.accentRgb}`)).toEqual(true);
    // 青柠主题的 CTA 与 hero 保持墨色默认值。
    expect(style.includes(`--neo-primitive-cta:${ACCENT_THEMES.lime.cta}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-cta-fg:${ACCENT_THEMES.lime.ctaFg}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-hero:${ACCENT_THEMES.lime.hero}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-hero-fg:${ACCENT_THEMES.lime.heroFg}`)).toEqual(true);
  });

  test("orange theme overrides the full accent primitive family", () => {
    const style = buildAccentThemePageStyle("orange");
    expect(style.includes(`--neo-primitive-accent:${ACCENT_THEMES.orange.accent}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-accent-soft:${ACCENT_THEMES.orange.accentSoft}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-accent-deep:${ACCENT_THEMES.orange.accentDeep}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-accent-rgb:${ACCENT_THEMES.orange.accentRgb}`)).toEqual(true);
    // 活力橙主题专属变体：主按钮橙底墨字、hero 与时间条换浅橙底深棕字。
    expect(style.includes(`--neo-primitive-cta:${ACCENT_THEMES.orange.cta}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-cta-fg:${ACCENT_THEMES.orange.ctaFg}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-hero:${ACCENT_THEMES.orange.hero}`)).toEqual(true);
    expect(style.includes(`--neo-primitive-hero-fg:${ACCENT_THEMES.orange.heroFg}`)).toEqual(true);
  });

  test("only known theme ids pass the guard", () => {
    expect(isAccentThemeId("lime")).toEqual(true);
    expect(isAccentThemeId("orange")).toEqual(true);
    expect(isAccentThemeId("dark")).toEqual(false);
    expect(isAccentThemeId("")).toEqual(false);
  });
});

describe("accent theme storage", () => {
  test("unknown stored values fall back to the default theme", () => {
    storage.set("registration_system_mini_theme_accent", "purple");
    expect(getStoredAccentTheme()).toEqual("lime");
    storage.set("registration_system_mini_theme_accent", "orange");
    expect(getStoredAccentTheme()).toEqual("orange");
    setStoredAccentTheme("lime");
    expect(storage.get("registration_system_mini_theme_accent")).toEqual("lime");
  });
});

describe("accent theme store", () => {
  test("restores stored theme at module load and switches with persistence", () => {
    const { accentTheme, themePageStyle, accentHex, setAccentTheme } = useAccentTheme();

    // 模块加载时已从本地恢复 orange。
    expect(accentTheme.value).toEqual("orange");
    expect(themePageStyle.value.includes(`--neo-primitive-accent:${ACCENT_THEMES.orange.accent}`)).toEqual(true);
    expect(accentHex.value).toEqual(ACCENT_THEMES.orange.accent);

    setAccentTheme("lime");
    expect(accentTheme.value).toEqual("lime");
    expect(themePageStyle.value.includes(`--neo-primitive-accent:${ACCENT_THEMES.lime.accent}`)).toEqual(true);
    expect(accentHex.value).toEqual(ACCENT_THEMES.lime.accent);
    expect(storage.get("registration_system_mini_theme_accent")).toEqual("lime");

    setAccentTheme("orange");
    expect(themePageStyle.value.includes(`--neo-primitive-accent:${ACCENT_THEMES.orange.accent}`)).toEqual(true);
    expect(storage.get("registration_system_mini_theme_accent")).toEqual("orange");
  });
});
