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

// 主题 store 在模块加载时同步读取本地存储：预置 blue 后再动态导入，验证首屏主题恢复。
storage.set("registration_system_mini_theme_accent", "orange");
const { useAccentTheme } = await import("@/stores/theme");
const { getStoredAccentTheme, setStoredAccentTheme } = await import("@/utils/themeStorage");
const { ACCENT_THEMES, buildAccentThemePageStyle, isAccentThemeId } = await import("@/config/themePalettes");

describe("accent theme palettes", () => {
  test("now card switches the full primary color family with the theme", () => {
    for (const theme of ["mint", "lime", "blue", "coral", "night"] as const) {
      const palette = ACCENT_THEMES[theme];
      const style = buildAccentThemePageStyle(theme);
      expect(style.includes(`--now-color-accent:${palette.accent}`)).toEqual(true);
      expect(style.includes(`--now-color-accent-text:${palette.accentDeep}`)).toEqual(true);
      expect(style.includes(`--now-color-on-accent:${palette.accentFg}`)).toEqual(true);
      expect(style.includes(`--now-color-soft:${palette.accentSoft}`)).toEqual(true);
      expect(style.includes(`--ui-primitive-accent-fg:${palette.accentFg}`)).toEqual(true);
    }
  });

  test("default lime theme also carries explicit overrides so switching back can replace the page style", () => {
    // uni-h5 对空串 page-style 不更新：默认主题必须返回显式值，否则切回时旧覆盖残留。
    const style = buildAccentThemePageStyle("lime");
    expect(style.includes(`--ui-primitive-accent:${ACCENT_THEMES.lime.accent}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-accent-soft:${ACCENT_THEMES.lime.accentSoft}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-accent-deep:${ACCENT_THEMES.lime.accentDeep}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-accent-rgb:${ACCENT_THEMES.lime.accentRgb}`)).toEqual(true);
    // 青柠主题的 CTA 与 hero 保持墨色默认值。
    expect(style.includes(`--ui-primitive-cta:${ACCENT_THEMES.lime.cta}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-cta-fg:${ACCENT_THEMES.lime.ctaFg}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-hero:${ACCENT_THEMES.lime.hero}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-hero-fg:${ACCENT_THEMES.lime.heroFg}`)).toEqual(true);
  });

  test("blue theme overrides the full accent primitive family", () => {
    const style = buildAccentThemePageStyle("blue");
    expect(style.includes(`--ui-primitive-accent:${ACCENT_THEMES.blue.accent}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-accent-soft:${ACCENT_THEMES.blue.accentSoft}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-accent-deep:${ACCENT_THEMES.blue.accentDeep}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-accent-rgb:${ACCENT_THEMES.blue.accentRgb}`)).toEqual(true);
    // 晴空蓝主题：蓝底白字主按钮，深蓝 hero。
    expect(style.includes(`--ui-primitive-cta:${ACCENT_THEMES.blue.cta}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-cta-fg:${ACCENT_THEMES.blue.ctaFg}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-hero:${ACCENT_THEMES.blue.hero}`)).toEqual(true);
    expect(style.includes(`--ui-primitive-hero-fg:${ACCENT_THEMES.blue.heroFg}`)).toEqual(true);
  });

  test("blue basic colors reset completely when switching back", () => {
    const blue = buildAccentThemePageStyle("blue");
    expect(blue.includes("--ui-primitive-ink:#094067")).toEqual(true);
    expect(blue.includes("--ui-primitive-text-muted:#5f6c7b")).toEqual(true);
    const values = (style: string) => Object.fromEntries(style.split(";").map(item => item.split(":")));
    for (const theme of ["mint", "lime"] as const) {
      const restored = { ...values(blue), ...values(buildAccentThemePageStyle(theme)) };
      expect(restored).toEqual(values(buildAccentThemePageStyle(theme)));
      expect(restored["--ui-primitive-ink"]).toEqual("#00214d");
    }
  });

  test("coral restores and leaves no colors behind when switching to every other theme", () => {
    setStoredAccentTheme("coral");
    expect(getStoredAccentTheme()).toEqual("coral");
    const values = (theme: "mint" | "lime" | "blue" | "coral") =>
      Object.fromEntries(buildAccentThemePageStyle(theme).split(";").map(item => item.split(":")));
    const coral = values("coral");
    expect(coral["--ui-primitive-ink"]).toEqual("#1f1235");
    expect(coral["--ui-primitive-text-muted"]).toEqual("#1b1425");
    expect(coral["--ui-primitive-canvas"]).toEqual("#ffffff");
    expect(coral["--ui-primitive-cta"]).toEqual("#ff6e6c");
    expect(coral["--ui-primitive-secondary"]).toEqual("#67568c");
    expect(coral["--ui-primitive-amber-soft"]).toEqual("#fbdd74");
    for (const theme of ["mint", "lime", "blue"] as const) {
      expect({ ...coral, ...values(theme) }).toEqual(values(theme));
    }
  });

  test("night theme persists and switching back restores light surfaces and status colors", () => {
    setStoredAccentTheme("night");
    expect(getStoredAccentTheme()).toEqual("night");
    const values = (style: string) => Object.fromEntries(style.split(";").map(item => item.split(":")));
    const night = values(buildAccentThemePageStyle("night"));
    expect(night["--ui-primitive-canvas"]).toEqual("#0f0e17");
    expect(night["--ui-primitive-ink"]).toEqual("#fffffe");
    expect(night["--ui-primitive-text-muted"]).toEqual("#a7a9be");
    expect(night["--ui-primitive-cta"]).toEqual("#ff8906");
    expect(night["--ui-primitive-cta-fg"]).toEqual("#fffffe");
    expect(night["--ui-primitive-secondary"]).toEqual("#f25f4c");
    expect(night["--ui-primitive-danger"]).toEqual("#e53170");
    for (const theme of ["mint", "lime", "blue", "coral"] as const) {
      const light = values(buildAccentThemePageStyle(theme));
      expect({ ...night, ...light }).toEqual(light);
      expect(light["--ui-primitive-success-bg"]).toEqual("#e8f5ee");
    }
  });

  test("only known theme ids pass the guard", () => {
    expect(isAccentThemeId("lime")).toEqual(true);
    expect(isAccentThemeId("blue")).toEqual(true);
    expect(isAccentThemeId("coral")).toEqual(true);
    expect(isAccentThemeId("night")).toEqual(true);
    expect(isAccentThemeId("orange")).toEqual(false);
    expect(isAccentThemeId("dark")).toEqual(false);
    expect(isAccentThemeId("")).toEqual(false);
  });
});

