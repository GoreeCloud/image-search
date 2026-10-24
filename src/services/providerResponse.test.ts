import { describe, expect, it } from 'vitest'
import { normalizeProviderRecords, requireResponseObject } from './providerResponse'
import type { ImageResult } from '../types'

const valid: ImageResult = {
  id: 'test:1', title: 'A mountain', url: 'https://images.example/1.jpg',
  thumbnailUrl: 'https://images.example/thumb.jpg', sourceUrl: 'https://example/1',
  description: '', creator: 'Photographer', license: 'See source', licenseUrl: null,
  width: 1200, height: 800, provider: 'Test Provider',
}

describe('untrusted provider response boundary', () => {
  it('rejects invalid top-level JSON objects', () => {
    for (const response of [null, [], 'error', 42]) {
      expect(() => requireResponseObject(response, 'Sample')).toThrow('Invalid Sample response')
    }
    expect(requireResponseObject({ results: [] }, 'Sample')).toEqual({ results: [] })
  })

  it('rejects a malformed results collection instead of reporting zero results', () => {
    for (const records of [null, {}, 'error']) {
      expect(() => normalizeProviderRecords(records, 'Sample', () => valid))
        .toThrow('Invalid Sample results')
    }
  })

  it('keeps valid neighbors when a single record is invalid or its normalizer throws', () => {
    const normalizer = (row: { id: string }) => {
      if (row.id === 'broken') throw new TypeError('Invalid field')
      return { ...valid, id: row.id }
    }
    const items = normalizeProviderRecords([null, { id: 'first' }, { id: 'broken' }, 'junk', { id: 'last' }], 'Sample', normalizer)
    expect(items.map(item => item.id)).toEqual(['first', 'last'])
  })

  it('drops impossible geometry and limits pathological result arrays', () => {
    const rows = Array.from({ length: 150 }, (_, id) => ({ id }))
    const items = normalizeProviderRecords(rows, 'Sample', (row: { id: number }) => ({ ...valid, id: String(row.id) }))
    expect(items).toHaveLength(100)
    expect(normalizeProviderRecords([{}], 'Sample', () => ({ ...valid, width: Number.NaN }))).toEqual([])
  })
})
