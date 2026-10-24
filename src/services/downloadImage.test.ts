// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke, isTauri } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: vi.fn(() => false) }))
import { downloadOriginalImage, ImageDownloadError, isNativeAndroidDownload, makeImageFilename } from './downloadImage'

const image = { title: 'Seaside / Sunset', url: 'https://upload.wikimedia.org/example.jpg' }

describe('original image downloads', () => {
  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('URL', URL)
    URL.createObjectURL = vi.fn(() => 'blob:https://app.example/image-123')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('does not claim a native Android download in an ordinary browser', () => {
    expect(isNativeAndroidDownload()).toBe(false)
  })

  it('saves through the native bridge on Android without a WebView blob click', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 11; OnePlus)' })
    vi.mocked(invoke).mockResolvedValue('Seaside Sunset.jpg')
    expect(isNativeAndroidDownload()).toBe(true)
    expect(await downloadOriginalImage(image)).toBe('Seaside Sunset.jpg')
    expect(invoke).toHaveBeenCalledWith('save_image_android', {
      url: image.url, title: image.title,
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  })

  it('surfaces native storage failures without claiming a download', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.stubGlobal('navigator', { userAgent: 'Android' })
    vi.mocked(invoke).mockRejectedValue('Android could not finalize the downloaded file.')
    await expect(downloadOriginalImage(image)).rejects.toThrow('could not finalize')
  })

  it('sanitizes filenames rather than trusting source paths', () => {
    expect(makeImageFilename(' ../Portrait: Dawn? ', 'image/jpeg')).toBe('Portrait Dawn.jpg')
    expect(makeImageFilename('   ', 'image/png')).toBe('image.png')
  })

  it('downloads original bytes using an opaque blob URL, without credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '3' },
    }))
    let clickedHref = ''
    let clickedName = ''
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (this: HTMLAnchorElement) {
      clickedHref = this.href
      clickedName = this.download
    })
    expect(await downloadOriginalImage(image)).toBe('Seaside Sunset.jpg')
    expect(fetch).toHaveBeenCalledWith(image.url, expect.objectContaining({
      credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer',
    }))
    expect(clickedHref).toBe('blob:https://app.example/image-123')
    expect(clickedName).toBe('Seaside Sunset.jpg')
  })

  it('rejects non-HTTPS and private-network links without fetching them', async () => {
    await expect(downloadOriginalImage({ ...image, url: 'http://example.com/a.jpg' })).rejects.toBeInstanceOf(ImageDownloadError)
    await expect(downloadOriginalImage({ ...image, url: 'https://127.0.0.1/a.jpg' })).rejects.toBeInstanceOf(ImageDownloadError)
    await expect(downloadOriginalImage({ ...image, url: 'https://[::1]/a.jpg' })).rejects.toBeInstanceOf(ImageDownloadError)
    await expect(downloadOriginalImage({ ...image, url: 'https://8.8.8.8/a.jpg' })).rejects.toBeInstanceOf(ImageDownloadError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects ambiguous local DNS hosts before invoking native Android downloads', async () => {
    vi.mocked(invoke).mockClear()
    vi.mocked(isTauri).mockReturnValue(true)
    vi.stubGlobal('navigator', { userAgent: 'Android' })
    for (const url of [
      'https://localhost./image.jpg',
      'https://printer.localdomain/photo.png',
      'https://metadata.google.internal/image.jpg',
      'https://router.lan/image.jpg',
      'https://device.home.arpa/image.jpg',
      'https://intranet/image.jpg',
      'https://example.org:8443/image.jpg',
    ]) {
      await expect(downloadOriginalImage({ ...image, url })).rejects.toThrow('secure public download link')
    }
    expect(invoke).not.toHaveBeenCalled()
  })

  it('rejects HTML disguised as an image', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }))
    await expect(downloadOriginalImage(image)).rejects.toThrow('supported image file')
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  })

  it('checks declared download size before reading', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('x', { headers: {
      'Content-Type': 'image/png', 'Content-Length': String(41 * 1024 * 1024),
    } }))
    await expect(downloadOriginalImage(image)).rejects.toThrow('40 MB')
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  })

  it('reports cross-origin failures instead of pretending that a file was saved', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(downloadOriginalImage(image)).rejects.toThrow('Direct download is unavailable')
  })
})
