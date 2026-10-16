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
