import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeOpenverse, searchOpenverse } from './openverse'

afterEach(() => vi.unstubAllGlobals())

const entry = {
  id: 'abc', title: 'Sea', url: 'https://images.example.com/sea.jpg',
  thumbnail: 'https://api.openverse.org/v1/images/abc/thumb/',
  foreign_landing_url: 'https://www.example.com/sea', width: 800, height: 500,
  license: 'by', license_version: '4.0', source: 'flickr',
}
describe('Openverse integration', () => {
  it('normalizes open license results using proxied thumbnails', () => {
    const result = normalizeOpenverse(entry)
    expect(result?.title).toBe('Sea')
    expect(result?.provider).toBe('Openverse · flickr')
    expect(result?.license).toBe('BY 4.0')
  })
  it('rejects unsafe thumbnails and source URLs', () => {
    expect(normalizeOpenverse({...entry, thumbnail: 'https://tracker.example/thumb.jpg'})).toBeNull()
    expect(normalizeOpenverse({...entry, url: 'javascript:alert(1)'})).toBeNull()
    expect(normalizeOpenverse({...entry, mature: true})).toBeNull()
  })
  it('paginates Openverse pages', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ page_count: 3, results: [entry] }) })
    vi.stubGlobal('fetch', fetcher)
    const first = await searchOpenverse('seas', null)
    expect(first.items).toHaveLength(1)
    expect(first.cursor).toBe('2')
    const second = await searchOpenverse('seas', first.cursor)
    expect(second.cursor).toBe('3')
    expect(fetcher.mock.calls[1][0]).toContain('page=2')
  })
  it('keeps healthy images beside malformed API rows and rejects bad envelopes', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [null, { ...entry, title: {} }, entry], page_count: 1 }),
    })
    vi.stubGlobal('fetch', fetcher)
    const page = await searchOpenverse('sea', null)
    expect(page.items.map(item => item.id)).toEqual(['openverse:abc'])
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ results: {} }) })
    await expect(searchOpenverse('sea', null)).rejects.toThrow('Invalid Openverse results')
  })
})
