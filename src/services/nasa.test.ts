import { afterEach, expect, it, vi } from 'vitest'
import { normalizeNasa, searchNasa } from './nasa'
afterEach(() => vi.unstubAllGlobals())
const fixture = { data: [{ nasa_id: 'PIA00342', title:'Earth',media_type:'image' }], links:[{href:'https://images-assets.nasa.gov/image/PIA00342/PIA00342~medium.jpg',render:'image'}] }
it('normalizes a NASA image', () => {
  expect(normalizeNasa(fixture)?.provider).toBe('NASA Image Library')
  expect(normalizeNasa({ ...fixture,links:[{href:'https://untrusted.test/image.jpg', render:'image'}] })).toBeNull()
  expect(normalizeNasa({...fixture, data:[{nasa_id:'PIA00342', media_type:'video'}]})).toBeNull()
})
it('paginates using API next links', async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({collection:{items:[fixture],links:[{rel:'next'}]}})}))
  const page=await searchNasa('earth',null)
  expect(page.items).toHaveLength(1)
  expect(page.cursor).toBe('2')
})
