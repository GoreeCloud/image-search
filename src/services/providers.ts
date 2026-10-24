import type { ImageResult, SearchPage } from '../types'
import { searchOpenverse } from './openverse'
import { searchCommons } from './commons'
import { searchLoC } from './loc'
import { searchNasa } from './nasa'
import { searchCma } from './cleveland'
import { searchMet } from './met'
import { searchWellcome } from './wellcome'
import { searchVam } from './vam'
import { searchEuropeana } from './europeana'
import { hasEuropeanaKey } from './apiKeys'
import { rankCollectionImages, sourcesForQuery } from './relevance'

export const SOURCE_SEARCH = { openverse: searchOpenverse, commons: searchCommons, loc: searchLoC, nasa: searchNasa, cleveland: searchCma, met: searchMet, wellcome: searchWellcome, vam: searchVam, europeana: searchEuropeana }
export type SingleSource = keyof typeof SOURCE_SEARCH
export type ImageSource = SingleSource | 'all'
type MultiCursor = Partial<Record<SingleSource, string | null>>

function imageIdentityUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    url.hash = ''
    // Marketing parameters should not make one underlying image look unique.
    // Retain all other query parameters: they may identify distinct media.
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || /^(fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key)
    }
    url.searchParams.sort()
    return url.href
  } catch {
    return null
  }
}

export function uniqueImages(results: readonly ImageResult[]): ImageResult[] {
  const seenIds = new Set<string>()
  const originals = new Map<string, string>()
  return results.filter(image => {
    if (seenIds.has(image.id)) return false
    const original = imageIdentityUrl(image.url)
    // A shared original across different providers represents the same asset.
    // Source pages may be collections, so they alone cannot prove duplication.
    if (original && originals.has(original) && originals.get(original) !== image.provider) return false
    seenIds.add(image.id)
    if (original && !originals.has(original)) originals.set(original, image.provider)
    return true
  })
}

export async function searchAllSources(query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const sources = sourcesForQuery(query, (Object.keys(SOURCE_SEARCH) as SingleSource[]).filter(s => s !== 'europeana' || hasEuropeanaKey()))
  let cursors: MultiCursor
  if (cursor === null) cursors = Object.fromEntries(sources.map(s => [s, ''])) as MultiCursor
  else {
    // Aggregate cursors can be pasted, persisted, or supplied through a link.
    // Validate the whole envelope before dispatching any provider requests.
    if (typeof cursor !== 'string' || cursor.length > 8192) throw new Error('Invalid image page cursor')
    try { cursors = JSON.parse(cursor) as MultiCursor } catch { throw new Error('Invalid image page cursor') }
    if (!cursors || typeof cursors !== 'object' || Array.isArray(cursors)
        || Object.keys(cursors).length > sources.length
        || Object.entries(cursors).some(([source, value]) =>
          !sources.includes(source as SingleSource)
          || !(value === null || (typeof value === 'string'
            && value.length <= 2048 && !/[\u0000-\u001f\u007f]/.test(value))))) {
      throw new Error('Invalid image page cursor')
    }
  }
  const active = sources.filter(s => typeof cursors[s] === 'string')
  if (!active.length) return { items: [], cursor: null }
  const responses = await Promise.allSettled(active.map(async s => ({
    source: s,
    page: await SOURCE_SEARCH[s](query, cursors[s] || null, signal),
  })))
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')
  const succeeded = responses.filter((r): r is PromiseFulfilledResult<{source: SingleSource; page: SearchPage}> => r.status === 'fulfilled')
  if (!succeeded.length) throw new Error('Image sources are temporarily unavailable. Try an individual source.')
  const next: MultiCursor = {}
  for (const s of succeeded) {
    const source = s.value.source
    const nextCursor = s.value.page.cursor
    // A provider repeating the requested page cursor must not cause endless
    // load-more requests. Other sources can continue independently.
    next[source] = nextCursor && nextCursor !== (cursors[source] || null) ? nextCursor : null
  }
  const unavailableSources = responses.flatMap((r, index) =>
    r.status === 'rejected' ? [active[index]] : [])
  responses.forEach((r, index) => { if (r.status === 'rejected') next[active[index]] = cursors[active[index]] })
  return {
    items: uniqueImages(rankCollectionImages(query, succeeded.flatMap(r => r.value.page.items))),
    cursor: Object.values(next).some(value => typeof value === 'string') ? JSON.stringify(next) : null,
    unavailableSources,
  }
}
