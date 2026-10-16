import { afterEach, expect, it, vi } from 'vitest'
import { normalizePexels, searchPexels } from './pexels'
import { getPexelsKey, setPexelsKey } from './apiKeys'

afterEach(() => { vi.unstubAllGlobals(); setPexelsKey('') })
const photo = {
  id: 123,
  url: 'https://www.pexels.com/photo/flower-123/',
  alt: 'A flower',
  photographer: 'Artist',
  width: 1200, height: 800,
  src: {medium: 'https://images.pexels.com/photos/123/pexels-photo-123.jpeg', large: 'https://images.pexels.com/photos/123/large.jpeg'},
}

it('normalizes trusted Pexels image links with a license', () => {
  expect(normalizePexels(photo)?.provider).toBe('Pexels')
  expect(normalizePexels({...photo, src:{medium:'https://images.pexels.com.evil.test/a.jpg'}})).toBeNull()
})

it('only sends a session key as an authorization header to the provider', async () => {
  setPexelsKey('test-placeholder')
  const mocked=vi.fn().mockResolvedValue({ok:true,json:async()=>({photos:[photo],next_page:'https://api.pexels.com/v1/search?page=2'})})
  vi.stubGlobal('fetch',mocked)
  const result=await searchPexels('flowers',null)
  expect(result.items).toHaveLength(1)
  expect(result.cursor).toBe('2')
  expect(mocked.mock.calls[0][0]).not.toContain('test-placeholder')
  expect(mocked.mock.calls[0][1].headers.Authorization).toBe('test-placeholder')
  expect(getPexelsKey()).toBe('test-placeholder')
})

it('requires configuration before contacting API', async () => {
  await expect(searchPexels('flowers',null)).rejects.toThrow('Settings')
  expect(getPexelsKey()).toBe('')
})
