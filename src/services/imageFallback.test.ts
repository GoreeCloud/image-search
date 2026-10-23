import { expect, it } from 'vitest'
import { trustedImageFallback } from './imageFallback'
import type { ImageResult } from '../types'

const image: ImageResult = {
  id: 'commons:1', title: 'Clouds', thumbnailUrl: 'https://thumb.wikimedia.org/thumb/a.jpg',
  url: 'https://upload.wikimedia.org/a.jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Clouds.jpg',
  description: '', creator: 'Artist', license: 'CC0', licenseUrl: null, width: 900, height: 600, provider: 'Wikimedia Commons',
}

it('permits a fallback between trusted Wikimedia media hosts', () => {
  expect(trustedImageFallback(image)).toBe(image.url)
})

it('does not load arbitrary third-party Openverse originals automatically', () => {
  expect(trustedImageFallback({ ...image, thumbnailUrl:'https://api.openverse.org/v1/thumb', url:'https://random.example/photo.jpg' })).toBeNull()
})

it('uses only trusted Cleveland museum image hosts for fallbacks', () => {
  const item = { ...image, thumbnailUrl: 'https://openaccess-cdn.clevelandart.org/a_web.jpg', url: 'https://openaccess-cdn.clevelandart.org/a_print.jpg' }
  expect(trustedImageFallback(item)).toBe(item.url)
  expect(trustedImageFallback({ ...item, url: 'https://external.test/a.jpg' })).toBeNull()
})

it('blocks unsafe and same-url fallbacks', () => {
  expect(trustedImageFallback({ ...image, url:'http://upload.wikimedia.org/a.jpg' })).toBeNull()
  expect(trustedImageFallback({ ...image, url:image.thumbnailUrl })).toBeNull()
})

it('accepts only same-host official Wellcome and V&A IIIF image fallbacks', () => {
  for (const hostname of ['iiif.wellcomecollection.org', 'framemark.vam.ac.uk']) {
    const item = { ...image, thumbnailUrl:`https://${hostname}/a/thumb.jpg`, url:`https://${hostname}/a/full.jpg` }
    expect(trustedImageFallback(item)).toBe(item.url)
    expect(trustedImageFallback({...item,url:'https://evil.test/a.jpg'})).toBeNull()
  }
})
