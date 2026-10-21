/**
 * Bound the entire remote API response, not just the time until HTTP headers.
 * A provider can send headers then stall while JSON is being read.
 * Never caches requests or transmits credentials.
 */
export async function fetchWithTimeout(url: string, signal?: AbortSignal, timeoutMs = 16000, extraHeaders?: Record<string, string>): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const abortRequest = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abortRequest, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const release = () => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abortRequest)
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json', ...extraHeaders },
    })
    if (!response.body) {
      release()
      return response
    }
    // Keep the same timeout in force until consumers finish/cancel the body.
    const reader = response.body.getReader()
    const body = new ReadableStream<Uint8Array>({
      async pull(sink) {
        try {
          const chunk = await reader.read()
          if (chunk.done) {
            release()
            sink.close()
          } else if (chunk.value) sink.enqueue(chunk.value)
        } catch (reason) {
          release()
          sink.error(timedOut ? new Error('Image source timed out. Please retry.') : reason)
        }
      },
      async cancel(reason) {
        release()
        await reader.cancel(reason).catch(() => {})
      },
    })
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
  } catch (reason) {
    release()
    if (timedOut) throw new Error('Image source timed out. Please retry.')
    throw reason
  }
}
