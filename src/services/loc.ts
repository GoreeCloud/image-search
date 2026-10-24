import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'
import { normalizeProviderRecords, requireResponseObject } from './providerResponse'

const API = 'https://www.loc.gov/photos/'
const IMAGE_HOSTS = new Set(['tile.loc.gov', 'cdn.loc.gov'])

type LoCRecord = {
  id?: string
  title?: string
  image_url?: string[]
  description?: string | string[]
  contributor?: string[]
  date?: string
  access_restricted?: boolean
}
type LoCResponse = {
  results?: LoCRecord[]
  pagination?: { next?: string | null }
}

function trustedImage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || !IMAGE_HOSTS.has(url.hostname)) return null
    if (!/\.(jpe?g|png|webp)(?:$|[?#])/i.test(url.pathname)) return null
    return url.href
  } catch { return null }
}

function trustedItem(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    if (url.hostname !== 'www.loc.gov' && url.hostname !== 'loc.gov') return null
    if (!url.pathname.startsWith('/item/')) return null
    url.protocol = 'https:'
    return url.href
  } catch { return null }
}

export function normalizeLoC(record: LoCRecord): ImageResult | null {
  if (record.access_restricted) return null
  const sourceUrl = trustedItem(record.id)
  const urls = (record.image_url || []).map(trustedImage).filter((s): s is string => Boolean(s))
  if (!sourceUrl || !urls.length) return null
  const thumbnailUrl = urls[Math.min(1, urls.length - 1)]
  const original = urls[urls.length - 1]
  const dimensions = new URL(original).hash.slice(1)
  const measure = new URLSearchParams(dimensions)
  const w = Number(measure.get('w'))
  const h = Number(measure.get('h'))
  const description = Array.isArray(record.description) ? record.description.join(' ') : record.description || ''
  return {
    id: `loc:${new URL(sourceUrl).pathname}`,
    title: (record.title || 'Untitled photograph').slice(0, 180),
    description: description.slice(0, 320),
    thumbnailUrl,
    url: original,
    sourceUrl,
    creator: (record.contributor?.[0] || 'Creator not specified').slice(0, 180),
    license: 'Check item rights and access',
    licenseUrl: sourceUrl,
    width: Number.isFinite(w) && w > 0 ? w : 900,
    height: Number.isFinite(h) && h > 0 ? h : 650,
    provider: 'Library of Congress',
  }
}

export async function searchLoC(query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const q = query.trim().slice(0, 180)
  if (!q) return { items: [], cursor: null }
  const page = cursor === null ? 1 : Number(cursor)
  if (!Number.isSafeInteger(page) || page < 1 || page > 100) throw new Error('Invalid Library of Congress cursor')
  const params = new URLSearchParams({ fo: 'json', q, c: '24', sp: String(page), at: 'results,pagination' })
  const response = await fetchWithTimeout(`${API}?${params}`, signal)
  if (!response.ok) throw new Error(`Library of Congress search unavailable (HTTP ${response.status}).`)
  const payload = requireResponseObject<LoCResponse>(await response.json(), 'Library of Congress')
  const items = normalizeProviderRecords(payload.results, 'Library of Congress', normalizeLoC)
  return { items, cursor: payload.pagination?.next && page < 100 ? String(page + 1) : null }
}
