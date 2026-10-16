import { useCallback, useEffect, useRef, useState } from 'react'
import { SOURCE_SEARCH, searchAllSources, uniqueImages } from '../services/providers'
import { normalizeImageQuery } from '../services/query'
import type { ImageSource } from '../services/providers'
import type { ImageResult } from '../types'

export function useImageSearch(query: string, refreshKey = 0, source: ImageSource = 'all') {
  const normalizedQuery = normalizeImageQuery(query)
  const searchProvider = source === 'all' ? searchAllSources : SOURCE_SEARCH[source]
  const [images, setImages] = useState<ImageResult[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailableSources, setUnavailableSources] = useState<string[]>([])
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const requestRef = useRef(0)
  const moreBusyRef = useRef(false)

  useEffect(() => {
    const request = ++requestRef.current
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    moreBusyRef.current = false
    setImages([])
    setCursor(null)
    setError(null)
    setUnavailableSources([])
    setLoadMoreError(null)
    setLoading(true)
    setLoadingMore(false)

    searchProvider(normalizedQuery, null, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || request !== requestRef.current) return
        setImages(uniqueImages(result.items))
        setUnavailableSources(result.unavailableSources || [])
        setCursor(result.cursor)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || request !== requestRef.current) return
        setError(reason instanceof Error ? reason.message : 'Unable to search images.')
      })
      .finally(() => { if (request === requestRef.current) setLoading(false) })

    return () => controller.abort()
  }, [query, refreshKey, source])

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || moreBusyRef.current || !cursor || error) return
    moreBusyRef.current = true
    setLoadingMore(true)
    setLoadMoreError(null)
    const request = requestRef.current

    try {
      const result = await searchProvider(normalizedQuery, cursor, controllerRef.current?.signal)
      if (request !== requestRef.current || controllerRef.current?.signal.aborted) return
      setImages((prev) => {
        return uniqueImages([...prev, ...result.items])
      })
      setCursor(result.cursor)
      setUnavailableSources(old => [...new Set([...old, ...(result.unavailableSources || [])])])
    } catch (reason) {
      if (request === requestRef.current && !controllerRef.current?.signal.aborted) {
        setLoadMoreError(reason instanceof Error ? reason.message : 'Could not load more images.')
      }
    } finally {
      if (request === requestRef.current) {
        setLoadingMore(false)
        moreBusyRef.current = false
      }
    }
  }, [cursor, error, loading, loadingMore, query, normalizedQuery, source])

  return { images, loading, loadingMore, unavailableSources, error, loadMoreError, hasMore: Boolean(cursor), loadMore }
}