describe("accent theme storage", () => {
  test("legacy orange preference migrates to blue and persists", () => {
    storage.set("registration_system_mini_theme_accent", "orange");
    expect(getStoredAccentTheme()).toEqual("blue");
    expect(storage.get("registration_system_mini_theme_accent")).toEqual("blue");
  });
  test("unknown stored values fall back to the default theme", () => {
    storage.set("registration_system_mini_theme_accent", "purple");
    expect(getStoredAccentTheme()).toEqual("mint");
    storage.set("registration_system_mini_theme_accent", "blue");
    expect(getStoredAccentTheme()).toEqual("blue");
    setStoredAccentTheme("lime");
    expect(storage.get("registration_system_mini_theme_accent")).toEqual("lime");
  });
});

describe("accent theme store", () => {
  test("restores stored theme at module load and switches with persistence", () => {
    const { accentTheme, themePageStyle, accentHex, setAccentTheme } = useAccentTheme();

    // 模块加载时已从本地恢复 blue。
    expect(accentTheme.value).toEqual("blue");
    expect(themePageStyle.value.includes(`--ui-primitive-accent:${ACCENT_THEMES.blue.accent}`)).toEqual(true);
    expect(accentHex.value).toEqual(ACCENT_THEMES.blue.accent);

    setAccentTheme("lime");
    expect(accentTheme.value).toEqual("lime");
    expect(themePageStyle.value.includes(`--ui-primitive-accent:${ACCENT_THEMES.lime.accent}`)).toEqual(true);
    expect(accentHex.value).toEqual(ACCENT_THEMES.lime.accent);
    expect(storage.get("registration_system_mini_theme_accent")).toEqual("lime");

    setAccentTheme("blue");
    expect(themePageStyle.value.includes(`--ui-primitive-accent:${ACCENT_THEMES.blue.accent}`)).toEqual(true);
    expect(storage.get("registration_system_mini_theme_accent")).toEqual("blue");
  });
});
