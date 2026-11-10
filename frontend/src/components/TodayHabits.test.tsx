import { useState } from 'react'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, test, expect, afterEach } from 'vitest'
import TodayHabits, { HabitCrumbs } from '../components/TodayHabits'
import * as api from '../api/week'
import { useWeek } from '../hooks/useWeek'

const defaultUseWeek = vi.mocked(useWeek).getMockImplementation()!
afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(useWeek).mockImplementation(defaultUseWeek)
})

vi.mock('../hooks/useNow', () => ({ useNow: () => new Date('2026-10-26T12:00:00') }))

vi.mock('../auth/authTypes', () => ({ useAuth: () => ({ token: 'tok', email: 'user@miga.uy' }) }))
vi.mock('../hooks/useWeek', () => ({ useWeek: vi.fn(() => ({
  status: 'success', setData: vi.fn(), retry: vi.fn(), data: {
    weekStart: '2026-10-26', weekEnd: '2026-11-01', habits: [
      { id: 1, name: 'Flexibles', habitType: 'CONTADOR', step: 1, countsFlexibleMeals: true },
      { id: 2, name: 'Agua', habitType: 'CONTADOR', step: 250, unit: 'ml' }
    ], days: [{ date: '2026-10-26', hasData: true, totalRecorded: 0, totalGoal: 0,
      habitIds: [1, 2], habitLogs: [{ habitId: 1, date: '2026-10-26', value: 2 }, { habitId: 2, date: '2026-10-26', value: 500 }],
      meals: [{ mealId: 10, name: 'Desayuno', status: 'REGISTRADA', noteText: '=pan y café' }] }]
  }
})) }))

function renderProgress(habit: Partial<api.HabitDto>, values: number[]) {
  const data: api.WeekSummaryDto = {
    weekStart: '2026-10-26', weekEnd: '2026-11-01',
    habits: [{ id: 3, name: 'Agua', habitType: 'CANTIDAD', dailyGoal: 2,
      unit: 'lt', step: 0.5, period: 'DIA', displayOrder: 1, ...habit }],
    days: values.map((value, i) => ({ date: `2026-10-${26 + i}`, hasData: true,
      totalRecorded: 0, totalGoal: 0, habitIds: [3], meals: [],
      habitLogs: [{ habitId: 3, date: `2026-10-${26 + i}`, value }] })),
  }
  vi.mocked(useWeek).mockReturnValue({ data, status: 'success', error: null,
    setData: vi.fn(), retry: vi.fn(), reload: vi.fn().mockResolvedValue(data) })
  render(<TodayHabits date="2026-10-26" />)
}

test.each([['CANTIDAD', 1.5, false], ['CANTIDAD', 2, true], ['CONTADOR', 3, true]])(
  'meta diaria de %s con valor %s: cumplido %s', (habitType, value, done) => {
    renderProgress({ habitType }, [value])
    const row = screen.getByRole('group', { name: new RegExp(`Agua: ${String(value).replace('.', ',')} de 2 lt, lunes`) })
    expect(row.classList.contains('hoy-habito--ok')).toBe(done)
    expect(row.querySelectorAll('.meal-crumb--full')).toHaveLength(Math.min(Math.round(value / 0.5), 4))
  }
)

test.each([[0, false], [0.5, true]])('sin meta conserva la marca con valor %s', (value, done) => {
  renderProgress({ dailyGoal: null }, [value])
  const row = screen.getByRole('group', { name: /Agua:/ })
  expect(row).toHaveAccessibleName(new RegExp(`${String(value).replace('.', ',')} lt`))
  expect(row.classList.contains('hoy-habito--ok')).toBe(done)
})

test('flexibles no aparece en Hoy', () => {
  renderProgress({ habitType: 'CONTADOR', countsFlexibleMeals: true }, [1.5])
  expect(screen.queryByText('Agua')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Sumar/ })).not.toBeInTheDocument()
})

test('sí/no conserva su comportamiento aunque tenga una meta configurada', () => {
  renderProgress({ habitType: 'SI_NO', dailyGoal: 5, period: 'SEMANA', unit: null }, [1])
  expect(screen.getByRole('button', { name: /Agua: Sin hacer/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('region', { name: 'Metas semanales' })).not.toBeInTheDocument()
})

test('anuncia un error al registrar un hábito y permite reintentar', async () => {
  const logHabit = vi.spyOn(api, 'logHabit')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ habitId: 2, date: '2026-10-26', value: 750 })
  render(<TodayHabits date="2026-10-26" />)
  const button = screen.getByRole('button', { name: /Sumar 250 ml a Agua, lunes, 26 de octubre de 2026/ })
  fireEvent.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo registrar el hábito')
  expect(button).toBeEnabled()
  fireEvent.click(button)
  expect(logHabit).toHaveBeenLastCalledWith('tok', 2, '2026-10-26', 750)
  await waitFor(() => expect(button).toBeEnabled())
})

test('un contador se puede bajar si se sumó de más', async () => {
  const logHabit = vi.spyOn(api, 'logHabit').mockResolvedValue({ habitId: 2, date: '2026-10-26', value: 250 })
  render(<TodayHabits date="2026-10-26" />)
  expect(screen.getByText('500 ml')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Restar 250 ml de Agua, lunes, 26 de octubre de 2026/ }))
  await waitFor(() => expect(logHabit).toHaveBeenLastCalledWith('tok', 2, '2026-10-26', 250))
})


