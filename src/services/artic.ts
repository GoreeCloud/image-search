import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'

const API = 'https://api.artic.edu/api/v1/artworks/search'
type Artwork = {
  id?: number; title?: string; image_id?: string; is_public_domain?: boolean
  artist_display?: string; thumbnail?: { width?: number; height?: number; alt_text?: string }
}
type ArticResponse = {
  data?: Artwork[]
  pagination?: { current_page?: number; total_pages?: number }
}
export function normalizeArtic(art: Artwork): ImageResult | null {
  if (!Number.isSafeInteger(art.id) || !art.id || !art.is_public_domain
    || typeof art.image_id !== 'string' || !/^[a-f0-9-]{20,64}$/i.test(art.image_id)) return null
  const base = `https://www.artic.edu/iiif/2/${art.image_id}/full`
  return {
    id: `artic:${art.id}`,
    title: (art.title || 'Untitled artwork').slice(0, 180),
    thumbnailUrl: `${base}/400,/0/default.jpg`,
    url: `${base}/843,/0/default.jpg`,
    sourceUrl: `https://www.artic.edu/artworks/${art.id}`,
    description: (art.thumbnail?.alt_text || '').slice(0, 320),
    creator: (art.artist_display || 'Artist not specified').slice(0, 180),
    license: 'Public domain · verify artwork',
    licenseUrl: 'https://www.artic.edu/image-licensing',
    width: Math.max(1, art.thumbnail?.width || 843),
    height: Math.max(1, art.thumbnail?.height || 900),
    provider: 'Art Institute of Chicago',
  }
}
export async function searchArtic(term: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const query = term.trim().slice(0, 180)
  if (!query) return { items: [], cursor: null }
  const page = cursor === null ? 1 : Number(cursor)
  if (!Number.isSafeInteger(page) || page < 1 || page > 50) throw new Error('Invalid Art Institute page cursor')
  const params = new URLSearchParams({ q: query, page: String(page), limit: '24', fields: 'id,title,image_id,is_public_domain,artist_display,thumbnail' })
  params.set('query[term][is_public_domain]', 'true')
  const response = await fetchWithTimeout(`${API}?${params}`, signal)
  if (!response.ok) throw new Error(`Art Institute unavailable (HTTP ${response.status}).`)
  const payload = await response.json() as ArticResponse
  return {
    items: (payload.data || []).map(normalizeArtic).filter((x): x is ImageResult => x !== null),
    cursor: page < Math.min(payload.pagination?.total_pages || 1, 50) ? String(page+1) : null,
  }
}
