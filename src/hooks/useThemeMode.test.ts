import { afterEach, expect, it, vi } from 'vitest'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { readTheme, syncAndroidSystemBars } from './useThemeMode'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it('defaults to the light mockup and honors an explicit dark preference', () => {
  const get = vi.spyOn(Storage.prototype, 'getItem')
  get.mockReturnValueOnce(null).mockReturnValueOnce('dark').mockReturnValueOnce('other')
  expect(readTheme()).toBe('light')
  expect(readTheme()).toBe('dark')
  expect(readTheme()).toBe('light')
  get.mockRestore()
})

it('synchronizes both appearance modes through the native Android command', async () => {
  vi.mocked(isTauri).mockReturnValue(true)
  vi.mocked(invoke).mockResolvedValue({ applied: true })
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 15)' })
  await syncAndroidSystemBars('dark')
  await syncAndroidSystemBars('light')
  expect(invoke).toHaveBeenNthCalledWith(1, 'set_android_theme_bars', { theme: 'dark' })
  expect(invoke).toHaveBeenNthCalledWith(2, 'set_android_theme_bars', { theme: 'light' })
})

it('does not call the Android bridge from web or desktop', async () => {
  vi.mocked(isTauri).mockReturnValue(false)
  vi.stubGlobal('navigator', { userAgent: 'Android' })
  await syncAndroidSystemBars('dark')
  vi.mocked(isTauri).mockReturnValue(true)
  vi.stubGlobal('navigator', { userAgent: 'Desktop browser' })
  await syncAndroidSystemBars('light')
  expect(invoke).not.toHaveBeenCalled()
})

it('keeps the browser theme usable if the native appearance command fails', async () => {
  vi.mocked(isTauri).mockReturnValue(true)
  vi.stubGlobal('navigator', { userAgent: 'Android' })
  vi.mocked(invoke).mockRejectedValue(new Error('Native bridge unavailable'))
  await expect(syncAndroidSystemBars('dark')).resolves.toBeUndefined()
})
