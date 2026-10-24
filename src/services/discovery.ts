import type { ImageResult, SearchPage } from '../types'
import { SOURCE_SEARCH, uniqueImages } from './providers'
import type { SingleSource } from './providers'

// The default Explore feed is intentionally varied. Each image still comes
// from a real provider, with the provider's own source and rights metadata.
type DiscoveryLane = {
  id: string
  source: SingleSource
  query: string
  fallback?: { source: SingleSource; query: string }
}

const FALLBACK_PREFIX = 'fallback:'
const LANES: readonly DiscoveryLane[] = [
  { id: 'landscapes', source: 'openverse', query: 'alpine mountain lake', fallback: { source: 'commons', query: 'alpine lake' } },
  { id: 'architecture', source: 'commons', query: 'modern architecture' },
  { id: 'flowers', source: 'openverse', query: 'lotus flower', fallback: { source: 'commons', query: 'lotus flower' } },
  { id: 'space', source: 'nasa', query: 'M51' },
  { id: 'coasts', source: 'openverse', query: 'turquoise coastal beach', fallback: { source: 'commons', query: 'beach coast' } },
  { id: 'interiors', source: 'commons', query: 'minimalist architecture interior' },
]

type DiscoveryCursor = Record<string, string | null>

function parseCursor(cursor: string | null): DiscoveryCursor {
  if (cursor === null) return Object.fromEntries(LANES.map(lane => [lane.id, '']))
  if (cursor.length > 8192) throw new Error('Invalid discovery page cursor')
  let parsed: unknown
  try { parsed = JSON.parse(cursor) } catch { throw new Error('Invalid discovery page cursor') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid discovery page cursor')
  const values = Object.entries(parsed)
  const allowed = new Set(LANES.map(lane => lane.id))
  if (values.length > LANES.length || values.some(([id, value]) =>
    !allowed.has(id) || !(value === null || (typeof value === 'string' && value.length <= 2048 && !/[\u0000-\u001f\u007f]/.test(value))))) {
    throw new Error('Invalid discovery page cursor')
  }
  return parsed as DiscoveryCursor
}

export function interleaveDiscovery(groups: readonly (readonly ImageResult[])[]): ImageResult[] {
  const combined: ImageResult[] = []
  const maxLength = Math.max(0, ...groups.map(group => group.length))
  for (let index = 0; index < maxLength; index++) {
    for (const group of groups) if (group[index]) combined.push(group[index])
  }
  return uniqueImages(combined)
}

async function loadLane(lane: DiscoveryLane, cursor: string | undefined, signal?: AbortSignal) {
  // Once a lane falls back, its cursor belongs to Commons, not Openverse.
  // Keep that provider fixed for the remainder of this pagination session.
  if (lane.fallback && cursor?.startsWith(FALLBACK_PREFIX)) {
    const page = await SOURCE_SEARCH[lane.fallback.source](lane.fallback.query, cursor.slice(FALLBACK_PREFIX.length) || null, signal)
    return { lane, page, usingFallback: true }
  }
  try {
    const page = await SOURCE_SEARCH[lane.source](lane.query, cursor || null, signal)
    return { lane, page, usingFallback: false }
  } catch (error) {
    if (signal?.aborted || !lane.fallback) throw error
    const page = await SOURCE_SEARCH[lane.fallback.source](lane.fallback.query, null, signal)
    return { lane, page, usingFallback: true }
  }
}

export async function searchDiscovery(_query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const cursors = parseCursor(cursor)
  const active = LANES.filter(lane => typeof cursors[lane.id] === 'string')
  if (!active.length) return { items: [], cursor: null }

  const responses = await Promise.allSettled(active.map(lane => loadLane(lane, cursors[lane.id] || undefined, signal)))
  if (signal?.aborted) throw new DOMException('Discovery cancelled', 'AbortError')
  const successful = responses.filter((response): response is PromiseFulfilledResult<Awaited<ReturnType<typeof loadLane>>> => response.status === 'fulfilled')
  if (!successful.length) throw new Error('Image sources are temporarily unavailable. Please retry.')

  const next: DiscoveryCursor = {}
  const unavailable = new Set<SingleSource>()
  for (const result of successful) {
    const { lane, page, usingFallback } = result.value
    const current = cursors[lane.id] || null
    const providerCursor = usingFallback && current?.startsWith(FALLBACK_PREFIX)
      ? current.slice(FALLBACK_PREFIX.length) : current
    next[lane.id] = page.cursor && page.cursor !== providerCursor
      ? (usingFallback ? FALLBACK_PREFIX + page.cursor : page.cursor) : null
    // A successful fallback still fills the topic. Reserve the prominent
    // unavailable-source warning for lanes without usable imagery.
  }
  responses.forEach((result, index) => {
    if (result.status === 'rejected') {
      const lane = active[index]
      next[lane.id] = cursors[lane.id]
      unavailable.add(lane.source)
      if (lane.fallback) unavailable.add(lane.fallback.source)
    }
  })

  return {
    items: interleaveDiscovery(successful.map(result => result.value.page.items)),
    cursor: Object.values(next).some(value => typeof value === 'string') ? JSON.stringify(next) : null,
    unavailableSources: [...unavailable],
  }
}
