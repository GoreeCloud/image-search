import { describe, expect, it, vi, afterEach } from 'vitest'
import { isSafeHttpsUrl, normalizePage, searchCommons } from './commons'

afterEach(() => vi.unstubAllGlobals())

describe('image source safety', () => {
  it('rejects spoofed or insecure domains', () => {
    expect(isSafeHttpsUrl('https://upload.wikimedia.org.evil.test/a.jpg', 'upload.wikimedia.org')).toBe(false)
    expect(isSafeHttpsUrl('http://upload.wikimedia.org/a.jpg', 'upload.wikimedia.org')).toBe(false)
    expect(isSafeHttpsUrl('https://upload.wikimedia.org/a.jpg', 'upload.wikimedia.org')).toBe(true)
  })

  it('maps raster Commons images and discards unsupported external images', () => {
    const page = { pageid: 9, title: 'File:Warm_sunrise.jpg', imageinfo: [{
      url: 'https://upload.wikimedia.org/a.jpg',
      thumburl: 'https://upload.wikimedia.org/thumb/a.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:Warm_sunrise.jpg',
      width: 1600, height: 1000,
      extmetadata: { Artist: { value: '<b>A. Creator</b>' }, LicenseShortName: { value: 'CC BY 4.0' } },
    }] }
    const image = normalizePage(page)
    expect(image?.title).toBe('Warm sunrise')
    expect(image?.creator).toBe('A. Creator')
    expect(image?.width).toBe(1600)
    expect(normalizePage({ ...page, imageinfo: [{ url: 'https://evil.test/a.jpg' }] })).toBeNull()
    expect(normalizePage({ ...page, title: 'File:document.pdf' })).toBeNull()
  })

  it('requests a page from Commons with CORS and continuation', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: { pages: [] }, continue: { continue: '||', gsrcontinue: 'next' } }),
    })
    vi.stubGlobal('fetch', fetcher)
    const page = await searchCommons('mountains', null)
    expect(page.items).toEqual([])
    expect(page.cursor).toContain('next')
    expect(fetcher.mock.calls[0][0]).toContain('origin=*')
    await searchCommons('mountains', page.cursor)
    expect(fetcher.mock.calls[1][0]).toContain('gsrcontinue=next')
  })

  it('ignores malformed license metadata without discarding valid images', () => {
    const img = normalizePage({pageid: 18, title: 'File:Cloud.jpg', imageinfo: [{
      url: 'https://upload.wikimedia.org/cloud.jpg',
      extmetadata: {LicenseUrl: {value: 'not a URL'}},
    }]})
    expect(img?.licenseUrl).toBeNull()
    expect(img?.id).toBe('commons:18')
  })

  it('handles source errors without leaking response payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    await expect(searchCommons('cats', null)).rejects.toThrow('busy')
  })

  it('keeps valid Commons pages when other page objects are malformed', async () => {
    const good = { pageid: 15, title: 'File:Sea.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/sea.jpg' }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: { pages: [null, { ...good, imageinfo: [null] }, good] } }),
    }))
    const response = await searchCommons('sea', null)
    expect(response.items.map(item => item.id)).toEqual(['commons:15'])
  })
})

it('supports offset pagination returned by the live Commons search API', async () => {
  const mock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ query: { pages: [] }, continue: { gsroffset: 36, continue: 'gsroffset||' } }),
  })
  vi.stubGlobal('fetch', mock)
  const first = await searchCommons('forest', null)
  expect(first.cursor).toContain('gsroffset')
  await searchCommons('forest', first.cursor)
  expect(mock.mock.calls[1][0]).toContain('gsroffset=36')
})
