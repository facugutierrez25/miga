import { useEffect, useState } from 'react'
import { searchCatalog, type CatalogItem } from '../api/planRules'
import { useDebouncedValue } from './useDebouncedValue'

export function useCatalogSearch(token: string, query: string) {
  const [response, setResponse] = useState<{ query: string; items: CatalogItem[] }>({ query: '', items: [] })
  const [failure, setFailure] = useState({ query: '', message: '' })
  const [loadingQuery, setLoadingQuery] = useState<string | null>(null)
  const debouncedQuery = useDebouncedValue(query)
  useEffect(() => {
    if (query !== debouncedQuery) return
    let active = true
    if (query.trim().length < 2) return
    Promise.resolve().then(() => {
      if (!active) return
      setLoadingQuery(query)
      setFailure({ query, message: '' })
      return searchCatalog(token, query.trim())
        .then((data) => {
          if (active && data) setResponse({ query, items: data })
        })
        .catch(() => {
          if (active) setFailure({ query, message: 'No se pudo buscar. Intentá de nuevo.' })
        })
        .finally(() => {
          if (active) setLoadingQuery(null)
        })
    })

    return () => {
      active = false
    }
  }, [token, query, debouncedQuery])

  const results = response.query === query ? response.items : []
  const error = failure.query === query ? failure.message : ''
  const loading = loadingQuery === query && query.trim().length >= 2
  const debouncing = query !== debouncedQuery
  const empty = !loading && !debouncing && !error && query.trim().length >= 2
    && response.query === query && results.length === 0
  return { results, error, loading, debouncing, empty }
}
