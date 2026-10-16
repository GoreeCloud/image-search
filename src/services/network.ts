/**
 * Bound individual remote API requests and correctly dispose of abort listeners.
 * Never caches requests or transmits credentials.
 */
export async function fetchWithTimeout(url: string, signal?: AbortSignal, timeoutMs = 16000): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const abortRequest = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abortRequest, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  try {
    return await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (reason) {
    if (timedOut) throw new Error('Image source timed out. Please retry.')
    throw reason
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abortRequest)
  }
}
