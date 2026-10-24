import type { ImageResult } from '../types'

/** API JSON is untrusted even when TypeScript describes its expected shape. */
export function requireResponseObject<T extends object>(value: unknown, provider: string): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${provider} response`)
  }
  return value as T
}

/** A single damaged provider record should not discard its valid neighbors. */
export function normalizeProviderRecords<T>(
  value: unknown,
  provider: string,
  normalize: (record: T) => ImageResult | null,
): ImageResult[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${provider} results`)
  const items: ImageResult[] = []
  // All current provider page sizes are at most 36. Bound pathological arrays.
  for (const record of value.slice(0, 100) as unknown[]) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue
    try {
      const item = normalize(record as T)
      if (item && typeof item.id === 'string' && item.id.length > 0
        && typeof item.title === 'string' && typeof item.provider === 'string'
        && typeof item.url === 'string' && typeof item.thumbnailUrl === 'string'
        && typeof item.sourceUrl === 'string'
        && Number.isFinite(item.width) && item.width > 0
        && Number.isFinite(item.height) && item.height > 0) {
        items.push(item)
      }
    } catch {
      // A malformed row is not a provider-wide outage. Never log its contents.
    }
  }
  return items
}
