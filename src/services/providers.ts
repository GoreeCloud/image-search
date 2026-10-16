import type { ImageResult, SearchPage } from '../types'
import { searchOpenverse } from './openverse'
import { searchCommons } from './commons'
import { searchLoC } from './loc'
import { searchNasa } from './nasa'
import { searchCma } from './cleveland'
import { searchMet } from './met'
import { searchEuropeana } from './europeana'
import { searchWikipedia } from './wikipedia'
import { searchWebImages } from './webImages'
import { hasEuropeanaKey } from './apiKeys'

export const SOURCE_SEARCH = { web: searchWebImages, openverse: searchOpenverse, wikipedia: searchWikipedia, commons: searchCommons, loc: searchLoC, nasa: searchNasa, cleveland: searchCma, met: searchMet, europeana: searchEuropeana }
export type SingleSource = keyof typeof SOURCE_SEARCH
export type ImageSource = SingleSource | 'all'
type MultiCursor = Partial<Record<SingleSource, string | null>>

export function uniqueImages(results: readonly ImageResult[]): ImageResult[] {
  const seen = new Set<string>()
  const urls = new Set<string>()
  return results.filter(image => {
    // Distinct APIs can index the same original file under different IDs.
    const original = image.url.split('#', 1)[0]
    if (seen.has(image.id) || urls.has(original)) return false
    seen.add(image.id)
    urls.add(original)
    return true
  })
}

export async function searchAllSources(query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const sources = (Object.keys(SOURCE_SEARCH) as SingleSource[]).filter(s => s !== 'europeana' || hasEuropeanaKey())
  let cursors: MultiCursor
  if (cursor === null) cursors = Object.fromEntries(sources.map(s => [s, ''])) as MultiCursor
  else {
    try { cursors = JSON.parse(cursor) as MultiCursor } catch { throw new Error('Invalid image page cursor') }
    if (!cursors || typeof cursors !== 'object' || Array.isArray(cursors)) throw new Error('Invalid image page cursor')
  }
  // Screenshot-rich collections tend to be more useful for device/UI queries.
  // Keep the general mix for nature, art, and other searches.
  const technology = /\b(samsung|one[\s-]?ui|android|galaxy|ios|macos|windows|screenshot|interface|app icons?)\b/i.test(query)
  const rank: SingleSource[] = technology
    ? ['web', 'commons', 'wikipedia', 'openverse', 'loc', 'nasa', 'cleveland', 'met', 'europeana']
    : sources
  const active = sources.filter(s => typeof cursors[s] === 'string')
    .sort((a, b) => rank.indexOf(a) - rank.indexOf(b))
  if (!active.length) return { items: [], cursor: null }
  const responses = await Promise.allSettled(active.map(async s => ({
    source: s,
    page: await SOURCE_SEARCH[s](query, cursors[s] || null, signal),
  })))
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')
  const succeeded = responses.filter((r): r is PromiseFulfilledResult<{source: SingleSource; page: SearchPage}> => r.status === 'fulfilled')
  if (!succeeded.length) throw new Error('Image sources are temporarily unavailable. Try an individual source.')
  const next: MultiCursor = {}
  for (const s of succeeded) next[s.value.source] = s.value.page.cursor
  // Do not indefinitely paginate an unavailable service; refresh re-enables it.
  const unavailableSources = responses.flatMap((r,index) => r.status === 'rejected' ? [active[index]] : [])
  unavailableSources.forEach(s => { next[s] = null })
  return {
    items: uniqueImages(succeeded.flatMap(r => r.value.page.items)),
    cursor: Object.values(next).some(value => typeof value === 'string') ? JSON.stringify(next) : null,
    unavailableSources,
  }
}
