import type { ImageResult } from '../types'

/**
 * A copyright glyph is a caution about reuse rights, NOT an assertion that
 * the source definitely owns copyright. Hide it only for explicitly declared
 * public-domain/CC0 assets; CC BY and CC BY-SA retain copyright.
 */
export function showCopyrightNotice(image: Pick<ImageResult, 'license'>): boolean {
  const license = image.license.trim()
  if (!license) return true
  return !/\b(?:CC0|public\s+domain|public\s+domain\s+mark|PDM)\b/i.test(license)
}