test('Hoy permite anotar el hábito semanal sin mostrar el resumen de Metas semanales', () => {
  renderProgress({ period: 'SEMANA', dailyGoal: 5, unit: null }, [2, 3])
  expect(screen.getByRole('group', { name: /Agua: 2, lunes/ })).not.toHaveClass('hoy-habito--ok')
  expect(screen.queryByRole('region', { name: 'Metas semanales' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Sumar 0,5 a Agua/ })).toBeEnabled()
})


test.each([true, false])('actualiza el hábito antes de guardar y reconcilia o revierte (éxito: %s)', async (success) => {
  const initial = defaultUseWeek(null, null, '2026-10-26')!
  vi.mocked(useWeek).mockImplementation(function useTestWeek() {
    const [data, setData] = useState<api.WeekSummaryDto | null>(initial.data)
    return { ...initial, data, setData }
  })
  let resolve!: (log: api.HabitLogDto) => void
  let reject!: (error: Error) => void
  const request = vi.spyOn(api, 'logHabit').mockReturnValue(new Promise((res, rej) => { resolve = res; reject = rej }))
  render(<TodayHabits date="2026-10-26" />)
  const button = screen.getByRole('button', { name: /Sumar 250 ml a Agua/ })
  fireEvent.click(button)
  expect(screen.getByText('750 ml')).toBeInTheDocument()
  expect(button).toBeDisabled()
  fireEvent.click(button)
  expect(request).toHaveBeenCalledTimes(1)
  await act(async () => {
    if (success) resolve({ habitId: 2, date: '2026-10-26', value: 800 })
    else reject(new Error('offline'))
  })
  expect(screen.getByText(success ? '800 ml' : '500 ml')).toBeInTheDocument()
  if (!success) expect(screen.getByRole('alert')).toHaveTextContent('No se pudo registrar')
  expect(button).toBeEnabled()
})


function renderCrumbs(overrides: Partial<api.HabitDto> = {}, initialValue = 0) {
  const change = vi.fn()
  const habit: api.HabitDto = { id: 3, name: 'Agua', habitType: 'CANTIDAD', dailyGoal: 2,
    unit: 'Lt', step: 0.5, period: 'DIA', displayOrder: 1, ...overrides }
  function Preview() {
    const [value, setValue] = useState(initialValue)
    return <HabitCrumbs habit={habit} value={value} onChange={next => { setValue(next); change(next) }} />
  }
  render(<Preview />)
  return change
}

test('agua muestra cuatro migas y +; la tercera deja 1,5 y luego 1', () => {
  const change = renderCrumbs()
  const buttons = screen.getAllByRole('button')
  expect(buttons).toHaveLength(5)
  expect(buttons[2]).toHaveAccessibleName('Agua: 1,5 Lt')
  fireEvent.click(buttons[2])
  expect(change).toHaveBeenLastCalledWith(1.5)
  expect(buttons[2]).toHaveAccessibleName('Agua: 1 Lt')
  fireEvent.click(buttons[2])
  expect(change).toHaveBeenLastCalledWith(1)
})

test('el exceso suma pasos y la cuarta miga vuelve a la meta', () => {
  const change = renderCrumbs({}, 2)
  const buttons = screen.getAllByRole('button')
  fireEvent.click(buttons[4])
  expect(change).toHaveBeenLastCalledWith(2.5)
  expect(screen.getByText('+1')).toBeInTheDocument()
  fireEvent.click(buttons[3])
  expect(change).toHaveBeenLastCalledWith(2)
  expect(screen.queryByText('+1')).not.toBeInTheDocument()
})

test('sí o no usa una sola miga y dice Hecho', () => {
  const change = renderCrumbs({ habitType: 'SI_NO' })
  expect(screen.getAllByRole('button')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getByText('Hecho')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button'))
  expect(change).toHaveBeenLastCalledWith(0)
})

test.each([3, 3.5, null])('meta %s usa migas hasta seis pasos y luego controles numéricos', goal => {
  renderCrumbs({ dailyGoal: goal })
  expect(screen.getAllByRole('button')).toHaveLength(goal === 3 ? 7 : 2)
  if (goal !== 3) expect(screen.getByRole('button', { name: /Restar/ })).toBeDisabled()
})

test('el + desde cero supera la meta en un paso', () => {
  const change = renderCrumbs()
  fireEvent.click(screen.getByRole('button', { name: /Sumar/ }))
  expect(change).toHaveBeenLastCalledWith(2.5)
})

test('el contador redondea decimales y no baja de cero', () => {
  const change = renderCrumbs({ dailyGoal: null, step: 0.1 }, 0.2)
  fireEvent.click(screen.getByRole('button', { name: /Sumar/ }))
  expect(change).toHaveBeenLastCalledWith(0.3)
  for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: /Restar/ }))
  expect(change).toHaveBeenLastCalledWith(0)
})


test('la vista previa sin onChange deshabilita los controles', () => {
  render(<HabitCrumbs habit={{ id: 3, name: 'Agua', habitType: 'CANTIDAD', dailyGoal: 2,
    unit: 'Lt', step: 0.5, period: 'DIA', displayOrder: 1 }} />)
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
})
