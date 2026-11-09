import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, test, expect, afterEach } from 'vitest'
import WeekPage from './WeekPage'
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

test('Por día muestra cada comida, estado y nota; el contador flexible no se edita', () => {
  const { container } = render(<WeekPage />)
  expect(container.querySelector('.semana-comida__nombre')).toHaveTextContent('Desayuno')
  expect(container.querySelector('.semana-comida__estado')).toHaveTextContent('Anotada')
  expect(screen.getByText('=pan y café')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Flexibles:/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Agua')).not.toBeInTheDocument()
})

test('Tarjeta y Planilla se eligen con un control segmentado', () => {
  render(<WeekPage />)
  expect(screen.getByRole('button', { name: 'Tarjeta' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Planilla' }))
  expect(screen.getByRole('button', { name: 'Planilla' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('table')).toBeInTheDocument()
})

test('Planilla muestra la grilla con el texto escrito y los hábitos', () => {
  render(<WeekPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Planilla' }))
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Desayuno' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '=pan y café' })).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Agua' })).not.toBeInTheDocument()
})

test('identifica el día actual y su fecha completa en ambas vistas', () => {
  render(<WeekPage />)
  expect(screen.getByRole('heading', { level: 1, name: 'Semana' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'lunes, 26 de octubre de 2026' }).closest('article'))
    .toHaveAttribute('aria-current', 'date')
  expect(screen.getByText('Hoy')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Planilla' }))
  expect(screen.getByRole('rowheader', { name: /lunes, 26 de octubre de 2026/ }))
    .toHaveAttribute('aria-current', 'date')
})

test('la tira de la semana anuncia cada día con su resumen y marca el elegido', () => {
  render(<WeekPage />)
  const day = screen.getByRole('button', { name: /lunes, 26 de octubre de 2026, hoy: 0 de 1 comidas como el plan, 1 anotadas/ })
  expect(day).toHaveAttribute('aria-pressed', 'true')
  expect(day).toHaveAttribute('aria-current', 'date')
  expect(screen.getByText('comidas como el plan esta semana').parentElement).toHaveTextContent('0 de 1comidas como el plan esta semana')
})

test('Exportar abre una hoja con Excel y PDF, sin CSV ni link, y cierra con Escape devolviendo el foco', async () => {
  const exportWeek = vi.spyOn(api, 'exportWeek').mockResolvedValue()
  render(<WeekPage />)
  const trigger = screen.getByRole('button', { name: 'Exportar' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Exportar para tu nutri' })
  expect(dialog).toHaveTextContent('Miga no lo comparte con nadie')
  expect(screen.queryByText(/CSV/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() => expect(trigger).toHaveFocus())
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: 'Descargar planilla de Excel' }))
  await waitFor(() => expect(exportWeek).toHaveBeenCalledWith('tok', '2026-10-26', 'xlsx'))
})

test('la tarjeta pone un guion cuando el plan de ese día no tiene esa comida', () => {
  const data = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26').data!
  const otherDay = { ...data.days[0], date: '2026-10-27', meals: [{ mealId: 11, name: 'Pre entreno', status: 'SIN_ANOTAR', noteText: null }] }
  vi.mocked(useWeek).mockReturnValue({ ...defaultUseWeek('tok', 'user@miga.uy', '2026-10-26'), data: { ...data, days: [data.days[0], otherDay] } })
  const { container } = render(<WeekPage />)
  expect(container.querySelectorAll('.semana-tarjeta .semana-miga--no-aplica')).toHaveLength(2)
  expect(screen.getByText('No toca ese día')).toBeInTheDocument()
})

test.each(['CASI', 'DE_MAS', 'PREGUNTAR'])('media miga de %s usa la marca sin acento', status => {
  const data = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26').data!
  const week = { ...data, days: data.days.map(day => ({ ...day,
    meals: day.meals?.map(meal => ({ ...meal, status })) })) }
  vi.mocked(useWeek).mockReturnValue({ ...defaultUseWeek('tok', 'user@miga.uy', '2026-10-26'), data: week })
  const { container } = render(<WeekPage />)
  const half = container.querySelector('.semana-miga--half')!
  expect(half).toBeInTheDocument()
  expect(half.className).not.toMatch(/accent|amarill/)
  expect(half.getAttribute('style') ?? '').not.toMatch(/accent|#f6c344/i)

})


test('la tarjeta de develop destaca la comida flexible con el acento, aunque coincida con el plan', () => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  const data = { ...base.data!, days: base.data!.days.map(day => ({ ...day,
    meals: day.meals?.map(meal => ({ ...meal, status: 'EN_PLAN', flexibleCount: 1 })) })) }
  vi.mocked(useWeek).mockReturnValue({ ...base, data })
  const { container } = render(<WeekPage />)
  expect(container.querySelector('.semana-tarjeta__celda .semana-miga--flexible')).toBeInTheDocument()
  expect(container.querySelector('.semana-comida__estado--flexible')).toHaveTextContent('Flexible')
})


test.each([false, true])('sin hábito flexible vigente ese día no destaca la comida (otro día: %s)', otherDay => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  const day = { ...base.data!.days[0], habitIds: [2],
    meals: [{ mealId: 10, name: 'Desayuno', status: 'EN_PLAN', noteText: 'pan', flexibleCount: 1 }] }
  const data = { ...base.data!, days: otherDay ? [day, { ...day, date: '2026-10-27', habitIds: [1, 2] }] : [day] }
  vi.mocked(useWeek).mockReturnValue({ ...base, data })
  const { container } = render(<WeekPage />)
  expect(container.querySelector('.semana-tarjeta__celda .semana-miga--flexible')).not.toBeInTheDocument()
  expect(container.querySelector('.semana-comida__estado--flexible')).not.toBeInTheDocument()
  expect(container.querySelector('.semana-comida__estado--full')).toHaveTextContent('Como el plan')
  expect(container.querySelector('.semana-leyenda .semana-miga--noted')).not.toBeInTheDocument()
  expect(Boolean(container.querySelector('.semana-leyenda .semana-miga--flexible'))).toBe(otherDay)
})

test('sin hábito configurado no muestra la referencia flexible', () => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  vi.mocked(useWeek).mockReturnValue({ ...base, data: { ...base.data!, habits: [] } })
  const { container } = render(<WeekPage />)
  expect(container.querySelector('.semana-leyenda .semana-miga--flexible')).not.toBeInTheDocument()
  expect(container.querySelector('.semana-leyenda .semana-miga--noted')).not.toBeInTheDocument()
})


test('PDF descarga el documento generado sin imprimir ni cambiar la vista', async () => {
  const exportWeek = vi.spyOn(api, 'exportWeek').mockResolvedValue()
  const print = vi.spyOn(window, 'print').mockImplementation(() => {})
  render(<WeekPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }))
  await waitFor(() => expect(exportWeek).toHaveBeenCalledWith('tok', '2026-10-26', 'pdf'))
  expect(print).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Tarjeta' })).toHaveAttribute('aria-pressed', 'true')
})

test('PDF muestra un error y permite volver a intentar la descarga', async () => {
  const exportWeek = vi.spyOn(api, 'exportWeek').mockRejectedValueOnce(new Error('offline')).mockResolvedValue()
  render(<WeekPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo exportar')
  fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }))
  await waitFor(() => expect(exportWeek).toHaveBeenCalledTimes(2))
})

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
  render(<WeekPage />)
}


