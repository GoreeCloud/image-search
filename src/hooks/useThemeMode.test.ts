import { expect, it, vi } from 'vitest'
import { readTheme } from './useThemeMode'

it('defaults to light while preserving explicit preferences', () => {
  const get = vi.spyOn(Storage.prototype, 'getItem')
  get.mockReturnValueOnce(null).mockReturnValueOnce('light')
    .mockReturnValueOnce('dark').mockReturnValueOnce('unknown')
  expect(readTheme()).toBe('light')
  expect(readTheme()).toBe('light')
  expect(readTheme()).toBe('dark')
  expect(readTheme()).toBe('light')
  get.mockRestore()
})

it('uses light when local storage is restricted', () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Restricted storage')
  })
  expect(readTheme()).toBe('light')
  get.mockRestore()
})
