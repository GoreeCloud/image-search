import { afterEach, expect, it, vi } from 'vitest'
import { uniqueImages, searchAllSources } from './providers'
import { searchOpenverse } from './openverse'
import { searchCommons } from './commons'
import { searchLoC } from './loc'
import { searchNasa } from './nasa'

vi.mock('./openverse', () => ({ searchOpenverse: vi.fn() }))
vi.mock('./commons', () => ({ searchCommons: vi.fn() }))
vi.mock('./loc', () => ({ searchLoC: vi.fn() }))
vi.mock('./nasa', () => ({ searchNasa: vi.fn() }))
afterEach(() => vi.clearAllMocks())
const image = {id:'example', title:'Example',url:'https://example.com/a.jpg',thumbnailUrl:'https://example.com/a.jpg',sourceUrl:'https://example.com',description:'',creator:'x',license:'x',licenseUrl:null,width:4,height:3,provider:'test'}
it('deduplicates repeated IDs while keeping their initial order', () => {
  expect(uniqueImages([image,{...image,title:'second'}])).toEqual([image])
})
it('collects available providers when another provider fails', async () => {
  vi.mocked(searchOpenverse).mockResolvedValue({ items:[image], cursor:'2' })
  vi.mocked(searchCommons).mockRejectedValue(new Error('offline'))
  vi.mocked(searchLoC).mockResolvedValue({items:[{...image,id:'art'}],cursor:null})
  vi.mocked(searchNasa).mockResolvedValue({items:[],cursor:null})
  const page=await searchAllSources('nature',null)
  expect(page.items.map(x => x.id)).toEqual(['example','art'])
  expect(page.cursor).toContain('openverse')
  expect(page.cursor).toContain('commons')
})
it('handles every provider failing', async () => {
  for (const mock of [searchOpenverse, searchCommons, searchLoC, searchNasa]) vi.mocked(mock).mockRejectedValue(new Error('down'))
  await expect(searchAllSources('nature',null)).rejects.toThrow('temporarily unavailable')
})
