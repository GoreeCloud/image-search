import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'
const STORAGE_KEY = 'image-search.theme.v1'
export function readTheme(): ThemeMode {
  try { return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark' }
  catch { return 'dark' }
}
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const [theme, setTheme] = useState<ThemeMode>(readTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* private mode */ }
  }, [theme])
  return [theme, setTheme]
}
