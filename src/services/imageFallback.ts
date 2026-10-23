import type { ImageResult } from '../types'

// Automatic fallback stays with trusted media services.
// Arbitrary original hosts from Openverse are opened only by user action.
export function trustedImageFallback(item: ImageResult): string | null {
  try {
    const preview = new URL(item.thumbnailUrl)
    const original = new URL(item.url)
    const commons = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org'])
    const sameTrustedService =
      (commons.has(preview.hostname) && commons.has(original.hostname)) ||
      (new Set(['tile.loc.gov', 'cdn.loc.gov']).has(preview.hostname) && new Set(['tile.loc.gov', 'cdn.loc.gov']).has(original.hostname)) ||
      (preview.hostname === 'images-assets.nasa.gov' && original.hostname === 'images-assets.nasa.gov') ||
      (preview.hostname === 'openaccess-cdn.clevelandart.org' && original.hostname === 'openaccess-cdn.clevelandart.org') ||
      (preview.hostname === 'images.metmuseum.org' && original.hostname === 'images.metmuseum.org') ||
      (preview.hostname === 'iiif.wellcomecollection.org' && original.hostname === 'iiif.wellcomecollection.org') ||
      (preview.hostname === 'framemark.vam.ac.uk' && original.hostname === 'framemark.vam.ac.uk')
    return sameTrustedService && original.protocol === 'https:' && original.href !== preview.href
      ? original.href : null
  } catch { return null }
}
