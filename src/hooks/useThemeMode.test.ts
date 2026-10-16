import { expect, it, vi } from 'vitest'
import { readTheme } from './useThemeMode'

it('defaults to dark and reads light mode preference safely', () => {
  const get=vi.spyOn(Storage.prototype, 'getItem')
  get.mockReturnValueOnce(null).mockReturnValueOnce('light').mockReturnValueOnce('other')
  expect(readTheme()).toBe('dark')
  expect(readTheme()).toBe('light')
  expect(readTheme()).toBe('dark')
  get.mockRestore()
})
