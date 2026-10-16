import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'
import { getEuropeanaKey } from './apiKeys'

type EuropeanaRecord = {
  id?: string
  type?: string
  title?: string[]
  dcCreator?: string[]
  dcDescription?: string[]
  edmPreview?: string[]
  previewNoDistribute?: boolean
  rights?: string[]
}
type Results = { items?: EuropeanaRecord[]; totalResults?: number }

function trustedPreview(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || !['api.europeana.eu','www.europeana.eu','images.europeana.eu'].includes(url.hostname)) return null
    for (const key of ['apikey', 'api_key', 'wskey']) url.searchParams.delete(key)
    return url.href
  } catch { return null }
}
function rightsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const rights = url.href.replace(/^http:/,'https:')
    if (/^https:\/\/creativecommons\.org\/(licenses\/by(?:-sa)?\/|publicdomain\/(?:zero|mark)\/)/.test(rights)) return rights
    return null
  } catch { return null }
}
function safeRecordSource(id: unknown): string | null {
  if (typeof id !== 'string' || id.length > 170 || !/^\/[A-Za-z0-9_./-]+$/.test(id)) return null
  const path = id.split('/').filter(Boolean)
  if (!path.length || path.some(segment => segment === '..' || segment === '.')) return null
  return 'https://www.europeana.eu/en/item/' + path.map(encodeURIComponent).join('/')
}

export function normalizeEuropeana(item: EuropeanaRecord): ImageResult | null {
  if (item.type !== 'IMAGE' || item.previewNoDistribute) return null
  const sourceUrl = safeRecordSource(item.id)
  const thumbnailUrl = trustedPreview(item.edmPreview?.[0])
  const licenseUrl = rightsUrl(item.rights?.[0])
  if (!sourceUrl || !thumbnailUrl || !licenseUrl) return null
  return {
    id: `europeana:${item.id}`,
    title: (item.title?.[0] || 'Untitled cultural heritage image').slice(0, 180),
    description: (item.dcDescription?.[0] || '').slice(0, 320),
    thumbnailUrl,
    url: thumbnailUrl,
    sourceUrl,
    creator: (item.dcCreator?.[0] || 'Creator not specified').slice(0, 180),
    license: 'Open reuse · Check item conditions',
    licenseUrl,
    width: 900,
    height: 700,
    provider: 'Europeana',
  }
}

export async function searchEuropeana(query: string, cursor: string | null, signal?: AbortSignal): Promise<SearchPage> {
  const key = getEuropeanaKey()
  if (!key) throw new Error('Add your Europeana API key in Settings → API.')
  const q = query.trim().slice(0, 180)
  if (!q) return { items: [], cursor: null }
  const start = cursor === null ? 1 : Number(cursor)
  if (!Number.isSafeInteger(start) || start < 1 || start > 2401 || (start - 1) % 24) throw new Error('Invalid Europeana page cursor')
  const params = new URLSearchParams({ query: q, rows: '24', start: String(start), reusability: 'open', thumbnail: 'true', qf: 'TYPE:IMAGE' })
  const response = await fetchWithTimeout(`https://api.europeana.eu/record/v2/search.json?${params}`, signal, 16000, { 'X-Api-Key': key })
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Europeana API key was rejected or lacks access.' : `Europeana search unavailable (HTTP ${response.status}).`)
  const result = await response.json() as Results
  return {
    items: (result.items || []).map(normalizeEuropeana).filter((item): item is ImageResult => item !== null),
    cursor: start + 24 <= Math.min(2401,Math.max(0,result.totalResults || 0)) ? String(start + 24) : null,
  }
}
