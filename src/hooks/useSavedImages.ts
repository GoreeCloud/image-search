import { useCallback, useEffect, useState } from 'react'
import type { ImageResult } from '../types'

const STORAGE_KEY = 'image-search.saved.v1'

function initialImages(): ImageResult[] {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(data)) return []
    return data.filter((item): item is ImageResult => typeof item?.id === 'string'
      && typeof item?.thumbnailUrl === 'string' && typeof item?.sourceUrl === 'string').slice(0, 500)
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
