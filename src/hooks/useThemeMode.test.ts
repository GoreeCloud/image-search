import { expect, it, vi } from 'vitest'
import { readTheme } from './useThemeMode'

it('defaults to the light mockup and honors an explicit dark preference', () => {
  const get=vi.spyOn(Storage.prototype, 'getItem')
  get.mockReturnValueOnce(null).mockReturnValueOnce('dark').mockReturnValueOnce('other')
  expect(readTheme()).toBe('light')
  expect(readTheme()).toBe('dark')
  expect(readTheme()).toBe('light')
  get.mockRestore()
})
