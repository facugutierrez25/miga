import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useDayRegistro } from './useDayRegistro'
import { usePlan } from './usePlan'
import { useWeek } from './useWeek'
import { getDayRegistro, type DayRegistroDto } from '../api/registro'
import { getMyPlan, type PlanDto } from '../api/plans'
import { getWeek, type WeekSummaryDto } from '../api/semana'

vi.mock('../api/registro')
vi.mock('../api/plans')
vi.mock('../api/semana')
afterEach(() => vi.resetAllMocks())

const day: DayRegistroDto = { date: '2026-01-01', meals: [], summary: [] }
const plan: PlanDto = { foodGroups: [], meals: [] }
const week: WeekSummaryDto = { weekStart: '2026-01-01', weekEnd: '2026-01-07', habits: [], days: [] }

it('descarta el día A lento cuando ya se pidió B, aunque el servidor ignore abort', async () => {
  let resolveA!: (value: DayRegistroDto) => void
  vi.mocked(getDayRegistro).mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve }))
    .mockResolvedValueOnce({ ...day, date: '2026-01-02' })
  const { result, rerender } = renderHook(({ date }) => useDayRegistro('token', 'a@b.uy', date), { initialProps: { date: '2026-01-01' } })
  const signalA = vi.mocked(getDayRegistro).mock.calls[0][2]!
  rerender({ date: '2026-01-02' })
  expect(signalA.aborted).toBe(true)
  await waitFor(() => expect(result.current.data?.date).toBe('2026-01-02'))
  await act(async () => resolveA(day))
  expect(result.current.data?.date).toBe('2026-01-02')
})

const cases = [
  { name: 'día', mock: vi.mocked(getDayRegistro), data: day, useLoad: (token: string | null, user: string) => useDayRegistro(token, user, day.date) },
  { name: 'plan', mock: vi.mocked(getMyPlan), data: plan, useLoad: (token: string | null, user: string) => usePlan(token, user) },
  { name: 'semana', mock: vi.mocked(getWeek), data: week, useLoad: (token: string | null, user: string) => useWeek(token, user, week.weekStart) },
]
for (const entry of cases) {
  it(`${entry.name}: muestra error y permite reintentar hasta vacío`, async () => {
    entry.mock.mockRejectedValueOnce(new Error('Sin conexión'))
    // Los tres casos conservan sus DTO públicos distintos.
    entry.mock.mockResolvedValueOnce(entry.data as never)
    const { result } = renderHook(() => entry.useLoad('token', 'a@b.uy'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.data).toBeNull()
    act(() => result.current.retry())
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('empty'))
    expect(entry.mock).toHaveBeenCalledTimes(2)
  })
  it(`${entry.name}: limpia datos al cambiar de usuario y al cerrar sesión`, async () => {
    entry.mock.mockResolvedValueOnce(entry.data as never).mockImplementation(() => new Promise<never>(() => {}))
    const { result, rerender } = renderHook(({ token, user }) => entry.useLoad(token, user), {
      initialProps: { token: 'token-a' as string | null, user: 'a@b.uy' },
    })
    await waitFor(() => expect(result.current.data).toEqual(entry.data))
    rerender({ token: 'token-b', user: 'b@b.uy' })
    expect(result.current.data).toBeNull()
    expect(result.current.status).toBe('loading')
    rerender({ token: null, user: '' })
    expect(result.current.data).toBeNull()
    expect(result.current.status).toBe('empty')
  })
}

it('descarta una semana anterior que llega tarde', async () => {
  let resolveA!: (value: WeekSummaryDto) => void
  vi.mocked(getWeek).mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve }))
    .mockResolvedValueOnce({ ...week, weekStart: '2026-01-08' })
  const { result, rerender } = renderHook(({ date }) => useWeek('token', 'a@b.uy', date), { initialProps: { date: week.weekStart } })
  rerender({ date: '2026-01-08' })
  await waitFor(() => expect(result.current.data?.weekStart).toBe('2026-01-08'))
  await act(async () => resolveA(week))
  expect(result.current.data?.weekStart).toBe('2026-01-08')
})

it('descarta el plan del usuario anterior aunque termine después del nuevo', async () => {
  let resolveA!: (value: PlanDto) => void
  const newPlan: PlanDto = { ...plan, version: 2 }
  vi.mocked(getMyPlan).mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve }))
    .mockResolvedValueOnce(newPlan)
  const { result, rerender } = renderHook(({ user }) => usePlan('token', user), { initialProps: { user: 'a@b.uy' } })
  rerender({ user: 'b@b.uy' })
  await waitFor(() => expect(result.current.data).toEqual(newPlan))
  await act(async () => resolveA({ ...plan, version: 1 }))
  expect(result.current.data).toEqual(newPlan)
})

it('distingue éxito, error de recarga y reintento', async () => {
  const recordedDay: DayRegistroDto = { ...day, meals: [{ mealId: 1, noteId: 1, noteVersion: 1, noteText: 'pan', items: [], comparison: [] }] }
  vi.mocked(getDayRegistro).mockResolvedValueOnce(recordedDay).mockRejectedValueOnce(new Error('Sin conexión'))
    .mockResolvedValueOnce(recordedDay)
  const { result } = renderHook(() => useDayRegistro('token', 'a@b.uy', day.date))
  await waitFor(() => expect(result.current.status).toBe('success'))
  await act(async () => { await expect(result.current.reload()).rejects.toThrow('Sin conexión') })
  expect(result.current.status).toBe('error')
  expect(result.current.data).toBeNull()
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.status).toBe('success'))
})

it('cancela también la recarga manual cuando se cambia de día', async () => {
  let resolveReload!: (value: DayRegistroDto) => void
  vi.mocked(getDayRegistro).mockResolvedValueOnce(day)
    .mockImplementationOnce(() => new Promise(resolve => { resolveReload = resolve }))
    .mockResolvedValueOnce({ ...day, date: '2026-01-02' })
  const { result, rerender } = renderHook(({ date }) => useDayRegistro('token', 'a@b.uy', date), { initialProps: { date: day.date } })
  await waitFor(() => expect(result.current.data).toEqual(day))
  const pending = result.current.reload()
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  rerender({ date: '2026-01-02' })
  await waitFor(() => expect(result.current.data?.date).toBe('2026-01-02'))
  await act(async () => { resolveReload(day); await rejected })
  expect(result.current.data?.date).toBe('2026-01-02')
})
