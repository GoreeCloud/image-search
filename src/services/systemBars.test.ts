import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { applySystemBars, SYSTEM_BAR_COLORS } from './systemBars'
import { invoke, isTauri } from '@tauri-apps/api/core'
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue({}), isTauri: vi.fn(() => false) }))
beforeEach(() => { document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#111" />') })
afterEach(() => { document.querySelector('meta[name="theme-color"]')?.remove(); vi.clearAllMocks() })
it('changes browser theme-color without native calls', async () => {
  await applySystemBars('light')
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(SYSTEM_BAR_COLORS.light)
  await applySystemBars('dark')
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(SYSTEM_BAR_COLORS.dark)
  expect(invoke).not.toHaveBeenCalled()
})
it('updates Android native system bars in either mode', async () => {
  vi.mocked(isTauri).mockReturnValue(true)
  const mock = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android WebView')
  await applySystemBars('light')
  await applySystemBars('dark')
  expect(invoke).toHaveBeenNthCalledWith(1, 'set_system_bars_android', { theme: 'light' })
  expect(invoke).toHaveBeenNthCalledWith(2, 'set_system_bars_android', { theme: 'dark' })
  mock.mockRestore()
})
