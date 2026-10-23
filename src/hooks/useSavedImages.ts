import { useCallback, useEffect, useState } from 'react'
import type { ImageResult } from '../types'

const STORAGE_KEY = 'image-search.saved.v1'

function isWebUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:')
      && Boolean(parsed.hostname) && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

/** Persisted browser storage is untrusted and may outlive an application upgrade. */
export function isSavedImageResult(value: unknown): value is ImageResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const image = value as Record<string, unknown>
  const fields = ['id', 'title', 'description', 'creator', 'license', 'provider'] as const
  return fields.every(field => typeof image[field] === 'string')
    && (image.id as string).length > 0
    && isWebUrl(image.url)
    && isWebUrl(image.thumbnailUrl)
    && isWebUrl(image.sourceUrl)
    && (image.licenseUrl === null || isWebUrl(image.licenseUrl))
    && typeof image.width === 'number' && Number.isFinite(image.width) && image.width > 0
    && typeof image.height === 'number' && Number.isFinite(image.height) && image.height > 0
}

export function filterSavedImages(value: unknown): ImageResult[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  return value.filter((image): image is ImageResult => {
    if (!isSavedImageResult(image) || ids.has(image.id)) return false
    ids.add(image.id)
    return true
  }).slice(0, 500)
}

function initialImages(): ImageResult[] {
  try {
    return filterSavedImages(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as unknown)
  } catch { return [] }
}

export function useSavedImages() {
  const [saved, setSaved] = useState<ImageResult[]>(initialImages)
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [saved])

  const toggleSaved = useCallback((item: ImageResult) => {
    setSaved((current) => current.some((x) => x.id === item.id)
      ? current.filter((x) => x.id !== item.id)
      : [item, ...current].slice(0, 500))
  }, [])

  const isSaved = useCallback((id: string) => saved.some((item) => item.id === id), [saved])

  return { saved, toggleSaved, isSaved, storageError }
}
