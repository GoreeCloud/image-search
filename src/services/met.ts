import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'
import { requireResponseObject } from './providerResponse'

const BASE = 'https://collectionapi.metmuseum.org/public/collection'
type SearchPayload = { total?: number; objectIDs?: number[] | null }
type MetObject = {
  objectID?: number
  objectURL?: string
  isPublicDomain?: boolean
  primaryImageSmall?: string
  primaryImage?: string
  title?: string
  artistDisplayName?: string
  creditLine?: string
}

function trusted(raw: unknown, host: string): string | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.hostname === host ? url.href : null
  } catch { return null }
}

export function normalizeMet(object: MetObject): ImageResult | null {
  if (!object.isPublicDomain || (!Number.isSafeInteger(object.objectID) || (object.objectID ?? 0) <= 0)) return null
  const small = trusted(object.primaryImageSmall, 'images.metmuseum.org')
  const full = trusted(object.primaryImage, 'images.metmuseum.org')
  const sourceUrl = trusted(object.objectURL, 'www.metmuseum.org')
  if (!small || !sourceUrl) return null
  return {
    id: `met:${object.objectID}`,
    title: (object.title || 'Untitled artwork').slice(0, 180),
    description: (object.creditLine || '').slice(0, 320),
    thumbnailUrl: small,
    url: full || small,
    sourceUrl,
    creator: (object.artistDisplayName || 'Artist not specified').slice(0, 180),
    license: 'CC0 · Open Access',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    width: 900,
    height: 1100,
    provider: 'The Metropolitan Museum of Art',
  }
}

export async function searchMet(query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const q = query.trim().slice(0, 180)
  if (!q) return { items: [], cursor: null }
  const offset = cursor === null ? 0 : Number(cursor)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 960 || offset % 12) throw new Error('Invalid Met page cursor')
  const params = new URLSearchParams({ q, hasImages: 'true', limit: '12', offset: String(offset) })
  const response = await fetchWithTimeout(`${BASE}/v1.1/search?${params}`, signal)
  if (!response.ok) throw new Error(`Met search temporarily unavailable (HTTP ${response.status}).`)
  const payload = requireResponseObject<SearchPayload>(await response.json(), 'Met')
  if (payload.objectIDs !== undefined && payload.objectIDs !== null && !Array.isArray(payload.objectIDs)) {
    throw new Error('Invalid Met results')
  }
  const ids = (payload.objectIDs || []).filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 12)
  // Bounded batches avoid bursts against the free museum API.
  const results: ImageResult[] = []
  for (let index = 0; index < ids.length; index += 3) {
    if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')
    const settled = await Promise.allSettled(ids.slice(index, index + 3).map(async id => {
      const result = await fetchWithTimeout(`${BASE}/v1/objects/${id}`, signal)
      if (!result.ok) return null
      return normalizeMet(await result.json() as MetObject)
    }))
    for (const item of settled) if (item.status === 'fulfilled' && item.value) results.push(item.value)
  }
  return { items: results, cursor: offset + 12 < Math.min(Math.max(0, payload.total || 0), 972) ? String(offset + 12) : null }
}
