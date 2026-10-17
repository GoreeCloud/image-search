import { invoke, isTauri } from '@tauri-apps/api/core'
import type { ThemeMode } from '../hooks/useThemeMode'

export const SYSTEM_BAR_COLORS: Record<ThemeMode, string> = {
  light: '#faf9fc',
  dark: '#0e0f12',
}

/** Keep web/PWA browser chrome and the Android system bars in sync. */
export async function applySystemBars(theme: ThemeMode): Promise<void> {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', SYSTEM_BAR_COLORS[theme])
  if (!isTauri() || !/Android/i.test(navigator.userAgent)) return
  try {
    await invoke('set_system_bars_android', { theme })
  } catch (error) {
    // An older native binary may not have the new command yet. Its theme still
    // changes, while supported builds can style status and navigation bars.
    console.warn('Android system bar theming unavailable', error)
  }
}
