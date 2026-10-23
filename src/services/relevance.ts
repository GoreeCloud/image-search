import type { ImageResult } from '../types'

/** Collections excel at culture and photography, not current device screenshots. */
const MODERN_TECH_TERMS = /\b(?:one[\s_-]*ui|android|samsung|iphone|ipad|ios|macos|oneplus|oxygenos|hyperos|screenshots?|software interface|user interface|home screen|quick settings|windows\s+(?:10|11|xp|vista|desktop)|google\s+pixel)\b/i
const IGNORED_TERMS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'the', 'to', 'with', 'image', 'images', 'photo', 'photos'])
const NON_SCREEN_ASSET = /\b(?:fonts?|sans|typeface|typography|logos?|emblems?|icons?|wallpapers?|vector|badge|sticker)\b/i
const SCREEN_EVIDENCE = /\b(?:screenshots?|screens?|settings|setup|interface|launcher|notifications?|panel|home|lock|updates?|gesture|navigation|quick)\b/i

function tokens(text: string): string[] {
  return [...new Set(text.toLowerCase()
    .replace(/\bone[\s_-]*ui\b/g, 'one ui')
    .replace(/\boxygen[\s_-]*os\b/g, 'oxygen os')
    .replace(/\bhyper[\s_-]*os\b/g, 'hyper os')
    .match(/[\p{L}\p{N}]+/gu)?.filter(word => word.length > 1 && !IGNORED_TERMS.has(word)) ?? [])]
}

/** Public API: the source selector remains unrestricted when a user chooses one source. */
export function isModernTechnologyQuery(query: string): boolean {
  return MODERN_TECH_TERMS.test(query)
}

export function sourcesForQuery<T extends string>(query: string, sources: readonly T[]): T[] {
  return isModernTechnologyQuery(query)
    ? sources.filter(source => source === 'commons' || source === 'openverse')
    : [...sources]
}

/** A conservative fallback until the public general-web image API is production ready. */
export function rankCollectionImages(query: string, images: readonly ImageResult[]): ImageResult[] {
  if (!isModernTechnologyQuery(query)) return [...images]
  const queryTokens = tokens(query)
  if (!queryTokens.length) return [...images]
  const wantsAsset = NON_SCREEN_ASSET.test(query)

  const scored = images.map((image, index) => {
    const title = new Set(tokens(image.title))
    const description = new Set(tokens(image.description))
    const titleHits = queryTokens.filter(token => title.has(token)).length
    const descriptionHits = queryTokens.filter(token => description.has(token)).length
    const totalHits = queryTokens.filter(token => title.has(token) || description.has(token)).length
    const unrelatedAsset = !wantsAsset && NON_SCREEN_ASSET.test(image.title)
    const screenBonus = SCREEN_EVIDENCE.test(image.title) ? 5 : SCREEN_EVIDENCE.test(image.description) ? 1 : 0
    return { image, index, titleHits, totalHits, unrelatedAsset, score: titleHits * 4 + descriptionHits + screenBonus }
  })
  return scored
    .filter(({ titleHits, totalHits, unrelatedAsset }) => !unrelatedAsset && titleHits > 0 && totalHits >= Math.min(2, queryTokens.length))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ image }) => image)
}
