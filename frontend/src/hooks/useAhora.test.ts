import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useAhora } from './useAhora'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 22, 8, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

test('se actualiza cada minuto', () => {
  const { result } = renderHook(() => useAhora())
  expect(result.current.getHours()).toBe(8)

  act(() => {
    vi.advanceTimersByTime(60_000)
  })

  expect(result.current.getMinutes()).toBe(1)
})

test('se actualiza al volver la app al frente', () => {
  const { result } = renderHook(() => useAhora())

  act(() => {
    // La app estuvo en segundo plano y vuelve a la tarde, sin que corrieran los intervalos
    vi.setSystemTime(new Date(2026, 9, 22, 17, 30))
    document.dispatchEvent(new Event('visibilitychange'))
  })

  expect(result.current.getHours()).toBe(17)
  expect(result.current.getMinutes()).toBe(30)
})

test('se actualiza al recuperar el foco', () => {
  const { result } = renderHook(() => useAhora())

  act(() => {
    vi.setSystemTime(new Date(2026, 9, 23, 0, 5))
    window.dispatchEvent(new Event('focus'))
  })

  expect(result.current.getDate()).toBe(23)
})
