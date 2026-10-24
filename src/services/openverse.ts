import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'
import { normalizeProviderRecords, requireResponseObject } from './providerResponse'

const API = 'https://api.openverse.org/v1/images/'
type OpenverseImage = {
  id?: string
  title?: string
  url?: string
  thumbnail?: string
  foreign_landing_url?: string
  creator?: string
  license?: string
  license_version?: string
  license_url?: string
  source?: string
  width?: number
  height?: number
  mature?: boolean
}
type OpenverseResponse = {
  page_count?: number
  results?: OpenverseImage[]
}

function secureUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

function proxyThumbnail(raw: unknown): string | null {
  const safe = secureUrl(raw)
  return safe && new URL(safe).hostname === 'api.openverse.org' ? safe : null
}

export function normalizeOpenverse(item: OpenverseImage): ImageResult | null {
  if (!item.id || item.mature) return null
  const original = secureUrl(item.url)
  const thumbnail = proxyThumbnail(item.thumbnail)
  const source = secureUrl(item.foreign_landing_url)
  if (!original || !thumbnail || !source) return null
  const creator = (item.creator || 'Creator not specified').trim().slice(0, 180)
  const license = [item.license?.toUpperCase(), item.license_version].filter(Boolean).join(' ') || 'See source for terms'
  return {
    id: `openverse:${item.id}`,
    title: (item.title || 'Untitled image').trim().slice(0, 200),
    url: original,
    thumbnailUrl: thumbnail,
    sourceUrl: source,
    description: '',
    creator,
    license,
    licenseUrl: secureUrl(item.license_url),
    width: Math.max(item.width || 1, 1),
    height: Math.max(item.height || 1, 1),
    provider: item.source ? `Openverse · ${item.source.slice(0, 32)}` : 'Openverse',
  }
}

export async function searchOpenverse(
  searchTerm: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<SearchPage> {
  const query = searchTerm.trim().slice(0, 180)
  if (!query) return { items: [], cursor: null }
  const page = Math.max(1, Number(cursor || 1))
  if (!Number.isSafeInteger(page) || page > 100) throw new Error('Invalid page cursor')
  const params = new URLSearchParams({
    q: query, page: String(page), page_size: '20', mature: 'false',
  })
  const response = await fetchWithTimeout(`${API}?${params.toString()}`, signal)
  if (!response.ok) {
    if (response.status === 429) throw new Error('Openverse request limit reached. Try Commons or come back later.')
    throw new Error(`Openverse is unavailable (HTTP ${response.status}).`)
  }
  const data = requireResponseObject<OpenverseResponse>(await response.json(), 'Openverse')
  const items = normalizeProviderRecords(data.results, 'Openverse', normalizeOpenverse)
  return { items, cursor: page < Math.min(data.page_count || 1, 100) ? String(page + 1) : null }
}
