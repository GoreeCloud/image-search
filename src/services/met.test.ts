import { afterEach, expect, it, vi } from 'vitest'
import { normalizeMet, searchMet } from './met'

afterEach(() => vi.unstubAllGlobals())
const art = {
  objectID: 436121, objectURL: 'https://www.metmuseum.org/art/collection/search/436121',
  isPublicDomain: true, title: 'Flowers', artistDisplayName: 'Edgar Degas',
  primaryImageSmall: 'https://images.metmuseum.org/CRDImages/ep/web-large/sample.jpg',
  primaryImage: 'https://images.metmuseum.org/CRDImages/ep/original/sample.jpg',
}

it('normalizes only public-domain artworks with trusted images', () => {
  expect(normalizeMet(art)?.provider).toBe('The Metropolitan Museum of Art')
  expect(normalizeMet(art)?.license).toContain('CC0')
  expect(normalizeMet({...art, isPublicDomain:false})).toBeNull()
  expect(normalizeMet({...art, primaryImageSmall:'https://images.metmuseum.org.evil.test/hi.jpg'})).toBeNull()
})

it('uses the current paginated Met search endpoint and bounds object lookups', async () => {
  const mock=vi.fn().mockImplementation(async (url:string)=>({
    ok:true, json:async()=>url.includes('v1.1/search')
      ? {total:24,objectIDs:[436121]}
      : art,
  }))
  vi.stubGlobal('fetch',mock)
  const first=await searchMet('flowers',null)
  expect(first.items.map(x=>x.id)).toEqual(['met:436121'])
  expect(first.cursor).toBe('12')
  expect(mock.mock.calls[0][0]).toContain('/v1.1/search?')
  await expect(searchMet('flowers','13')).rejects.toThrow('cursor')
})
