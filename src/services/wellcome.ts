import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'
import { normalizeProviderRecords, requireResponseObject } from './providerResponse'

const API = 'https://api.wellcomecollection.org/catalogue/v2/images'
const PAGE_SIZE = 20
const MAX_PAGE = 100

type WellcomeImage = {
  id?: string
  aspectRatio?: number
  source?: { id?: string; title?: string; contributors?: Array<{ agent?: { label?: string } }> }
  thumbnail?: {
    url?: string
    credit?: string
    license?: { id?: string; label?: string; url?: string }
    accessConditions?: Array<{ status?: { id?: string } }>
  }
}
type WellcomeResponse = { results?: WellcomeImage[]; totalPages?: number }

function iiifIdentifier(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    const match = /^\/image\/([A-Za-z0-9._-]{1,120})\/info\.json$/.exec(url.pathname)
    if (url.protocol !== 'https:' || url.hostname !== 'iiif.wellcomecollection.org'
      || url.username || url.password || url.search || url.hash) return null
    return match?.[1] || null
  } catch { return null }
}

function trustedLicense(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && !url.username && !url.password
      && ['creativecommons.org', 'rightsstatements.org', 'wellcomecollection.org'].includes(url.hostname)
      ? url.href : null
  } catch { return null }
}

function safeText(value: unknown, fallback: string, limit: number): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback
}

export function normalizeWellcome(record: WellcomeImage): ImageResult | null {
  if (!record || typeof record.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(record.id)) return null
  const workId = record.source?.id
  if (typeof workId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(workId)) return null
  const imageId = iiifIdentifier(record.thumbnail?.url)
  if (!imageId) return null
  const access = record.thumbnail?.accessConditions
  if (access !== undefined && !Array.isArray(access)) return null
  if (Array.isArray(access) && access.length && !access.some(item => item?.status?.id === 'open')) return null
  const base = `https://iiif.wellcomecollection.org/image/${imageId}`
  const ratio = record.aspectRatio
  const dimensionsKnown = typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0.05 && ratio < 20
  return {
    id: `wellcome:${record.id}`,
    title: safeText(record.source?.title, 'Untitled collection image', 180),
    description: safeText(record.thumbnail?.credit, 'Wellcome Collection', 320),
    url: `${base}/full/full/0/default.jpg`,
    thumbnailUrl: `${base}/full/400,/0/default.jpg`,
    sourceUrl: `https://wellcomecollection.org/works/${workId}`,
    creator: safeText(record.source?.contributors?.[0]?.agent?.label,
      safeText(record.thumbnail?.credit, 'Wellcome Collection', 180), 180),
    license: safeText(record.thumbnail?.license?.label, 'Check source for image rights', 180),
    licenseUrl: trustedLicense(record.thumbnail?.license?.url),
    width: dimensionsKnown ? Math.round(ratio * 1000) : 1000,
    height: 1000,
    dimensionsKnown,
    provider: 'Wellcome Collection',
  }
}

export async function searchWellcome(query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const q = query.trim().slice(0, 180)
  if (!q) return { items: [], cursor: null }
  const page = cursor === null ? 1 : Number(cursor)
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE || (cursor !== null && String(page) !== cursor)) {
    throw new Error('Invalid Wellcome page cursor')
  }
  const params = new URLSearchParams({ query: q, pageSize: String(PAGE_SIZE), page: String(page) })
  const response = await fetchWithTimeout(`${API}?${params}`, signal)
  if (!response.ok) throw new Error(`Wellcome Collection unavailable (HTTP ${response.status}).`)
  const payload = requireResponseObject<WellcomeResponse>(await response.json(), 'Wellcome Collection')
  if (!Array.isArray(payload.results)) {
    throw new Error('Invalid Wellcome Collection response')
  }
  const items = normalizeProviderRecords(payload.results.slice(0, PAGE_SIZE), 'Wellcome Collection', normalizeWellcome)
  const totalPages = Number(payload.totalPages)
  const more = Number.isSafeInteger(totalPages) && totalPages > page
  return { items, cursor: more && page < MAX_PAGE ? String(page + 1) : null }
}
