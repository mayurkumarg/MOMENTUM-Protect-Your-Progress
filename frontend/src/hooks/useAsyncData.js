import { useCallback, useEffect, useState } from 'react'

export function useAsyncData(loader, { enabled = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(enabled))
  const [isFetching, setIsFetching] = useState(false)

  const refetch = useCallback(async () => {
    if (!enabled) return null

    setIsFetching(true)
    setError(null)

    try {
      const result = await loader()
      setData(result)
      return result
    } catch (requestError) {
      setError(requestError)
      throw requestError
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }, [enabled, loader])

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)
    setError(null)

    loader()
      .then((result) => {
        if (active) setData(result)
      })
      .catch((requestError) => {
        if (active) setError(requestError)
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
          setIsFetching(false)
        }
      })

    return () => {
      active = false
    }
  }, [enabled, loader])

  return { data, setData, error, isLoading, isFetching, refetch }
}
