import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { searchCatalog, type CatalogItem } from '../api/planRules'
import { useCatalogSearch } from './useCatalogSearch'

vi.mock('../api/planRules', () => ({ searchCatalog: vi.fn() }))

afterEach(() => {
  vi.resetAllMocks()
  vi.useRealTimers()
})

test('debounces searches and ignores a response from the previous query', async () => {
  vi.useFakeTimers()
  let finishPrevious!: (items: CatalogItem[]) => void
  vi.mocked(searchCatalog).mockReturnValueOnce(new Promise(resolve => { finishPrevious = resolve }))
    .mockResolvedValueOnce([])
  const { result, rerender } = renderHook(({ query }) => useCatalogSearch('tok', query), {
    initialProps: { query: 'pan' },
  })
  await act(async () => {})
  expect(result.current.loading).toBe(true)

  rerender({ query: 'leche' })
  expect(result.current.debouncing).toBe(true)
  expect(result.current.results).toEqual([])
  expect(searchCatalog).toHaveBeenCalledTimes(1)
  await act(async () => { finishPrevious([{ uid: 'old' } as CatalogItem]) })
  expect(result.current.results).toEqual([])
  await act(async () => { await vi.advanceTimersByTimeAsync(300) })
  expect(searchCatalog).toHaveBeenLastCalledWith('tok', 'leche')
  expect(result.current.empty).toBe(true)
  expect(result.current.loading).toBe(false)
})

test('exposes errors only for their query and skips short queries', async () => {
  vi.useFakeTimers()
  vi.mocked(searchCatalog).mockRejectedValue(new Error('search failed'))
  const { result, rerender } = renderHook(({ query }) => useCatalogSearch('tok', query), {
    initialProps: { query: 'pan' },
  })
  await act(async () => {})
  expect(result.current.error).toBe('No se pudo buscar. Intentá de nuevo.')
  expect(result.current.loading).toBe(false)
  expect(result.current.empty).toBe(false)

  rerender({ query: 'p' })
  await act(async () => { await vi.advanceTimersByTimeAsync(300) })
  expect(result.current.error).toBe('')
  expect(result.current.empty).toBe(false)
  expect(searchCatalog).toHaveBeenCalledTimes(1)
})
