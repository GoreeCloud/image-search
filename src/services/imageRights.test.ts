import { describe, expect, it } from 'vitest'
import { showCopyrightNotice } from './imageRights'

describe('copyright caution indicator', () => {
  it('displays for general-web results with unverified rights', () => {
    expect(showCopyrightNotice({license:'Web result · rights unverified'})).toBe(true)
    expect(showCopyrightNotice({license:'Check linked image rights'})).toBe(true)
    expect(showCopyrightNotice({license:''})).toBe(true)
  })
  it('shows for copyrighted Creative Commons attribution licenses too', () => {
    expect(showCopyrightNotice({license:'CC BY 4.0'})).toBe(true)
    expect(showCopyrightNotice({license:'CC BY-SA 3.0'})).toBe(true)
  })
  it('hides only for explicitly marked public-domain or CC0 content', () => {
    expect(showCopyrightNotice({license:'CC0 · Open Access'})).toBe(false)
    expect(showCopyrightNotice({license:'Public domain'})).toBe(false)
    expect(showCopyrightNotice({license:'PDM'})).toBe(false)
  })
})
