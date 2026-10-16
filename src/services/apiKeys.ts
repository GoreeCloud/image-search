// Deliberately volatile: keys never enter localStorage, URLs, logs, or source.
let europeanaKey = ''

export function setEuropeanaKey(key: string): void {
  const clean = key.trim()
  if (clean.length > 256) throw new Error('API key is too long')
  europeanaKey = clean
}

export function getEuropeanaKey(): string { return europeanaKey }
export function hasEuropeanaKey(): boolean { return europeanaKey.length > 0 }
