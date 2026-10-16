import type { ImageResult, SearchPage } from '../types'
import { searchOpenverse } from './openverse'
import { searchCommons } from './commons'
import { searchLoC } from './loc'
import { searchNasa } from './nasa'
import { searchCma } from './cleveland'

export const SOURCE_SEARCH = { openverse: searchOpenverse, commons: searchCommons, loc: searchLoC, nasa: searchNasa, cleveland: searchCma }
export type SingleSource = keyof typeof SOURCE_SEARCH
export type ImageSource = SingleSource | 'all'
type MultiCursor = Partial<Record<SingleSource, string | null>>

export function uniqueImages(results: readonly ImageResult[]): ImageResult[] {
  const seen = new Set<string>()
  return results.filter(image => {
    if (seen.has(image.id)) return false
    seen.add(image.id)
    return true
  })
}

export async function searchAllSources(query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const sources = Object.keys(SOURCE_SEARCH) as SingleSource[]
  let cursors: MultiCursor
  if (cursor === null) cursors = Object.fromEntries(sources.map(s => [s, ''])) as MultiCursor
  else {
    try { cursors = JSON.parse(cursor) as MultiCursor } catch { throw new Error('Invalid image page cursor') }
    if (!cursors || typeof cursors !== 'object' || Array.isArray(cursors)) throw new Error('Invalid image page cursor')
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
  for (const s of succeeded) next[s.value.source] = s.value.page.cursor
  responses.forEach((r, index) => { if (r.status === 'rejected') next[active[index]] = cursors[active[index]] })
  return {
    items: uniqueImages(succeeded.flatMap(r => r.value.page.items)),
    cursor: Object.values(next).some(value => typeof value === 'string') ? JSON.stringify(next) : null,
  }
}
