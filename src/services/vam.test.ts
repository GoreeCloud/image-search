import { afterEach, expect, it, vi } from 'vitest'
import { normalizeVam, searchVam } from './vam'

afterEach(() => vi.unstubAllGlobals())

const fixture = {
  systemNumber: 'O1161012', _primaryTitle: 'Nature',
  _primaryMaker: {name:'Boizot, Louis-Simon'}, _primaryImageId: '2010EB9765', _warningTypes:[],
}

it('builds image URLs on the official V&A IIIF host and preserves source attribution', () => {
  const image = normalizeVam(fixture)
  expect(image?.provider).toBe('Victoria and Albert Museum')
  expect(image?.sourceUrl).toBe('https://collections.vam.ac.uk/item/O1161012/')
  expect(image?.thumbnailUrl).toBe('https://framemark.vam.ac.uk/collections/2010EB9765/full/!600,600/0/default.jpg')
  expect(image?.url).toContain('/full/full/0/default.jpg')
  expect(image?.dimensionsKnown).toBe(false)
  expect(image?.license).toContain('Check V&A')
})

it('rejects missing image identifiers, restriction warnings, and unsafe IDs', () => {
  expect(normalizeVam({...fixture,_primaryImageId:''})).toBeNull()
  expect(normalizeVam({...fixture,_primaryImageId:'evil.test/../../image'})).toBeNull()
  expect(normalizeVam({...fixture,systemNumber:'O1/?redirect=evil'})).toBeNull()
  expect(normalizeVam({...fixture,_warningTypes:['image-rights']})).toBeNull()
})

it('requests image-only results with bounded pagination', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ok:true,json:async()=>({info:{pages:3500},records:[fixture]})})
  vi.stubGlobal('fetch',fetchMock)
  const first = await searchVam('nature',null)
  expect(first.items).toHaveLength(1)
  expect(first.cursor).toBe('2')
  expect(fetchMock.mock.calls[0][0]).toContain('images_exist=true')
  expect(fetchMock.mock.calls[0][0]).toContain('page_size=20')
  await searchVam('nature','2')
  expect(fetchMock.mock.calls[1][0]).toContain('page=2')
  expect((await searchVam('nature','100')).cursor).toBeNull()
  for (const cursor of ['0','101','2.5','2junk','01','-1']) {
    await expect(searchVam('nature',cursor)).rejects.toThrow('cursor')
  }
})
