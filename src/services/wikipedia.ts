import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'

const API = 'https://en.wikipedia.org/w/api.php'
type WikiPage = {
  pageid?: number
  title?: string
  index?: number
  canonicalurl?: string
  thumbnail?: { source?: string; width?: number; height?: number }
  original?: { source?: string; width?: number; height?: number }
}
type WikiResponse = {
  query?: { pages?: WikiPage[] }
  continue?: { continue?: string; gsrcontinue?: string; gsroffset?: number }
  error?: unknown
}

function trustedMedia(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && ['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(u.hostname) ? u.href : null
  } catch { return null }
}
export function normalizeWikipedia(page: WikiPage): ImageResult | null {
  if (!Number.isSafeInteger(page.pageid) || !page.pageid || !page.title) return null
  const thumb = trustedMedia(page.thumbnail?.source)
  const original = trustedMedia(page.original?.source)
  if (!thumb && !original) return null
  const sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
  return {
    id: `wikipedia:${page.pageid}`,
    title: page.title.slice(0, 180),
    description: 'Lead image from a Wikipedia article',
    thumbnailUrl: thumb || original!,
    url: original || thumb!,
    sourceUrl,
    creator: 'See image attribution on Wikipedia',
    license: 'Check linked image rights',
    licenseUrl: sourceUrl,
    width: Math.max(page.original?.width || page.thumbnail?.width || 1, 1),
    height: Math.max(page.original?.height || page.thumbnail?.height || 1, 1),
    provider: 'Wikipedia',
  }
}
export async function searchWikipedia(term: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const query = term.trim().slice(0, 180)
  if (!query) return { items: [], cursor: null }
  const params = new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '0',
    gsrlimit: '24', prop: 'pageimages', piprop: 'thumbnail|original',
    pithumbsize: '680', format: 'json', formatversion: '2', origin: '*',
  })
  if (cursor) {
    let parsed: WikiResponse['continue']
    try { parsed = JSON.parse(cursor) } catch { throw new Error('Invalid Wikipedia cursor') }
    if (!parsed || typeof parsed.continue !== 'string' || (typeof parsed.gsrcontinue !== 'string' && !Number.isSafeInteger(parsed.gsroffset))) {
      throw new Error('Invalid Wikipedia cursor')
    }
    params.set('continue', parsed.continue)
    if (typeof parsed.gsrcontinue === 'string') params.set('gsrcontinue', parsed.gsrcontinue)
    if (Number.isSafeInteger(parsed.gsroffset)) params.set('gsroffset', String(parsed.gsroffset))
  }
  const response = await fetchWithTimeout(`${API}?${params}`, signal)
  if (!response.ok) throw new Error(`Wikipedia image search unavailable (HTTP ${response.status}).`)
  const payload = await response.json() as WikiResponse
  if (payload.error) throw new Error('Wikipedia returned an image search error.')
  return {
    items: (payload.query?.pages || []).slice().sort((a,b) => (a.index || 0)-(b.index || 0))
      .map(normalizeWikipedia).filter((x): x is ImageResult => x !== null),
    cursor: payload.continue?.continue && (payload.continue.gsrcontinue || payload.continue.gsroffset !== undefined) ? JSON.stringify(payload.continue) : null,
  }
}
