import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

afterEach(() => vi.useRealTimers())

it('espera 300 ms desde la última tecla', () => {
  vi.useFakeTimers()
  const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), { initialProps: { value: '' } })
  rerender({ value: 'pa' })
  act(() => vi.advanceTimersByTime(200))
  rerender({ value: 'pan' })
  act(() => vi.advanceTimersByTime(299))
  expect(result.current).toBe('')
  act(() => vi.advanceTimersByTime(1))
  expect(result.current).toBe('pan')
})

it('limpia el temporizador al desmontar', () => {
  vi.useFakeTimers()
  const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value), { initialProps: { value: '' } })
  rerender({ value: 'pan' })
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
