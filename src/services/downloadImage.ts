import type { ImageResult } from '../types'
import { invoke, isTauri } from '@tauri-apps/api/core'

const MAX_BYTES = 40 * 1024 * 1024
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/tiff': 'tif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export class ImageDownloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageDownloadError'
  }
}

/** WebView blob URLs do not reliably create files on Android. */
export function isNativeAndroidDownload(): boolean {
  return isTauri() && typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

/** Never pass provider filenames through to the host filesystem unchanged. */
export function makeImageFilename(title: string, mime: string): string {
  const stem = title
    .normalize('NFKC')
    .replace(/[\x00-\x1f\x7f/\\:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 76)
    .replace(/[.\s]+$/g, '') || 'image'
  return stem + '.' + MIME_EXTENSIONS[mime]
}

function getDownloadUrl(original: string): string {
  let parsed: URL
  try { parsed = new URL(original) } catch { throw new ImageDownloadError('This image has no valid original download link.') }
  const host = parsed.hostname.toLowerCase()
  // Reject ambiguous local DNS spellings before passing the URL to the
  // Android bridge. Native code must validate redirects independently too.
  const localName = /(?:^|\.)(?:localhost|local|localdomain|internal|lan)$/.test(host)
    || host === 'home.arpa' || host.endsWith('.home.arpa')
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password
    || (parsed.port !== '' && parsed.port !== '443')
    || host.endsWith('.') || !host.includes('.') || localName
    || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[')
    || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$)/.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new ImageDownloadError('This image has no secure public download link.')
  }
  return parsed.href
}

async function boundedImageBlob(response: Response, mime: string): Promise<Blob> {
  const sizeHeader = response.headers.get('content-length')
  if (sizeHeader && Number(sizeHeader) > MAX_BYTES) {
    throw new ImageDownloadError('This image exceeds the 40 MB download limit.')
  }
  if (!response.body) {
    const blob = await response.blob()
    if (blob.size > MAX_BYTES) throw new ImageDownloadError('This image exceeds the 40 MB download limit.')
    return new Blob([blob], { type: mime })
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) throw new ImageDownloadError('This image exceeds the 40 MB download limit.')
      chunks.push(new Uint8Array(value))
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return new Blob(chunks, { type: mime })
}

/**
 * A user-initiated download of the original image, not a saved-bookmark action.
 * Remote sources must opt in to CORS. Never silently navigate on failure or
 * mislabel a cross-origin link as a successful file download.
 */
export async function downloadOriginalImage(image: Pick<ImageResult, 'url' | 'title'>): Promise<string> {
  const url = getDownloadUrl(image.url)
  if (isNativeAndroidDownload()) {
    try {
      // The Kotlin command returns only after bytes are committed in Downloads.
      return await invoke<string>('save_image_android', { url, title: image.title })
    } catch (error) {
      throw new ImageDownloadError(
        typeof error === 'string' && error.length > 0
          ? error
          : 'Android could not save this image. Open the original source instead.',
      )
    }
  }
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), 25_000)
  let blob: Blob
  let mime: string
  try {
    const response = await fetch(url, {
      mode: 'cors',
      // A public URL may otherwise redirect the browser to a private host
      // before CORS rejects the response. Fail closed on every redirect.
      redirect: 'error',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    if (!response.ok) throw new ImageDownloadError('The image provider declined this download. Open the original source instead.')
    mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!MIME_EXTENSIONS[mime]) {
      throw new ImageDownloadError('The source did not return a supported image file. Open the original source instead.')
    }
    blob = await boundedImageBlob(response, mime)
    if (!blob.size) throw new ImageDownloadError('The image provider returned an empty file.')
  } catch (error) {
    if (error instanceof ImageDownloadError) throw error
    if (controller.signal.aborted) throw new ImageDownloadError('The image download timed out. Try again.')
    throw new ImageDownloadError('Direct download is unavailable from this source. Open the original image and save it there.')
  } finally {
    globalThis.clearTimeout(timeout)
  }

  const filename = makeImageFilename(image.title, mime!)
  const objectUrl = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    try { link.click() } finally { link.remove() }
  } catch {
    URL.revokeObjectURL(objectUrl)
    throw new ImageDownloadError('Your browser could not start the download. Open the original image instead.')
  }
  // Keep the blob alive long enough for browser/WebView download handlers.
  globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  return filename
}
