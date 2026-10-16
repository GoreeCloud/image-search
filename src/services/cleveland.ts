import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'

const API = 'https://openaccess-api.clevelandart.org/api/artworks/'

type CmaImage = {
  url?: string
  width?: string | number
  height?: string | number
}

type CmaArtwork = {
  id?: number
  title?: string
  url?: string
  description?: string | null
  share_license_status?: string
  creators?: Array<{ description?: string }>
  images?: { web?: CmaImage | null; print?: CmaImage | null }
}

type CmaResponse = {
  info?: { total?: number }
  data?: CmaArtwork[]
}

function trustedCmaUrl(raw: unknown, image = false): string | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return null
    if (image) {
      if (url.hostname !== 'openaccess-cdn.clevelandart.org') return null
      if (!/\.(jpe?g|png|webp)$/i.test(url.pathname)) return null
    } else if (!['clevelandart.org', 'www.clevelandart.org'].includes(url.hostname)
      || !url.pathname.startsWith('/art/')) return null
    return url.href
  } catch { return null }
}

export function normalizeCma(artwork: CmaArtwork): ImageResult | null {
  if (!Number.isSafeInteger(artwork.id) || (artwork.id ?? 0) <= 0) return null
  if (artwork.share_license_status?.toUpperCase() !== 'CC0') return null
  const web = artwork.images?.web
  const thumbnail = trustedCmaUrl(web?.url, true)
  const sourceUrl = trustedCmaUrl(artwork.url)
  if (!thumbnail || !sourceUrl) return null
  const larger = trustedCmaUrl(artwork.images?.print?.url, true)
  const width = Number(web?.width)
  const height = Number(web?.height)
  return {
    id: `cma:${artwork.id}`,
    title: (artwork.title || 'Untitled artwork').slice(0, 180),
    description: (artwork.description || '').replace(/<[^>]*>/g, ' ').slice(0, 320),
    thumbnailUrl: thumbnail,
    url: larger || thumbnail,
    sourceUrl,
    creator: (artwork.creators?.[0]?.description || 'Creator not specified').slice(0, 180),
    license: 'CC0 · Open Access',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    width: Number.isFinite(width) && width > 0 ? width : 750,
    height: Number.isFinite(height) && height > 0 ? height : 1000,
    provider: 'Cleveland Museum of Art',
  }
}

export async function searchCma(query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const q = query.trim().slice(0, 180)
  if (!q) return { items: [], cursor: null }
  const skip = cursor === null ? 0 : Number(cursor)
  if (!Number.isSafeInteger(skip) || skip < 0 || skip > 960 || skip % 24 !== 0) {
    throw new Error('Invalid Cleveland Art page cursor')
  }
  const params = new URLSearchParams({ q, cc0: '1', has_image: '1', limit: '24', skip: String(skip) })
  const response = await fetchWithTimeout(`${API}?${params}`, signal)
  if (!response.ok) throw new Error(`Cleveland Museum image search unavailable (HTTP ${response.status}).`)
  const data = await response.json() as CmaResponse
  const items = (data.data || []).map(normalizeCma).filter((item): item is ImageResult => item !== null)
  const total = Math.max(0, data.info?.total || 0)
  return { items, cursor: skip + 24 < Math.min(total, 984) ? String(skip + 24) : null }
}
