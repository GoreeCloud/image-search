import { afterEach, expect, it, vi } from 'vitest'
import { normalizeImageQuery } from './query'
import { normalizeWikipedia, searchWikipedia } from './wikipedia'
import { normalizeArtic, searchArtic } from './artic'
import { getWebImageEndpoint, hasWebImageEndpoint, normalizeWebImage, searchWebImages, setWebImageEndpoint } from './webImages'

afterEach(() => { setWebImageEndpoint(''); vi.unstubAllGlobals() })

it('normalizes Samsung OneUI spelling for technology results', () => {
  expect(normalizeImageQuery('Samsung OneUI')).toBe('Samsung One UI')
  expect(normalizeImageQuery('one-ui 8')).toBe('One UI 8')
  expect(normalizeImageQuery('sunflowers')).toBe('sunflowers')
})

it('requires safe Wikipedia media URLs and an article source', () => {
  const image = normalizeWikipedia({pageid:19,title:'One UI',thumbnail:{source:'https://upload.wikimedia.org/thumb.jpg',width:300,height:400}})
  expect(image?.provider).toBe('Wikipedia')
  expect(image?.sourceUrl).toBe('https://en.wikipedia.org/wiki/One_UI')
  expect(normalizeWikipedia({pageid:19,title:'One UI',thumbnail:{source:'https://upload.wikimedia.org.attacker.invalid/a.jpg'}})).toBeNull()
})

it('paginates Wikipedia results without trust in external media hosts', async () => {
  const fetcher = vi.fn().mockResolvedValue({ok:true,json:async()=>({query:{pages:[{pageid:1,title:'Samsung One UI',index:1,original:{source:'https://upload.wikimedia.org/a.png',width:800,height:400}}]},continue:{continue:'-||',gsrcontinue:'x'}})})
  vi.stubGlobal('fetch',fetcher)
  const result=await searchWikipedia('Samsung One UI',null)
  expect(result.items).toHaveLength(1)
  expect(result.cursor).toContain('gsrcontinue')
  expect(fetcher.mock.calls[0][0]).toContain('gsrsearch=Samsung+One+UI')
})

it('normalizes only public domain Art Institute images', () => {
  const artwork={id:2,is_public_domain:true,image_id:'2d484387-2509-5e8e-2c43-22f9981972eb',title:'Test art'}
  expect(normalizeArtic(artwork)?.thumbnailUrl).toContain('www.artic.edu/iiif/2/')
  expect(normalizeArtic({...artwork,is_public_domain:false})).toBeNull()
  expect(normalizeArtic({...artwork,image_id:'../danger'})).toBeNull()
})

it('uses Art Institute search pagination', async () => {
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[{id:2,image_id:'2d484387-2509-5e8e-2c43-22f9981972eb',is_public_domain:true}],pagination:{total_pages:3}})})
  vi.stubGlobal('fetch',fetcher)
  expect((await searchArtic('nature',null)).cursor).toBe('2')
  expect(fetcher.mock.calls[0][0]).toContain('is_public_domain')
})

it('rejects unsafe or query-bearing web search origins', () => {
  expect(()=>setWebImageEndpoint('http://localhost:8080')).toThrow('HTTPS')
  expect(()=>setWebImageEndpoint('https://127.0.0.1')).toThrow('public HTTPS')
  expect(()=>setWebImageEndpoint('https://search.example.org/search?api_key=secret')).toThrow('public HTTPS')
  setWebImageEndpoint('https://search.example.org/')
  expect(getWebImageEndpoint()).toBe('https://search.example.org/search')
  expect(hasWebImageEndpoint()).toBe(true)
})

it('normalizes only HTTPS web image results with a real source URL', () => {
  setWebImageEndpoint('https://search.example.org')
  const record={title:'Samsung One UI',url:'https://www.samsung.com/news',img_src:'https://images.samsung.com/oneui.png',thumbnail_src:'/image_proxy?url=sample',resolution:'1080 x 1920',engine:'bing images'}
  const result=normalizeWebImage(record,0,1)
  expect(result?.thumbnailUrl).toContain('search.example.org/image_proxy')
  expect(result?.license).toContain('rights vary')
  expect(result?.width).toBe(1080)
  expect(normalizeWebImage({...record,img_src:'http://localhost/a.jpg'},0,1)).toBeNull()
  expect(normalizeWebImage({...record,url:'https://192.168.0.1'},0,1)).toBeNull()
})

it('uses session web image endpoint with JSON image category and pagination', async () => {
  setWebImageEndpoint('https://search.example.org')
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({results:[{title:'UI',url:'https://www.samsung.com/a',img_src:'https://images.samsung.com/a.jpg'}]})})
  vi.stubGlobal('fetch',fetcher)
  const result=await searchWebImages('Samsung One UI',null)
  expect(result.items).toHaveLength(1)
  expect(result.cursor).toBe('2')
  expect(fetcher.mock.calls[0][0]).toContain('categories=images')
  expect(fetcher.mock.calls[0][0]).toContain('format=json')
  setWebImageEndpoint('')
  await expect(searchWebImages('Samsung',null)).rejects.toThrow('Settings')
})

it('surfaces unavailable SearXNG JSON output', async () => {
  setWebImageEndpoint('https://search.example.org')
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:403}))
  await expect(searchWebImages('Samsung',null)).rejects.toThrow('JSON')
})
