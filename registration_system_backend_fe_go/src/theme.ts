import { useEffect, useState } from "react";

export type AdminTheme = "dark" | "light";

const THEME_STORAGE_KEY = "registration-admin-theme";
const THEME_CHANGE_EVENT = "registration-admin-theme-change";

export function resolveTheme(value: string | null): AdminTheme {
  return value === "light" ? "light" : "dark";
}

export function readStoredTheme(): AdminTheme {
  try {
    return resolveTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: AdminTheme): void {
  document.documentElement.classList.toggle("light", theme === "light");
}

export function activateTheme(theme: AdminTheme): void {
  const switchTheme = () => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // localStorage 不可用时仅当前会话内生效
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (reduceMotion || typeof document.startViewTransition !== "function") {
    switchTheme();
    return;
  }
  // 支持 View Transitions 的浏览器走从右向左的主题擦除动画（见 foundation.css）
  document.startViewTransition(switchTheme);
}

/**
 * 订阅主题变化并触发重渲染；ECharts 等在运行时读取 CSS 变量取色的模块依赖它刷新。
 */
export function useAdminTheme(): AdminTheme {
  const [theme, setTheme] = useState<AdminTheme>(() =>
    typeof document === "undefined"
      ? "dark"
      : document.documentElement.classList.contains("light")
        ? "light"
        : "dark",
  );

  useEffect(() => {
    const onChange = () =>
      setTheme(
        document.documentElement.classList.contains("light") ? "light" : "dark",
      );
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  return theme;
}
