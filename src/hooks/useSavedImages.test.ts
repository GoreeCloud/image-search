import { expect, it } from 'vitest'
import { filterSavedImages, isSavedImageResult } from './useSavedImages'

const image = {
  id: 'openverse:1',
  title: 'Mountain',
  url: 'https://example.org/original.jpg',
  thumbnailUrl: 'https://example.org/preview.jpg',
  sourceUrl: 'https://example.org/source',
  description: '',
  creator: 'Artist',
  license: 'CC BY',
  licenseUrl: null,
  width: 1200,
  height: 800,
  provider: 'Openverse',
}

it('keeps a valid saved record without rewriting its metadata', () => {
  expect(filterSavedImages([image])).toEqual([image])
})

it('does not trust URL schemes or embedded credentials in browser storage', () => {
  for (const field of ['url', 'thumbnailUrl', 'sourceUrl', 'licenseUrl'] as const) {
    for (const unsafe of ['javascript:alert(1)', 'data:text/html,hi', 'file:///tmp/a.png', '/relative', 'https://user:pass@example.org/x']) {
      expect(isSavedImageResult({ ...image, [field]: unsafe })).toBe(false)
    }
  }
  expect(isSavedImageResult({ ...image, licenseUrl: 'https://example.org/license' })).toBe(true)
  expect(isSavedImageResult({ ...image, url: 'http://example.org/a.jpg' })).toBe(true)
})

it('rejects corrupted metadata rather than causing rendering failures', () => {
  for (const bad of [
    null, false, [], { ...image, id: '' }, { ...image, width: 0 },
    { ...image, height: Number.NaN }, { ...image, width: Infinity },
    { ...image, title: null }, { ...image, licenseUrl: {} },
    { ...image, provider: undefined },
  ]) {
    expect(isSavedImageResult(bad)).toBe(false)
  }
})

it('keeps first occurrence of each image and bounds saved state', () => {
  const items = Array.from({ length: 515 }, (_, i) => ({ ...image, id: String(i) }))
  const filtered = filterSavedImages([null, image, image, ...items])
  expect(filtered).toHaveLength(500)
  expect(filtered[0]).toEqual(image)
  expect(filtered[1].id).toBe('0')
  expect(filtered[499].id).toBe('498')
  expect(filterSavedImages({ image })).toEqual([])
})
