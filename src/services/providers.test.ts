import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { uniqueImages, searchAllSources } from './providers'
import { searchOpenverse } from './openverse'
import { searchCommons } from './commons'
import { searchLoC } from './loc'
import { searchNasa } from './nasa'
import { searchCma } from './cleveland'
import { searchMet } from './met'
import { searchWellcome } from './wellcome'
import { searchVam } from './vam'
import { searchEuropeana } from './europeana'
import { setEuropeanaKey } from './apiKeys'

vi.mock('./openverse', () => ({ searchOpenverse: vi.fn() }))
vi.mock('./commons', () => ({ searchCommons: vi.fn() }))
vi.mock('./loc', () => ({ searchLoC: vi.fn() }))
vi.mock('./nasa', () => ({ searchNasa: vi.fn() }))
vi.mock('./cleveland', () => ({ searchCma: vi.fn() }))
vi.mock('./met', () => ({ searchMet: vi.fn() }))
vi.mock('./wellcome', () => ({ searchWellcome: vi.fn() }))
vi.mock('./vam', () => ({ searchVam: vi.fn() }))
vi.mock('./europeana', () => ({ searchEuropeana: vi.fn() }))
afterEach(() => { vi.clearAllMocks(); setEuropeanaKey('') })
beforeEach(() => {
  vi.mocked(searchWellcome).mockResolvedValue({items:[],cursor:null})
  vi.mocked(searchVam).mockResolvedValue({items:[],cursor:null})
})
const image = {id:'example', title:'Example',url:'https://example.com/a.jpg',thumbnailUrl:'https://example.com/a.jpg',sourceUrl:'https://example.com',description:'',creator:'x',license:'x',licenseUrl:null,width:4,height:3,provider:'test'}
it('deduplicates repeated IDs while keeping their initial order', () => {
  expect(uniqueImages([image,{...image,title:'second'}])).toEqual([image])
})
it('collects available providers when another provider fails', async () => {
  vi.mocked(searchOpenverse).mockResolvedValue({ items:[image], cursor:'2' })
  vi.mocked(searchCommons).mockRejectedValue(new Error('offline'))
  vi.mocked(searchLoC).mockResolvedValue({items:[{...image,id:'art'}],cursor:null})
  vi.mocked(searchNasa).mockResolvedValue({items:[],cursor:null})
  vi.mocked(searchCma).mockResolvedValue({items:[{...image,id:'museum'}],cursor:null})
  vi.mocked(searchMet).mockResolvedValue({items:[{...image,id:'met'}],cursor:null})
  const page=await searchAllSources('nature',null)
  expect(page.items.map(x => x.id)).toEqual(['example','art','museum','met'])
  expect(page.cursor).toContain('openverse')
  expect(page.cursor).toContain('commons')
  expect(page.unavailableSources).toEqual(['commons'])
})
it('recovers a failed collection when a user retries the preserved cursor', async () => {
  for (const mock of [searchOpenverse, searchCommons, searchLoC, searchNasa, searchCma, searchMet]) {
    vi.mocked(mock).mockResolvedValue({items:[],cursor:null})
  }
  vi.mocked(searchOpenverse).mockResolvedValue({items:[image],cursor:null})
  vi.mocked(searchCommons).mockRejectedValueOnce(new Error('provider timeout'))
  const initial = await searchAllSources('nature',null)
  expect(initial.unavailableSources).toEqual(['commons'])
  expect(initial.cursor).not.toBeNull()
  vi.mocked(searchCommons).mockResolvedValue({
    items:[{...image,id:'commons:new',provider:'Wikimedia Commons'}],cursor:null,
  })
  const retried = await searchAllSources('nature',initial.cursor)
  expect(retried.unavailableSources).toEqual([])
  expect(retried.items.map(item=>item.id)).toEqual(['commons:new'])
  expect(retried.cursor).toBeNull()
})

