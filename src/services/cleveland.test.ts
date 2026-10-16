import { afterEach, expect, it, vi } from 'vitest'
import { normalizeCma, searchCma } from './cleveland'

afterEach(() => vi.unstubAllGlobals())

const fixture = {
  id: 130391,
  title: 'Spring Flowers',
  url: 'https://clevelandart.org/art/1953.155',
  share_license_status: 'CC0',
  creators: [{description: 'Claude Monet'}],
  images: {
    web: {url: 'https://openaccess-cdn.clevelandart.org/1953.155/1953.155_web.jpg', width: '685',height:'900'},
    print: {url: 'https://openaccess-cdn.clevelandart.org/1953.155/1953.155_print.jpg'},
  },
}

it('normalizes a public-domain image and its exact trusted media host', () => {
  const image = normalizeCma(fixture)
  expect(image?.provider).toBe('Cleveland Museum of Art')
  expect(image?.url).toContain('print.jpg')
  expect(image?.width).toBe(685)
  expect(image?.license).toContain('CC0')
})

it('discards restricted or host-spoofed records', () => {
  expect(normalizeCma({...fixture, share_license_status:'Copyrighted'})).toBeNull()
  expect(normalizeCma({...fixture, images: {web:{url:'https://openaccess-cdn.clevelandart.org.evil.test/pic.jpg'}}})).toBeNull()
  expect(normalizeCma({...fixture, url:'https://external.test/art/123'})).toBeNull()
  expect(normalizeCma({...fixture, images: {web:{url:'http://openaccess-cdn.clevelandart.org/image.jpg'}}})).toBeNull()
})

it('filters to open access, paginates by skip and enforces safe cursors', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({info:{total:60},data:[fixture]}),
  })
  vi.stubGlobal('fetch',fetchMock)
  const first = await searchCma('flowers', null)
  expect(first.items).toHaveLength(1)
  expect(first.cursor).toBe('24')
  expect(fetchMock.mock.calls[0][0]).toContain('cc0=1')
  expect(fetchMock.mock.calls[0][0]).toContain('has_image=1')
  await searchCma('flowers','24')
  expect(fetchMock.mock.calls[1][0]).toContain('skip=24')
  await expect(searchCma('flowers','-1')).rejects.toThrow('cursor')
})
