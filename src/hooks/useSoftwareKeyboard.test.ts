import { expect, it } from 'vitest'
import { isKeyboardOccludingViewport } from './useSoftwareKeyboard'

it('detects the real Android keyboard geometry', () => {
  expect(isKeyboardOccludingViewport(784, 483, 0, 384)).toBe(true)
})
it('restores mobile navigation when keyboard closes', () => {
  expect(isKeyboardOccludingViewport(784, 784, 0, 384)).toBe(false)
})
it('ignores minor browser chrome changes and desktop viewport resizing', () => {
  expect(isKeyboardOccludingViewport(784, 690, 0, 384)).toBe(false)
  expect(isKeyboardOccludingViewport(900, 500, 0, 1200)).toBe(false)
})
