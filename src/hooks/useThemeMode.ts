import { useEffect, useState } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'

export type ThemeMode = 'light' | 'dark'
const STORAGE_KEY = 'image-search.theme.v1'

// The web experience must remain functional if a native bridge is unavailable.
export async function syncAndroidSystemBars(theme: ThemeMode): Promise<void> {
  if (!isTauri() || typeof navigator === 'undefined' || !/Android/i.test(navigator.userAgent)) return
  try { await invoke('set_android_theme_bars', { theme }) }
  catch { /* native appearance failure must not break the web theme */ }
}
export function readTheme(): ThemeMode {
  try { return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light' }
  catch { return 'light' }
}
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const [theme, setTheme] = useState<ThemeMode>(readTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* private mode */ }
    // Android edge-to-edge inset surfaces belong to the native activity.
    void syncAndroidSystemBars(theme)
  }, [theme])
  return [theme, setTheme]
}
