import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/discovery.css', import.meta.url), 'utf8')

describe('mobile mockup touch-area contract', () => {
  it('expands filter and image-action taps without enlarging the approved visible buttons', () => {
    assert.match(css, /\.filter-trigger\s*\{[^}]*width:\s*38px;\s*height:\s*38px;/)
    assert.match(css, /\.filter-trigger::after\s*\{[^}]*inset:\s*-3px;/)
    assert.match(css, /\.tile-actions button\s*\{[^}]*width:\s*38px;\s*height:\s*38px;/)
    assert.match(css, /\.tile-actions button::after\s*\{[^}]*inset:\s*-3px;/)
    // Visual button + transparent 3px on all sides = 44px touch area.
    assert.equal(38 + 3 * 2, 44)
  })

  it('keeps three independent expanded targets inside two 320px viewport columns', () => {
    const viewport = 320
    const pagePadding = 16
    const columnGap = 8
    const tileWidth = (viewport - pagePadding * 2 - columnGap) / 2
    const visualButtons = 3 * 38
    const gaps = 2 * 6
    const inset = 7
    const expansion = 3
    assert.match(css, /\.tile-actions\s*\{\s*right:\s*7px;\s*bottom:\s*7px;\s*gap:\s*6px;/)
    assert.ok(visualButtons + gaps + 2 * inset <= tileWidth)
    assert.ok(inset >= expansion)
    assert.ok(6 >= 2 * expansion) // Expanded neighboring targets do not overlap.
  })
})
