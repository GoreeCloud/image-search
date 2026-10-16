// Deliberately volatile: keys never enter localStorage, URLs, logs, or source.
let pexelsKey = ''

export function setPexelsKey(key: string): void {
  const clean = key.trim()
  if (clean.length > 256) throw new Error('API key is too long')
  pexelsKey = clean
}

export function getPexelsKey(): string { return pexelsKey }
export function hasPexelsKey(): boolean { return pexelsKey.length > 0 }
