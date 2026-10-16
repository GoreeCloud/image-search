import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'

type NasaItem = {
  data?: Array<{ nasa_id?: string; title?: string; description?: string; photographer?: string; secondary_creator?: string; media_type?: string }>
  links?: Array<{ href?: string; render?: string; width?: number; height?: number }>
}
type NasaResponse = {
  collection?: {
    items?: NasaItem[]
    links?: Array<{ rel?: string; href?: string }>
  }
}

const API = 'https://images-api.nasa.gov/search'
const ACCEPTED_HOSTS = new Set(['images-assets.nasa.gov', 'images-api.nasa.gov'])

function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ACCEPTED_HOSTS.has(url.hostname) ? url.href : null
  } catch { return null }
}

export function normalizeNasa(item: NasaItem): ImageResult | null {
  const data = item.data?.[0]
  if (!data?.nasa_id || data.media_type !== 'image') return null
  const link = item.links?.find(l => l.render === 'image' && safeImageUrl(l.href))
  const thumbnail = safeImageUrl(link?.href)
  if (!thumbnail) return null
  return {
    id: `nasa:${data.nasa_id}`,
    title: (data.title || 'NASA image').slice(0, 180),
    description: (data.description || '').replace(/<[^>]*>/g, ' ').slice(0, 320),
    thumbnailUrl: thumbnail,
    url: thumbnail,
    sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(data.nasa_id)}`,
    creator: (data.photographer || data.secondary_creator || 'NASA').slice(0, 180),
    license: 'See NASA media guidelines',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    width: Math.max(1, link?.width || 1000),
    height: Math.max(1, link?.height || 800),
    provider: 'NASA Image Library',
  }
}

export async function searchNasa(query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const q = query.trim().slice(0, 180)
  if (!q) return { items: [], cursor: null }
  const page = cursor === null ? 1 : Number(cursor)
  if (!Number.isSafeInteger(page) || page < 1 || page > 100) throw new Error('Invalid NASA page cursor')
  const params = new URLSearchParams({ q, media_type: 'image', page_size: '30', page: String(page) })
  const res = await fetchWithTimeout(`${API}?${params}`, signal)
  if (!res.ok) throw new Error(`NASA search unavailable (HTTP ${res.status}).`)
  const data = await res.json() as NasaResponse
  const items = (data.collection?.items || []).map(normalizeNasa).filter((x): x is ImageResult => x !== null)
  const hasNext = (data.collection?.links || []).some(l => l.rel === 'next')
  return { items, cursor: hasNext && page < 100 ? String(page + 1) : null }
}
