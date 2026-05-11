export type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'admin_theme'

export const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const applyTheme = (theme: ThemeMode) => {
  document.documentElement.setAttribute('data-theme', theme)
}

export const saveTheme = (theme: ThemeMode) => {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export const initTheme = (): ThemeMode => {
  const theme = getInitialTheme()
  applyTheme(theme)
  return theme
}