test.each([[1, 2, false], [2, 3, true]])('meta semanal suma %s y %s', (first, second, done) => {
  renderProgress({ period: 'SEMANA', dailyGoal: 5, unit: null }, [first, second])
  const summary = screen.getByRole('listitem', { name: `Agua: ${first + second} de 5 esta semana, ${done ? 'completado' : 'pendiente'}` })
  expect(summary.querySelectorAll('svg')).toHaveLength(done ? 1 : 0)

})

test('meta semanal con decimales se cumple al llegar justo a la meta', () => {
  renderProgress({ period: 'SEMANA', dailyGoal: 0.8, unit: null }, [0.1, 0.7])
  expect(screen.getByRole('listitem', { name: 'Agua: 0,8 de 0,8 esta semana, completado' })).toBeInTheDocument()
})

test('meta semanal suma las versiones del mismo hábito y usa la meta más reciente', () => {
  const data: api.WeekSummaryDto = {
    weekStart: '2026-10-26', weekEnd: '2026-11-01',
    habits: [
      { id: 3, uid: 'agua', name: 'Agua', habitType: 'CONTADOR', dailyGoal: 4, unit: null, step: 1, period: 'SEMANA', displayOrder: 1 },
      { id: 7, uid: 'agua', name: 'Agua', habitType: 'CONTADOR', dailyGoal: 5, unit: null, step: 1, period: 'SEMANA', displayOrder: 1 },
    ],
    days: [
      { date: '2026-10-26', hasData: true, totalRecorded: 0, totalGoal: 0, habitIds: [3], meals: [],
        habitLogs: [{ habitId: 3, date: '2026-10-26', value: 2 }] },
      { date: '2026-10-27', hasData: true, totalRecorded: 0, totalGoal: 0, habitIds: [7], meals: [],
        habitLogs: [{ habitId: 7, date: '2026-10-27', value: 3 }] },
    ],
  }
  vi.mocked(useWeek).mockReturnValue({ data, status: 'success', error: null,
    setData: vi.fn(), retry: vi.fn(), reload: vi.fn().mockResolvedValue(data) })
  render(<WeekPage />)
  expect(screen.getAllByRole('listitem', { name: /esta semana/ })).toHaveLength(1)
  expect(screen.getByRole('listitem', { name: 'Agua: 5 de 5 esta semana, completado' })).toBeInTheDocument()
})



test('Metas semanales permanece visible tanto en Tarjeta como en Planilla', () => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  const data = { ...base.data!, habits: base.data!.habits.map(h => ({ ...h, period: 'SEMANA', dailyGoal: 5 })) }
  vi.mocked(useWeek).mockReturnValue({ ...base, data })
  render(<WeekPage />)
  expect(screen.getByRole('region', { name: 'Metas semanales' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Planilla' }))
  expect(screen.getByRole('region', { name: 'Metas semanales' })).toBeVisible()
})
