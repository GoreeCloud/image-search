import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'

// Explicit opt-in only. A self-hosted SearXNG instance needs JSON output enabled,
// CORS access from this app, and its own upstream engine terms respected.
let searchBase = ''

export function getWebImageEndpoint(): string { return searchBase }
export function hasWebImageEndpoint(): boolean { return Boolean(searchBase) }
export function setWebImageEndpoint(input: string): void {
  const raw = input.trim()
  if (!raw) { searchBase = ''; return }
  if (raw.length > 300) throw new Error('Search service address is too long')
  let parsed: URL
  try { parsed = new URL(raw) } catch { throw new Error('Enter a valid HTTPS SearXNG address.') }
  const host = parsed.hostname.toLowerCase()
  if (parsed.protocol !== 'https:' || !host.includes('.') || parsed.username || parsed.password ||
    parsed.search || parsed.hash || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
    /^[\d.]+$/.test(host) || host.startsWith('[') ||
    !/^([a-z\d-]+\.)+[a-z\d-]{2,}$/i.test(host)) {
    throw new Error('Use a public HTTPS hostname without credentials or query parameters.')
  }
  if (!['/', '/search', '/search/'].includes(parsed.pathname)) throw new Error('Use the SearXNG site root or /search address.')
  searchBase = `${parsed.origin}/search`
}
type WebRecord = {
  title?: string; url?: string; img_src?: string; thumbnail_src?: string; thumbnail?: string
  content?: string; author?: string; resolution?: string; source?: string; engine?: string
}
type WebResponse = { results?: WebRecord[]; unresponsive_engines?: unknown[] }

function safeUrl(input: unknown, allowRelative = false): string | null {
  if (typeof input !== 'string') return null
  try {
    const url = allowRelative && input.startsWith('/') && !input.startsWith('//') ? new URL(input, searchBase) : new URL(input)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || !host.includes('.') || /^[\d.]+$/.test(host) || host.startsWith('[') ||
      host.endsWith('.local') || host.endsWith('.localhost') || url.username || url.password) return null
    return url.href
  } catch { return null }
}
export function normalizeWebImage(record: WebRecord, index: number, page: number): ImageResult | null {
  const original = safeUrl(record.img_src)
  const sourceUrl = safeUrl(record.url)
  const thumbnail = safeUrl(record.thumbnail_src || record.thumbnail, true) || original
  if (!original || !sourceUrl || !thumbnail) return null
  const dimensions = /^(\d{1,5})\s*[x×]\s*(\d{1,5})$/i.exec(record.resolution || '')
  return {
    id: `web:${page}:${index}:${original}`,
    title: (record.title || 'Web image').slice(0, 180),
    url: original,
    thumbnailUrl: thumbnail,
    sourceUrl,
    description: (record.content || '').replace(/<[^>]+>/g, ' ').slice(0, 320),
    creator: (record.author || record.source || record.engine || 'See original website').slice(0, 180),
    license: 'Web result · rights vary',
    licenseUrl: sourceUrl,
    width: dimensions ? Number(dimensions[1]) : 900,
    height: dimensions ? Number(dimensions[2]) : 700,
    provider: record.engine ? `Web · ${record.engine.slice(0, 36)}` : 'Web images',
  }
}
export async function searchWebImages(term: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  if (!searchBase) throw new Error('Connect a SearXNG image search endpoint in Settings → API.')
  const query = term.trim().slice(0, 180)
  if (!query) return { items: [], cursor: null }
  const page = cursor === null ? 1 : Number(cursor)
  if (!Number.isSafeInteger(page) || page < 1 || page > 10) throw new Error('Invalid web image page cursor')
  const params = new URLSearchParams({ q: query, categories: 'images', format: 'json', pageno: String(page), safesearch: '1' })
  let response: Response
  try { response = await fetchWithTimeout(`${searchBase}?${params}`, signal, 18000) }
  catch (error) {
    if (signal?.aborted) throw error
    throw new Error('Web image service is unreachable. Check HTTPS, JSON API access, and CORS settings.')
  }
  if (!response.ok) throw new Error(response.status === 403 ? 'SearXNG JSON output or browser access is disabled.' : `Web image search failed (HTTP ${response.status}).`)
  const payload = await response.json() as WebResponse
  const items = (payload.results || []).slice(0, 60)
    .map((record, index) => normalizeWebImage(record, index, page)).filter((x): x is ImageResult => x !== null)
  return { items, cursor: items.length > 0 && page < 10 ? String(page+1) : null }
}
