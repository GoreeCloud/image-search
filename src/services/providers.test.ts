import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { uniqueImages, searchAllSources } from './providers'
import { searchOpenverse } from './openverse'
import { searchCommons } from './commons'
import { searchLoC } from './loc'
import { searchNasa } from './nasa'
import { searchCma } from './cleveland'
import { searchMet } from './met'
import { searchEuropeana } from './europeana'
import { searchWikipedia } from './wikipedia'
import { searchArtic } from './artic'
import { searchWebImages } from './webImages'
import { setEuropeanaKey } from './apiKeys'

vi.mock('./openverse', () => ({ searchOpenverse: vi.fn() }))
vi.mock('./commons', () => ({ searchCommons: vi.fn() }))
vi.mock('./loc', () => ({ searchLoC: vi.fn() }))
vi.mock('./nasa', () => ({ searchNasa: vi.fn() }))
vi.mock('./cleveland', () => ({ searchCma: vi.fn() }))
vi.mock('./met', () => ({ searchMet: vi.fn() }))
vi.mock('./europeana', () => ({ searchEuropeana: vi.fn() }))
vi.mock('./wikipedia', () => ({ searchWikipedia: vi.fn() }))
vi.mock('./artic', () => ({ searchArtic: vi.fn() }))
vi.mock('./webImages', () => ({ searchWebImages: vi.fn() }))
beforeEach(() => { vi.mocked(searchWebImages).mockResolvedValue({ items: [], cursor: null }) })
afterEach(() => { vi.clearAllMocks(); setEuropeanaKey('') })
const image = {id:'example', title:'Example',url:'https://example.com/a.jpg',thumbnailUrl:'https://example.com/a.jpg',sourceUrl:'https://example.com',description:'',creator:'x',license:'x',licenseUrl:null,width:4,height:3,provider:'test'}
it('deduplicates repeated IDs while keeping their initial order', () => {
  expect(uniqueImages([image,{...image,title:'second'}])).toEqual([image])
  expect(uniqueImages([image,{...image,id:'new',title:'second'}])).toEqual([image])
})
it('collects available providers when another provider fails', async () => {
  vi.mocked(searchOpenverse).mockResolvedValue({ items:[image], cursor:'2' })
  vi.mocked(searchCommons).mockRejectedValue(new Error('offline'))
  vi.mocked(searchLoC).mockResolvedValue({items:[{...image,id:'art',url:'https://example.com/art.jpg'}],cursor:null})
  vi.mocked(searchNasa).mockResolvedValue({items:[],cursor:null})
  vi.mocked(searchCma).mockResolvedValue({items:[{...image,id:'museum',url:'https://example.com/museum.jpg'}],cursor:null})
  vi.mocked(searchWikipedia).mockResolvedValue({items:[],cursor:null})
  vi.mocked(searchArtic).mockResolvedValue({items:[],cursor:null})
  vi.mocked(searchMet).mockResolvedValue({items:[{...image,id:'met',url:'https://example.com/met.jpg'}],cursor:null})
  const page=await searchAllSources('nature',null)
  expect(page.items.map(x => x.id)).toEqual(['example','art','museum','met'])
  expect(page.cursor).toContain('openverse')
  expect(page.cursor).toContain('commons')
})
it('handles every provider failing', async () => {
  for (const mock of [searchWebImages, searchOpenverse, searchCommons, searchLoC, searchNasa, searchCma, searchMet, searchWikipedia, searchArtic]) vi.mocked(mock).mockRejectedValue(new Error('down'))
  await expect(searchAllSources('nature',null)).rejects.toThrow('temporarily unavailable')
})

it('includes optional Europeana only when a session key is configured', async () => {
  for (const mock of [searchOpenverse, searchCommons, searchLoC, searchNasa, searchCma, searchMet, searchWikipedia, searchArtic]) vi.mocked(mock).mockResolvedValue({items:[],cursor:null})
  vi.mocked(searchEuropeana).mockResolvedValue({items:[{...image,id:'europeana'}],cursor:null})
  await searchAllSources('flowers',null)
  expect(searchEuropeana).not.toHaveBeenCalled()
  setEuropeanaKey('sample-client-key')
  const after=await searchAllSources('flowers',null)
  expect(after.items.map(item=>item.id)).toContain('europeana')
})

it('shows screenshot-rich sources first for technology searches', async () => {
  vi.mocked(searchOpenverse).mockResolvedValue({items:[{...image,id:'open'}],cursor:null})
  vi.mocked(searchCommons).mockResolvedValue({items:[{...image,id:'commons',url:'https://example.com/commons.jpg'}],cursor:null})
  vi.mocked(searchWikipedia).mockResolvedValue({items:[{...image,id:'wikipedia',url:'https://example.com/wiki.jpg'}],cursor:null})
  for (const mock of [searchLoC, searchNasa, searchCma, searchMet]) vi.mocked(mock).mockResolvedValue({items:[],cursor:null})
  const result=await searchAllSources('Samsung One UI',null)
  expect(result.items.map(x=>x.id).slice(0,3)).toEqual(['commons','wikipedia','open'])
})

it('queries GoreeCloud Search by default and prioritizes its image results', async () => {
  vi.mocked(searchWebImages).mockResolvedValue({items:[{...image,id:'web',url:'https://example.com/goreecloud.jpg'}],cursor:null})
  for (const mock of [searchOpenverse, searchCommons, searchLoC, searchNasa, searchCma, searchMet, searchWikipedia]) vi.mocked(mock).mockResolvedValue({items:[],cursor:null})
  const page = await searchAllSources('Samsung One UI', null)
  expect(searchWebImages).toHaveBeenCalledWith('Samsung One UI', null, undefined)
  expect(page.items[0].id).toBe('web')
})

it('keeps curated results and marks the web source unavailable if its service is offline', async () => {
  vi.mocked(searchWebImages).mockRejectedValue(new Error('backend unavailable'))
  vi.mocked(searchCommons).mockResolvedValue({items:[image],cursor:null})
  for (const mock of [searchOpenverse, searchLoC, searchNasa, searchCma, searchMet, searchWikipedia]) vi.mocked(mock).mockResolvedValue({items:[],cursor:null})
  const page=await searchAllSources('Samsung One UI',null)
  expect(page.items).toEqual([image])
  expect(page.unavailableSources).toContain('web')
  expect(page.cursor).toBeNull()
})
