import type { ImageResult, SearchPage } from '../types'
import { fetchWithTimeout } from './network'

const API = 'https://commons.wikimedia.org/w/api.php'
const TRUSTED_IMAGE_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org']
const TRUSTED_PAGE_HOST = 'commons.wikimedia.org'

type CommonsMetadata = Record<string, { value?: string }>
type CommonsInfo = {
  url?: string
  thumburl?: string
  descriptionurl?: string
  width?: number
  height?: number
  extmetadata?: CommonsMetadata
}
type CommonsPage = {
  pageid?: number
  index?: number
  title?: string
  imageinfo?: CommonsInfo[]
}
type CommonsResponse = {
  query?: { pages?: CommonsPage[] }
  continue?: { gsrcontinue?: string; gsroffset?: number; continue?: string }
  error?: { code?: string; info?: string }
}

export function isSafeHttpsUrl(value: unknown, host: string): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === host
  } catch {
    return false
  }
}

function validLicenseUrl(value?: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch { return null }
}

function plainText(value?: string): string {
  if (!value) return ''
  // Metadata is text, never injected as markup into the document.
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim()
}

function mediaTitle(value: string): string {
  return value.replace(/^File:/i, '').replace(/\.(jpe?g|png|webp|gif)$/i, '').replace(/_/g, ' ').trim()
}

export function normalizePage(page: CommonsPage): ImageResult | null {
  const info = page.imageinfo?.[0]
  if (!info || !page.title || !page.pageid) return null
  if (!/\.(jpe?g|png|webp|gif)$/i.test(page.title)) return null
  if (!TRUSTED_IMAGE_HOSTS.some(host => isSafeHttpsUrl(info.url, host))) return null
  const thumbnailUrl = TRUSTED_IMAGE_HOSTS.some(host => isSafeHttpsUrl(info.thumburl, host)) ? info.thumburl! : info.url
  const sourceUrl = isSafeHttpsUrl(info.descriptionurl, TRUSTED_PAGE_HOST)
    ? info.descriptionurl
    : `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
  const metadata = info.extmetadata ?? {}
  const description = plainText(metadata.ImageDescription?.value)
  const creator = plainText(metadata.Artist?.value) || 'Creator not specified'
  const license = plainText(metadata.LicenseShortName?.value) || 'See source for terms'
  const licenseUrl = validLicenseUrl(metadata.LicenseUrl?.value)

  return {
    id: `commons:${page.pageid}`,
    title: mediaTitle(page.title),
    url: info.url!,
    thumbnailUrl: thumbnailUrl!,
    sourceUrl,
    description: description.slice(0, 320),
    creator: creator.slice(0, 180),
    license: license.slice(0, 90),
    licenseUrl,
    width: Math.max(info.width || 1, 1),
    height: Math.max(info.height || 1, 1),
    provider: 'Wikimedia Commons',
  }
}

export async function searchCommons(
  searchTerm: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<SearchPage> {
  const query = searchTerm.trim().slice(0, 180)
  if (!query) return { items: [], cursor: null }

  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '36',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '720',
    format: 'json',
    formatversion: '2',
    origin: '*',
  })
  if (cursor) {
    let continuation: Record<string, string | number>
    try {
      continuation = JSON.parse(cursor) as Record<string, string | number>
    } catch {
      throw new Error('Invalid page cursor')
    }
    if (typeof continuation.continue === 'string') params.set('continue', continuation.continue)
    if (typeof continuation.gsrcontinue === 'string') params.set('gsrcontinue', continuation.gsrcontinue)
    if (typeof continuation.gsroffset === 'number') params.set('gsroffset', String(continuation.gsroffset))
  }

  const response = await fetchWithTimeout(`${API}?${params.toString()}`, signal)
  if (!response.ok) {
    if (response.status === 429) throw new Error('Image source is busy. Please try again shortly.')
    throw new Error(`Image search unavailable (HTTP ${response.status}).`)
  }
  const json = await response.json() as CommonsResponse
  if (json.error) throw new Error('Image source error. Try a different search.')
  const pages = (json.query?.pages || []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  const items = pages.map(normalizePage).filter((item): item is ImageResult => item !== null)
  const next = json.continue && (json.continue.gsrcontinue || json.continue.gsroffset !== undefined)
    ? JSON.stringify(json.continue) : null
  return { items, cursor: next }
}
