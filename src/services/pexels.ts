import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'
import { getPexelsKey } from './apiKeys'
type Photo = { id?: number; url?: string; alt?: string | null; photographer?: string; width?: number; height?: number; src?: { medium?: string; large?: string } }
type Results = { photos?: Photo[]; next_page?: string }

function trusted(raw: unknown, host: string): string | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.hostname === host ? url.href : null
  } catch { return null }
}

export function normalizePexels(photo: Photo): ImageResult | null {
  if (!Number.isSafeInteger(photo.id) || (photo.id || 0) <= 0) return null
  const sourceUrl = trusted(photo.url, 'www.pexels.com')
  const thumb = trusted(photo.src?.medium, 'images.pexels.com')
  if (!sourceUrl || !new URL(sourceUrl).pathname.startsWith('/photo/') || !thumb) return null
  return {
    id: `pexels:${photo.id}`,
    title: (photo.alt || 'Pexels photograph').slice(0, 180),
    description: 'Photo from Pexels',
    thumbnailUrl: thumb,
    url: trusted(photo.src?.large, 'images.pexels.com') || thumb,
    sourceUrl,
    creator: (photo.photographer || 'Unknown photographer').slice(0, 180),
    license: 'Pexels License',
    licenseUrl: 'https://www.pexels.com/license/',
    width: Number(photo.width) > 0 ? Number(photo.width) : 1200,
    height: Number(photo.height) > 0 ? Number(photo.height) : 800,
    provider: 'Pexels',
  }
}

export async function searchPexels(query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const key = getPexelsKey()
  if (!key) throw new Error('Add your Pexels API key under Settings → API.')
  const q = query.trim().slice(0, 180)
  if (!q) return { items: [], cursor: null }
  const page = cursor === null ? 1 : Number(cursor)
  if (!Number.isSafeInteger(page) || page < 1 || page > 100) throw new Error('Invalid Pexels page cursor')
  const params = new URLSearchParams({ query: q, page: String(page), per_page: '24' })
  const response = await fetchWithTimeout(`https://api.pexels.com/v1/search?${params}`, signal, 16000, { Authorization: key })
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Pexels API key was rejected.' : `Pexels temporarily unavailable (HTTP ${response.status}).`)
  const payload = await response.json() as Results
  return {
    items: (payload.photos || []).map(normalizePexels).filter((item): item is ImageResult => item !== null),
    cursor: payload.next_page && page < 100 ? String(page + 1) : null,
  }
}
