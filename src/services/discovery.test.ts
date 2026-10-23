import { expect, it } from 'vitest'
import { interleaveDiscovery, searchDiscovery } from './discovery'
import type { ImageResult } from '../types'

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
