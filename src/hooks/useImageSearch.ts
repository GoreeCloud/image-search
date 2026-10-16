import { useCallback, useEffect, useRef, useState } from 'react'
import { searchCommons } from '../services/commons'
import { searchOpenverse } from '../services/openverse'
import type { ImageResult } from '../types'

export type SearchSource = 'openverse' | 'commons'

export function useImageSearch(query: string, refreshKey = 0, source: SearchSource = 'openverse') {
  const searchProvider = source === 'openverse' ? searchOpenverse : searchCommons
  const [images, setImages] = useState<ImageResult[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    setLoadMoreError(null)
    setLoading(true)
    setLoadingMore(false)

    searchProvider(query, null, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || request !== requestRef.current) return
        setImages(result.items)
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
      const result = await searchProvider(query, cursor, controllerRef.current?.signal)
      if (request !== requestRef.current || controllerRef.current?.signal.aborted) return
      setImages((prev) => {
        const seen = new Set(prev.map((item) => item.id))
        return [...prev, ...result.items.filter((item) => !seen.has(item.id))]
      })
      setCursor(result.cursor)
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
  }, [cursor, error, loading, loadingMore, query, source])

  return { images, loading, loadingMore, error, loadMoreError, hasMore: Boolean(cursor), loadMore }
}
