import { afterEach, expect, it, vi } from 'vitest'
import { interleaveDiscovery, searchDiscovery } from './discovery'
import { SOURCE_SEARCH } from './providers'
import type { ImageResult } from '../types'

afterEach(() => vi.restoreAllMocks())

function image(id: string): ImageResult {
  return {
    id, title: id, url: 'https://example.org/original.jpg', thumbnailUrl: 'https://example.org/thumb.jpg',
    sourceUrl: 'https://example.org/source', description: '', creator: '', license: '', licenseUrl: null,
    width: 1200, height: 800, provider: 'Example',
  }
}

it('interleaves distinct discovery topics and removes duplicate image IDs', () => {
  const result = interleaveDiscovery([
    [image('landscape-1'), image('landscape-2')],
    [image('architecture-1'), image('landscape-2')],
    [image('galaxy-1')],
  ])
  expect(result.map(item => item.id)).toEqual([
    'landscape-1', 'architecture-1', 'galaxy-1', 'landscape-2',
  ])
})

it('rejects malformed and unknown discovery cursor data before provider requests', async () => {
  await expect(searchDiscovery('', '{"unknown":"2"}')).rejects.toThrow('Invalid discovery page cursor')
  await expect(searchDiscovery('', '[]')).rejects.toThrow('Invalid discovery page cursor')
  await expect(searchDiscovery('', '{broken')).rejects.toThrow('Invalid discovery page cursor')
})

it('falls back to real Commons imagery when Openverse denies the default feed', async () => {
  const openverse = vi.spyOn(SOURCE_SEARCH, 'openverse').mockRejectedValue(new Error('HTTP 403'))
  const commons = vi.spyOn(SOURCE_SEARCH, 'commons').mockImplementation(async (query, cursor) => ({
    items: [image(`commons:${query}:${cursor || 'first'}`)],
    cursor: cursor ? null : JSON.stringify({ continue: '-||', gsrcontinue: 'next' }),
  }))
  vi.spyOn(SOURCE_SEARCH, 'nasa').mockResolvedValue({ items: [image('nasa:galaxy')], cursor: null })

  const first = await searchDiscovery('', null)
  expect(first.items).toHaveLength(6)
  expect(first.items.some(item => item.id === 'commons:alpine lake:first')).toBe(true)
  expect(first.items.some(item => item.id === 'commons:lotus flower:first')).toBe(true)
  expect(first.items.some(item => item.id === 'commons:beach coast:first')).toBe(true)
  expect(first.unavailableSources).toEqual([])
  expect(first.cursor).toContain('fallback:')
  expect(SOURCE_SEARCH.nasa).toHaveBeenCalledWith('M51', null, undefined)

  const second = await searchDiscovery('', first.cursor)
  expect(second.items).toHaveLength(5)
  expect(second.cursor).toBeNull()
  expect(second.unavailableSources).toEqual([])
  expect(openverse).toHaveBeenCalledTimes(3)
  expect(commons).toHaveBeenCalledTimes(10)
})

it('keeps other discovery sources available if both a primary and fallback fail', async () => {
  vi.spyOn(SOURCE_SEARCH, 'openverse').mockRejectedValue(new Error('Openverse unavailable'))
  vi.spyOn(SOURCE_SEARCH, 'commons').mockRejectedValue(new Error('Commons unavailable'))
  vi.spyOn(SOURCE_SEARCH, 'nasa').mockResolvedValue({ items: [image('nasa:galaxy')], cursor: null })

  const result = await searchDiscovery('', null)
  expect(result.items.map(item => item.id)).toEqual(['nasa:galaxy'])
  expect(result.unavailableSources).toEqual(['openverse', 'commons'])
  expect(result.cursor).not.toBeNull()
})
