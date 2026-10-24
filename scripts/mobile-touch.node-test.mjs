import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/discovery.css', import.meta.url), 'utf8')

// At 393 CSS pixels, “Results for mountain” and a museum source exceed one row.
// The toolbar must wrap while headings remain breakable for narrower screens.
describe('mobile search-results toolbar', () => {
  it('wraps lengthy headings and source names without overlapping them', () => {
    const mobile = css.slice(css.indexOf('@media (max-width: 680px)'))
    assert.match(mobile, /\.results-toolbar\s*\{[^}]*flex-wrap:\s*wrap;/)
    assert.match(mobile, /\.results-title\s*\{[^}]*max-width:\s*100%;/)
    assert.match(mobile, /\.results-title h2\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/)
    assert.match(mobile, /\.toolbar-filters\s*\{[^}]*flex:\s*0 0 auto;/)
  })
})

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
