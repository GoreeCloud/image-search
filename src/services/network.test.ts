import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout } from './network'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('bounded provider requests', () => {
  it('forwards external request cancellation', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options: RequestInit) =>
      new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError'))))))
    const pending = fetchWithTimeout('https://api.openverse.org/v1/images/', controller.signal)
    controller.abort()
    await expect(pending).rejects.toThrow('Cancelled')
  })

  it('aborts hung provider requests with a readable timeout error', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options: RequestInit) =>
      new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError'))))))
    const pending = fetchWithTimeout('https://commons.wikimedia.org/w/api.php', undefined, 100)
    const assertion = expect(pending).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(101)
    await assertion
  })
})


it('continues timing out after headers if the provider body stalls', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options: RequestInit) => {
    const body = new ReadableStream<Uint8Array>({
      start(sink) {
        options.signal?.addEventListener('abort', () => sink.error(new DOMException('Cancelled', 'AbortError')))
      },
    })
    return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }))
  const response = await fetchWithTimeout('https://api.openverse.org/v1/images/', undefined, 100)
  const assertion = expect(response.json()).rejects.toThrow('timed out')
  await vi.advanceTimersByTimeAsync(101)
  await assertion
})
it('preserves caller cancellation while reading a provider response body', async () => {
  const external = new AbortController()
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options: RequestInit) => {
    const body = new ReadableStream<Uint8Array>({
      start(sink) {
        options.signal?.addEventListener('abort', () => sink.error(new DOMException('Cancelled', 'AbortError')))
      },
    })
    return Promise.resolve(new Response(body))
  }))
  const response = await fetchWithTimeout('https://commons.wikimedia.org/w/api.php', external.signal, 100)
  const assertion = expect(response.text()).rejects.toThrow('Cancelled')
  external.abort()
  await assertion
})

it('rejects oversized JSON responses before full buffering', async () => {
  const source = vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
    start(sink) {
      sink.enqueue(new Uint8Array(4 * 1024 * 1024 + 1))
      sink.close()
    },
  }), { status: 200 }))
  vi.stubGlobal('fetch', source)
  const response = await fetchWithTimeout('https://api.openverse.org/v1/images/')
  await expect(response.arrayBuffer()).rejects.toThrow('4 MB safety limit')
  expect(source).toHaveBeenCalledTimes(1)
})

it('omits credentials and referrers while refusing redirects for provider API calls', async () => {
  const provider = vi.fn().mockResolvedValue(new Response('{"ok":true}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))
  vi.stubGlobal('fetch', provider)
  const response = await fetchWithTimeout('https://api.openverse.org/v1/images/')
  expect(await response.json()).toEqual({ ok: true })
  expect(provider).toHaveBeenCalledWith('https://api.openverse.org/v1/images/', expect.objectContaining({
    method: 'GET',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    cache: 'no-store',
  }))
})
