import { useCallback, useEffect, useRef, useState } from 'react'
import { SOURCE_SEARCH, searchAllSources, uniqueImages } from '../services/providers'
import { searchDiscovery } from '../services/discovery'
import type { ImageSource } from '../services/providers'
import type { ImageResult } from '../types'

export function useImageSearch(query: string, refreshKey = 0, source: ImageSource = 'all') {
  const searchProvider = source === 'all' ? (query.trim() ? searchAllSources : searchDiscovery) : SOURCE_SEARCH[source]
  const effectiveQuery = query.trim() || 'nature'
  const [images, setImages] = useState<ImageResult[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [unavailableSources, setUnavailableSources] = useState<string[]>([])
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
    setLoadMoreError(null)
    setUnavailableSources([])
    setLoading(true)
    setLoadingMore(false)

    searchProvider(effectiveQuery, null, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || request !== requestRef.current) return
        setImages(uniqueImages(result.items))
        setCursor(result.cursor)
        setUnavailableSources(result.unavailableSources ?? [])
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
      const result = await searchProvider(effectiveQuery, cursor, controllerRef.current?.signal)
      if (request !== requestRef.current || controllerRef.current?.signal.aborted) return
      setImages((prev) => {
        return uniqueImages([...prev, ...result.items])
      })
      setCursor(result.cursor)
      setUnavailableSources(result.unavailableSources ?? [])
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
  }, [cursor, effectiveQuery, error, loading, loadingMore, query, source])

  return { images, loading, loadingMore, error, loadMoreError, unavailableSources, hasMore: Boolean(cursor), loadMore }
}
