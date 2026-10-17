/** Common technology names are written differently across indexed sources. */
export function normalizeImageQuery(input: string): string {
  return input.trim().replace(/\bone[\s-]?ui\b/gi, 'One UI')
}
