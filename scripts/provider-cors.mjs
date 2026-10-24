/**
 * Header-only, synthetic API checks. An allowed CORS header is necessary for
 * browser fetch, but is not proof that a browser can render provider images.
 * These probes never send user queries, cookies, or API keys.
 */
export const PROVIDER_CORS_TARGETS = Object.freeze([
  { name: 'Openverse', url: 'https://api.openverse.org/v1/images/', params: { q: 'mountain', page: '1', page_size: '2', mature: 'false' } },
  { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/w/api.php', params: { action: 'query', generator: 'search', gsrsearch: 'mountain', gsrnamespace: '6', gsrlimit: '2', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '720', format: 'json', formatversion: '2', origin: '*' } },
  { name: 'NASA Images', url: 'https://images-api.nasa.gov/search', params: { q: 'mountain', media_type: 'image', page_size: '2', page: '1' } },
  { name: 'Library of Congress', url: 'https://www.loc.gov/photos/', params: { fo: 'json', q: 'mountain', c: '2', sp: '1', at: 'results,pagination' } },
  { name: 'Cleveland Museum of Art', url: 'https://openaccess-api.clevelandart.org/api/artworks/', params: { q: 'mountain', cc0: '1', has_image: '1', limit: '2', skip: '0' } },
  { name: 'The Met', url: 'https://collectionapi.metmuseum.org/public/collection/v1.1/search', params: { q: 'mountain', hasImages: 'true', limit: '2', offset: '0' } },
  { name: 'Wellcome Collection', url: 'https://api.wellcomecollection.org/catalogue/v2/images', params: { query: 'mountain', pageSize: '2', page: '1' } },
  { name: 'Victoria and Albert Museum', url: 'https://api.vam.ac.uk/v2/objects/search', params: { q: 'mountain', page_size: '2', images_exist: 'true', page: '1' } },
])

export function validatedOrigin(input) {
  let parsed
  try { parsed = new URL(input) } catch { throw new Error('Origin must be an absolute HTTP(S) origin.') }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password
    || parsed.pathname !== '/' || parsed.search || parsed.hash
    || (parsed.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) {
    throw new Error('Use an HTTPS app origin, or HTTP localhost for development.')
  }
  return parsed.origin
}

export function corsPermission(allowOrigin, origin) {
  // Credentials are omitted by Image Search. Wildcard is therefore acceptable.
  return allowOrigin === '*' || allowOrigin === origin ? 'allowed' : 'blocked'
}

export function providerProbeUrl(target) {
  const url = new URL(target.url)
  for (const [name, value] of Object.entries(target.params)) url.searchParams.set(name, value)
  return url.href
}

export async function probeProviderCors(target, origin, { request = fetch, timeoutMs = 12000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()
  try {
    const response = await request(providerProbeUrl(target), {
      method: 'GET',
      headers: { Accept: 'application/json', Origin: origin },
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    const allowOrigin = response.headers.get('access-control-allow-origin')
    // The entire JSON payload is neither necessary nor retained for this check.
    await response.body?.cancel().catch(() => {})
    return {
      provider: target.name,
      httpStatus: response.status,
      allowOrigin,
      verdict: response.ok ? corsPermission(allowOrigin, origin) : 'http-error',
      durationMs: Date.now() - started,
    }
  } catch {
    return {
      provider: target.name,
      httpStatus: null,
      allowOrigin: null,
      verdict: controller.signal.aborted ? 'timeout' : 'network-error',
      durationMs: Date.now() - started,
    }
  } finally {
    clearTimeout(timer)
  }
}