it('stops a stalled source cursor without blocking other sources from advancing', async () => {
  for (const mock of [searchOpenverse, searchCommons, searchLoC, searchNasa, searchCma, searchMet]) {
    vi.mocked(mock).mockResolvedValue({ items: [], cursor: null })
  }
  vi.mocked(searchOpenverse).mockResolvedValue({ items: [image], cursor: '2' })
  vi.mocked(searchCommons)
    .mockResolvedValueOnce({ items: [], cursor: '5' })
    .mockResolvedValueOnce({ items: [], cursor: '6' })
    .mockResolvedValue({ items: [], cursor: null })

  const first = await searchAllSources('nature', null)
  const second = await searchAllSources('nature', first.cursor)
  expect(JSON.parse(second.cursor!)).toMatchObject({ openverse: null, commons: '6' })

  const third = await searchAllSources('nature', second.cursor)
  expect(third.cursor).toBeNull()
  expect(searchOpenverse).toHaveBeenCalledTimes(2)
  expect(searchCommons).toHaveBeenCalledTimes(3)
})

it('fails closed on malformed or oversized aggregate pagination before provider dispatch', async () => {
  const invalid = [
    '{', '[]', 'false', 'null', '42',
    JSON.stringify({unknown: '1'}),
    '{"__proto__":"1"}',
    JSON.stringify({openverse: 12}),
    JSON.stringify({commons: {continue: 'x'}}),
    JSON.stringify({openverse: 'x'.repeat(2050)}),
    'x'.repeat(8193),
    JSON.stringify({openverse: 'bad' + String.fromCharCode(10) + 'value'}),
  ]
  for (const cursor of invalid) {
    await expect(searchAllSources('flowers', cursor)).rejects.toThrow('Invalid image page cursor')
  }
  expect(searchOpenverse).not.toHaveBeenCalled()
  expect(searchCommons).not.toHaveBeenCalled()
})

it('accepts a bounded aggregate cursor and dispatches only its active sources', async () => {
  vi.mocked(searchOpenverse).mockResolvedValue({items:[image],cursor:null})
  const page=await searchAllSources('flowers',JSON.stringify({openverse:'2',commons:null}))
  expect(page.items).toHaveLength(1)
  expect(searchOpenverse).toHaveBeenCalledTimes(1)
  expect(searchOpenverse).toHaveBeenCalledWith('flowers','2',undefined)
  expect(searchCommons).not.toHaveBeenCalled()
  expect(page.cursor).toBeNull()
})

it('handles every provider failing', async () => {
  for (const mock of [searchOpenverse, searchCommons, searchLoC, searchNasa, searchCma, searchMet, searchWellcome, searchVam]) vi.mocked(mock).mockRejectedValue(new Error('down'))
  await expect(searchAllSources('nature',null)).rejects.toThrow('temporarily unavailable')
})

it('includes optional Europeana only when a session key is configured', async () => {
  for (const mock of [searchOpenverse, searchCommons, searchLoC, searchNasa, searchCma, searchMet]) vi.mocked(mock).mockResolvedValue({items:[],cursor:null})
  vi.mocked(searchEuropeana).mockResolvedValue({items:[{...image,id:'europeana'}],cursor:null})
  await searchAllSources('flowers',null)
  expect(searchEuropeana).not.toHaveBeenCalled()
  setEuropeanaKey('sample-client-key')
  const after=await searchAllSources('flowers',null)
  expect(after.items.map(item=>item.id)).toContain('europeana')
})

it('includes both new no-key museum collections in all-source results', async () => {
  for (const mock of [searchOpenverse, searchCommons, searchLoC, searchNasa, searchCma, searchMet]) {
    vi.mocked(mock).mockResolvedValue({items:[],cursor:null})
  }
  vi.mocked(searchWellcome).mockResolvedValue({items:[{...image,id:'wellcome:1'}],cursor:'2'})
  vi.mocked(searchVam).mockResolvedValue({items:[{...image,id:'vam:O1'}],cursor:'2'})
  const page = await searchAllSources('flowers',null)
  expect(page.items.map(item=>item.id)).toEqual(['wellcome:1','vam:O1'])
  expect(JSON.parse(page.cursor!)).toMatchObject({wellcome:'2',vam:'2'})
  expect(searchWellcome).toHaveBeenCalledWith('flowers',null,undefined)
  expect(searchVam).toHaveBeenCalledWith('flowers',null,undefined)
})
