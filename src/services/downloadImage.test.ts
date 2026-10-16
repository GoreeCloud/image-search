// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadOriginalImage, ImageDownloadError, isNativeAndroidDownload, makeImageFilename } from './downloadImage'

const image = { title: 'Seaside / Sunset', url: 'https://upload.wikimedia.org/example.jpg' }

describe('original image downloads', () => {
  beforeEach(() => {
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
