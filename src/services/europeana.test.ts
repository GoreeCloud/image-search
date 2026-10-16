import { afterEach, expect, it, vi } from 'vitest'
import { normalizeEuropeana, searchEuropeana } from './europeana'
import { getEuropeanaKey, setEuropeanaKey } from './apiKeys'

afterEach(() => { vi.unstubAllGlobals(); setEuropeanaKey('') })
const record = {
  id: '/90402/SK_A_2344',
  type: 'IMAGE',
  title: ['Dutch Painting'],
  dcCreator: ['Artist'],
  edmPreview: ['https://api.europeana.eu/thumbnail/v3/400/preview.jpg'],
  rights: ['http://creativecommons.org/licenses/by/4.0/'],
}

it('normalizes only safely previewable openly reusable records', () => {
  const image = normalizeEuropeana(record)
  expect(image?.provider).toBe('Europeana')
  expect(image?.sourceUrl).toContain('/en/item/90402/SK_A_2344')
  expect(image?.licenseUrl).toContain('creativecommons.org/licenses/by/')
  expect(normalizeEuropeana({...record, previewNoDistribute:true})).toBeNull()
  expect(normalizeEuropeana({...record, rights:['https://rightsstatements.org/InC/']})).toBeNull()
  expect(normalizeEuropeana({...record, edmPreview:['https://api.europeana.eu.evil.example/thumbnail.jpg']})).toBeNull()
  expect(normalizeEuropeana({...record, id:'/../../bad'})).toBeNull()
})

it('sends the user session key in X-Api-Key, never in a URL or storage', async () => {
  setEuropeanaKey('personal-session-key')
  const mocked=vi.fn().mockResolvedValue({ok:true,json:async()=>({items:[record],totalResults:100})})
  vi.stubGlobal('fetch',mocked)
  const result=await searchEuropeana('flowers',null)
  expect(result.items).toHaveLength(1)
  expect(result.cursor).toBe('25')
  expect(mocked.mock.calls[0][0]).not.toContain('personal-session-key')
  expect(mocked.mock.calls[0][1].headers['X-Api-Key']).toBe('personal-session-key')
  expect(mocked.mock.calls[0][0]).toContain('reusability=open')
  expect(getEuropeanaKey()).toBe('personal-session-key')
  await expect(searchEuropeana('flowers','30')).rejects.toThrow('cursor')
})

it('asks for configuration without making a request', async () => {
  await expect(searchEuropeana('flowers',null)).rejects.toThrow('Settings')
  expect(getEuropeanaKey()).toBe('')
})
