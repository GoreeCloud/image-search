import { afterEach, expect, it, vi } from 'vitest'
import { normalizeWellcome, searchWellcome } from './wellcome'

afterEach(() => vi.unstubAllGlobals())

const fixture = {
  id: 'sawp4w54', aspectRatio: 0.93,
  source: { id: 'dxpwxn3s', title: 'The human nature library.' },
  thumbnail: {
    url: 'https://iiif.wellcomecollection.org/image/L0001965/info.json',
    credit: 'Wellcome Collection',
    license: { id: 'pdm', label: 'Public Domain Mark', url: 'https://creativecommons.org/share-your-work/public-domain/pdm/' },
    accessConditions: [{status:{id:'open'}}],
  },
}

it('maps an open IIIF image and preserves record-specific rights', () => {
  const image = normalizeWellcome(fixture)
  expect(image?.provider).toBe('Wellcome Collection')
  expect(image?.sourceUrl).toBe('https://wellcomecollection.org/works/dxpwxn3s')
  expect(image?.thumbnailUrl).toBe('https://iiif.wellcomecollection.org/image/L0001965/full/400,/0/default.jpg')
  expect(image?.url).toContain('/full/full/0/default.jpg')
  expect(image?.license).toBe('Public Domain Mark')
  expect(image?.width).toBe(930)
  expect(normalizeWellcome({...fixture,thumbnail:{...fixture.thumbnail,license:{id:'inc',label:'In copyright',url:'http://example.com/'}}})?.license)
    .toBe('In copyright')
})

it('rejects restricted access, malformed IDs, and spoofed media hosts', () => {
  expect(normalizeWellcome({...fixture,thumbnail:{...fixture.thumbnail,accessConditions:[{status:{id:'restricted'}}]}})).toBeNull()
  expect(normalizeWellcome({...fixture,thumbnail:{...fixture.thumbnail,url:'https://iiif.wellcomecollection.org.evil.test/image/L0001965/info.json'}})).toBeNull()
  expect(normalizeWellcome({...fixture,thumbnail:{...fixture.thumbnail,url:'http://iiif.wellcomecollection.org/image/L0001965/info.json'}})).toBeNull()
  expect(normalizeWellcome({...fixture,source:{id:'javascript:alert(1)',title:'Unsafe'}})).toBeNull()
})

it('queries anonymously and pages with strictly bounded cursors', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ok:true,json:async()=>({results:[fixture],totalPages:2000})})
  vi.stubGlobal('fetch',fetchMock)
  const first = await searchWellcome('nature',null)
  expect(first.items).toHaveLength(1)
  expect(first.cursor).toBe('2')
  expect(fetchMock.mock.calls[0][0]).toContain('pageSize=20')
  expect(fetchMock.mock.calls[0][0]).toContain('page=1')
  const second = await searchWellcome('nature','2')
  expect(second.cursor).toBe('3')
  expect(fetchMock.mock.calls[1][0]).toContain('page=2')
  expect((await searchWellcome('nature','100')).cursor).toBeNull()
  for (const cursor of ['0','101','2.5','2junk','01','-1']) {
    await expect(searchWellcome('nature',cursor)).rejects.toThrow('cursor')
  }
})

it('preserves valid image results when provider metadata has unexpected types', async () => {
  const malformed = {
    ...fixture,
    id: 'malformed1',
    aspectRatio: 'square',
    source: { ...fixture.source, title: 42, contributors: [{ agent: { label: 99 } }] },
    thumbnail: { ...fixture.thumbnail, credit: 123, license: { ...fixture.thumbnail.license, label: 7 } },
  }
  const invalidAccess = { ...fixture, id: 'invalidAccess', thumbnail: { ...fixture.thumbnail, accessConditions: 'restricted' } }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ results: [malformed, invalidAccess, fixture], totalPages: 1 }),
  }))
  const page = await searchWellcome('nature', null)
  expect(page.items).toHaveLength(2)
  expect(page.items[0]).toMatchObject({
    title: 'Untitled collection image', description: 'Wellcome Collection',
    creator: 'Wellcome Collection', license: 'Check source for image rights', dimensionsKnown: false,
  })
  expect(page.items[1].title).toBe('The human nature library.')
})

it('reports malformed provider response envelopes explicitly', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ totalPages: 1 }) }))
  await expect(searchWellcome('nature', null)).rejects.toThrow('Invalid Wellcome Collection response')
})
