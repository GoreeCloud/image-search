import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'
import { normalizeProviderRecords, requireResponseObject } from './providerResponse'

const API = 'https://api.vam.ac.uk/v2/objects/search'
const PAGE_SIZE = 20
const MAX_PAGE = 100

type VamRecord = {
  systemNumber?: string
  _primaryTitle?: string
  _primaryMaker?: { name?: string }
  _primaryImageId?: string
  _warningTypes?: unknown[]
}
type VamResponse = { info?: { pages?: number }; records?: VamRecord[] }

function safeText(value: unknown, fallback: string, limit: number): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback
}

export function normalizeVam(record: VamRecord): ImageResult | null {
  if (!record || typeof record.systemNumber !== 'string' || !/^O\d{1,16}$/.test(record.systemNumber)) return null
  const imageId = record._primaryImageId
  if (typeof imageId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(imageId)) return null
  if (record._warningTypes !== undefined && (!Array.isArray(record._warningTypes) || record._warningTypes.length > 0)) return null
  const base = `https://framemark.vam.ac.uk/collections/${imageId}`
  return {
    id: `vam:${record.systemNumber}`,
    title: safeText(record._primaryTitle, 'Untitled museum object', 180),
    description: 'Victoria and Albert Museum collection image',
    url: `${base}/full/full/0/default.jpg`,
    thumbnailUrl: `${base}/full/!600,600/0/default.jpg`,
    sourceUrl: `https://collections.vam.ac.uk/item/${record.systemNumber}/`,
    creator: safeText(record._primaryMaker?.name, 'Maker not specified', 180),
    license: 'Check V&A museum record for image rights',
    licenseUrl: null,
    width: 1000,
    height: 1000,
    dimensionsKnown: false,
    provider: 'Victoria and Albert Museum',
  }
}

export async function searchVam(query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const q = query.trim().slice(0, 180)
  if (!q) return { items: [], cursor: null }
  const page = cursor === null ? 1 : Number(cursor)
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE || (cursor !== null && String(page) !== cursor)) {
    throw new Error('Invalid V&A page cursor')
  }
  const params = new URLSearchParams({ q, page_size: String(PAGE_SIZE), images_exist: 'true', page: String(page) })
  const response = await fetchWithTimeout(`${API}?${params}`, signal)
  if (!response.ok) throw new Error(`Victoria and Albert Museum unavailable (HTTP ${response.status}).`)
  const payload = requireResponseObject<VamResponse>(await response.json(), 'Victoria and Albert Museum')
  if (!Array.isArray(payload.records)) {
    throw new Error('Invalid Victoria and Albert Museum response')
  }
  const items = normalizeProviderRecords(payload.records.slice(0, PAGE_SIZE), 'Victoria and Albert Museum', normalizeVam)
  const totalPages = Number(payload.info?.pages)
  const more = Number.isSafeInteger(totalPages) && totalPages > page
  return { items, cursor: more && page < MAX_PAGE ? String(page + 1) : null }
}
