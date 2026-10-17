import { afterEach, expect, it, vi } from 'vitest'
import { normalizeWebImage, searchWebImages } from './webImages'

afterEach(() => vi.unstubAllGlobals())

it('ignores invalid search rows without losing valid image results', async () => {
  const good = { img_src: 'https://example.com/image.jpg', url: 'https://example.com/item',
    thumbnail_src: '/thumb.jpg', title: 'Valid image', resolution: '1200x800' }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    results: [null, 12, [], { img_src: 'javascript:alert(1)', url: good.url }, good,
      { ...good, img_src: 'https://example.com/second.png', title: 42,
        content: { not: 'text' }, resolution: '0x0', engine: 37 }],
  }), { headers: { 'Content-Type': 'application/json' } })))

  const result = await searchWebImages('Architecture', null)
  expect(result.items).toHaveLength(2)
  expect(result.items[0]).toMatchObject({ title: 'Valid image', width: 1200, height: 800 })
  expect(result.items[1]).toMatchObject({
    title: 'Web image', description: '', width: 900, height: 700, provider: 'GoreeCloud Search',
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('rejects invalid top-level JSON with a clear provider error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null', {
    headers: { 'Content-Type': 'application/json' },
  })))
  await expect(searchWebImages('Nature', null)).rejects.toThrow('invalid image response')
})

it('does not accept non-HTTPS original URLs or malformed records', () => {
  expect(normalizeWebImage(null, 0, 1)).toBeNull()
  expect(normalizeWebImage({ img_src: 'http://localhost/image', url: 'https://example.com' }, 0, 1)).toBeNull()
  expect(normalizeWebImage({ img_src: 'https://example.com/image', url: 'javascript:void(0)' }, 0, 1)).toBeNull()
})
