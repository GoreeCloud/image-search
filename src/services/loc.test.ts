import { afterEach, expect, it, vi } from 'vitest'
import { normalizeLoC, searchLoC } from './loc'

afterEach(() => vi.unstubAllGlobals())

const fixture = {
  id: 'http://www.loc.gov/item/2019675409/',
  title: 'Flowers',
  contributor: ['Library artist'],
  image_url: [
    'https://tile.loc.gov/storage-services/small_150px.jpg#h=150&w=123',
    'https://tile.loc.gov/storage-services/large.jpg#h=420&w=343',
  ],
}

it('normalizes trusted catalog records and HTTPS source attribution', () => {
  const image = normalizeLoC(fixture)
  expect(image?.provider).toBe('Library of Congress')
  expect(image?.sourceUrl).toBe('https://www.loc.gov/item/2019675409/')
  expect(image?.width).toBe(343)
  expect(image?.thumbnailUrl).toContain('large.jpg')
})

it('rejects restricted, unsafe and missing image records', () => {
  expect(normalizeLoC({...fixture, access_restricted:true})).toBeNull()
  expect(normalizeLoC({...fixture, image_url:['https://tile.loc.gov.evil.example/a.jpg']})).toBeNull()
  expect(normalizeLoC({...fixture, id:'https://malware.example/item/1'})).toBeNull()
})

it('paginates Library of Congress results using server continuation', async () => {
  const mock = vi.fn().mockResolvedValue({
    ok:true,
    json:async()=>({results:[fixture],pagination:{next:'https://www.loc.gov/photos/?sp=2'}}),
  })
  vi.stubGlobal('fetch',mock)
  const first = await searchLoC('flowers',null)
  expect(first.items).toHaveLength(1)
  expect(first.cursor).toBe('2')
  await searchLoC('flowers','2')
  expect(mock.mock.calls[1][0]).toContain('sp=2')
})
