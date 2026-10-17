import type { ImageResult, SearchPage } from '../types'

/**
 * GoreeCloud Search is the first-party SearXNG fork backing general-web
 * imagery. It is an always-on search source, not a per-user SearXNG hookup.
 *
 * Public endpoint below is the intended domain, NOT a claim that it is
 * deployed. Release builds can inject a qualified first-party HTTPS URL.
 */
const PROPOSED_ENDPOINT = 'https://search.goreecloud.com/search'
const configured = import.meta.env.VITE_GOREECLOUD_SEARCH_IMAGES_URL as string | undefined

export function getWebImageEndpoint(): string {
  const candidate = configured?.trim() || PROPOSED_ENDPOINT
  let url: URL
  try { url = new URL(candidate) } catch { throw new Error('Invalid GoreeCloud Search service URL.') }
  const host = url.hostname.toLowerCase()
  const firstParty = host === 'goreecloud.com' || host.endsWith('.goreecloud.com')
  const devLoopback = import.meta.env.DEV &&
    (host === 'localhost' || host === '127.0.0.1') && url.protocol === 'http:'
  if ((!firstParty || url.protocol !== 'https:') && !devLoopback) {
    throw new Error('GoreeCloud Search must use the approved first-party HTTPS host.')
  }
  if (url.username || url.password || url.search || url.hash || !['/search','/search/'].includes(url.pathname)) {
    throw new Error('Invalid GoreeCloud Search image API path.')
  }
  return url.href
}

export function hasWebImageEndpoint(): boolean { return true }

type WebRecord = {
  title?: string; url?: string; img_src?: string; thumbnail_src?: string; thumbnail?: string
  content?: string; author?: string; resolution?: string; source?: string; engine?: string
}
type WebResponse = { results?: WebRecord[]; unresponsive_engines?: unknown[] }

function safeUrl(input: unknown, allowRelative = false): string | null {
  if (typeof input !== 'string') return null
  try {
    const url = allowRelative && input.startsWith('/') && !input.startsWith('//')
      ? new URL(input, getWebImageEndpoint()) : new URL(input)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || !host.includes('.') || /^[\d.]+$/.test(host) ||
      host.startsWith('[') || host.endsWith('.local') ||
      host.endsWith('.localhost') || url.username || url.password) return null
    return url.href
  } catch { return null }
}
/** Provider JSON is untrusted even when the HTTP response is valid. */
export function normalizeWebImage(record: unknown, index: number, page: number): ImageResult | null {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null
  const row = record as Record<string, unknown>
  const original = safeUrl(row.img_src)
  const sourceUrl = safeUrl(row.url)
  const thumbnail = safeUrl(row.thumbnail_src, true) || safeUrl(row.thumbnail, true) || original
  if (!original || !sourceUrl || !thumbnail) return null

  const text = (value: unknown, fallback: string, maxLength: number): string =>
    typeof value === 'string' ? (value.trim().slice(0, maxLength) || fallback) : fallback
  const resolution = typeof row.resolution === 'string' ? row.resolution : ''
  const dimensions = /^(\d{1,5})\s*[x×]\s*(\d{1,5})$/i.exec(resolution)
  const width = dimensions ? Number(dimensions[1]) : 0
  const height = dimensions ? Number(dimensions[2]) : 0
  const engine = text(row.engine, '', 36)
  return {
    id: `goreecloud-search:${page}:${index}:${original}`,
    title: text(row.title, 'Web image', 180),
    url: original,
    thumbnailUrl: thumbnail,
    sourceUrl,
    description: text(row.content, '', 320).replace(/<[^>]+>/g, ' '),
    creator: text(row.author, '', 180) || text(row.source, '', 180) || engine || 'See original website',
    license: 'Web result · rights unverified',
    licenseUrl: sourceUrl,
    width: width > 0 ? width : 900,
    height: height > 0 ? height : 700,
    provider: engine ? `GoreeCloud Search · ${engine}` : 'GoreeCloud Search',
  }
}

/** Always invoked during All sources search. Never use third-party fallback. */
export async function searchWebImages(term: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const query = term.trim().slice(0, 180)
  if (!query) return { items: [], cursor: null }
  const page = cursor === null ? 1 : Number(cursor)
  if (!Number.isSafeInteger(page) || page < 1 || page > 10) throw new Error('Invalid web image cursor')

  const endpoint = getWebImageEndpoint()
  const params = new URLSearchParams({ q: query, categories: 'images', format: 'json', pageno: String(page), safesearch: '1' })
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => controller.abort(), 7000)
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST', body: params, mode: 'cors', credentials: 'omit',
      referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('GoreeCloud Search images are not reachable. Other image collections remain available.')
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
  if (!response.ok) throw new Error(
    response.status === 403 ? 'GoreeCloud Search image JSON API is not available.' :
      `GoreeCloud Search images unavailable (HTTP ${response.status}).`,
  )
  let payload: WebResponse
  try { payload = await response.json() as WebResponse }
  catch { throw new Error('GoreeCloud Search did not return valid JSON image results.') }
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.results)) {
    throw new Error('GoreeCloud Search returned an invalid image response.')
  }
  const items = payload.results.slice(0, 60)
    .map((record, index) => normalizeWebImage(record, index, page))
    .filter((item): item is ImageResult => item !== null)
  return { items, cursor: items.length > 0 && page < 10 ? String(page + 1) : null }
}
