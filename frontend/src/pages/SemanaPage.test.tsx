import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, test, expect, afterEach } from 'vitest'
import SemanaPage from './SemanaPage'
import * as api from '../api/semana'
import { useWeek } from '../hooks/useWeek'

const defaultUseWeek = vi.mocked(useWeek).getMockImplementation()!
afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(useWeek).mockImplementation(defaultUseWeek)
})

vi.mock('../hooks/useAhora', () => ({ useAhora: () => new Date('2026-10-26T12:00:00') }))

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
  render(<SemanaPage />)
}

test.each([['CANTIDAD', 1.5, false], ['CANTIDAD', 2, true], ['CONTADOR', 3, true]])(
  'meta diaria de %s con valor %s: cumplido %s', (habitType, value, done) => {
    renderProgress({ habitType }, [value])
    const row = screen.getByRole('group', { name: new RegExp(`Agua: ${String(value).replace('.', ',')} de 2 lt, lunes`) })
    expect(row.classList.contains('semana-habito--ok')).toBe(done)
    expect(row.querySelectorAll('svg')).toHaveLength(done ? 1 : 0)
  }
)

test.each([[1, 2, false], [2, 3, true]])('meta semanal suma %s y %s', (first, second, done) => {
  renderProgress({ period: 'SEMANA', dailyGoal: 5, unit: null }, [first, second])
  const summary = screen.getByRole('listitem', { name: `Agua: ${first + second} de 5 esta semana, ${done ? 'completado' : 'pendiente'}` })
  expect(summary.querySelectorAll('svg')).toHaveLength(done ? 1 : 0)
  expect(screen.getByRole('group', { name: new RegExp(`Agua: ${first}, lunes`) })).not.toHaveClass('semana-habito--ok')
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de la semana' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Planilla' }))
  expect(screen.getByRole('region', { name: 'Metas semanales' })).toBeInTheDocument()
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
  render(<SemanaPage />)
  expect(screen.getAllByRole('listitem', { name: /esta semana/ })).toHaveLength(1)
  expect(screen.getByRole('listitem', { name: 'Agua: 5 de 5 esta semana, completado' })).toBeInTheDocument()
})

test.each([[0, false], [0.5, true]])('sin meta conserva la marca con valor %s', (value, done) => {
  renderProgress({ dailyGoal: null }, [value])
  const row = screen.getByRole('group', { name: /Agua:/ })
  expect(row).toHaveAccessibleName(new RegExp(`${String(value).replace('.', ',')} lt`))
  expect(row.classList.contains('semana-habito--ok')).toBe(done)
})

test('flexibles muestra el progreso sin permitir edición', () => {
  renderProgress({ habitType: 'CONTADOR', countsFlexibleMeals: true }, [1.5])
  expect(screen.getByRole('button', { name: /Agua: 1,5 de 2 lt, lunes/ })).toBeDisabled()
  expect(screen.queryByRole('button', { name: /Sumar/ })).not.toBeInTheDocument()
})

test('sí/no conserva su comportamiento aunque tenga una meta configurada', () => {
  renderProgress({ habitType: 'SI_NO', dailyGoal: 5, period: 'SEMANA', unit: null }, [1])
  expect(screen.getByRole('button', { name: /Agua: completado, 1, lunes/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('region', { name: 'Metas semanales' })).not.toBeInTheDocument()
})

test('planilla muestra la meta diaria con su unidad y fecha accesible', () => {
  renderProgress({}, [1.5])
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de la semana' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Planilla' }))
  expect(screen.getByRole('cell', { name: /Agua: 1,5 de 2 lt, lunes/ })).toHaveTextContent('1,5 de 2 lt')
})

test('Por día muestra cada comida, estado y nota; el contador flexible no se edita', () => {
  render(<SemanaPage />)
  expect(screen.getByText('Desayuno')).toBeInTheDocument()
  expect(screen.getByText(/Registrada/)).toBeInTheDocument()
  expect(screen.getByText('=pan y café')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Flexibles: completado, 2, lunes, 26 de octubre de 2026/ })).toBeDisabled()
})

test('Planilla muestra la grilla con el texto escrito y los hábitos', () => {
  render(<SemanaPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de la semana' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Planilla' }))
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Desayuno' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '=pan y café' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument()
})

test('identifica el día actual y su fecha completa en ambas vistas', () => {
  render(<SemanaPage />)
  expect(screen.getByRole('heading', { level: 1, name: 'Semana' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'lunes, 26 de octubre de 2026' }).closest('article'))
    .toHaveAttribute('aria-current', 'date')
  expect(screen.getByText('Hoy')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de la semana' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Planilla' }))
  expect(screen.getByRole('rowheader', { name: /lunes, 26 de octubre de 2026/ }))
    .toHaveAttribute('aria-current', 'date')
})

test('anuncia un error al registrar un hábito y permite reintentar', async () => {
  const logHabit = vi.spyOn(api, 'logHabit')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ habitId: 2, date: '2026-10-26', value: 750 })
  render(<SemanaPage />)
  const button = screen.getByRole('button', { name: /Sumar 250 ml a Agua, lunes, 26 de octubre de 2026/ })
  fireEvent.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo registrar el hábito')
  expect(button).toBeEnabled()
  fireEvent.click(button)
  expect(logHabit).toHaveBeenLastCalledWith('tok', 2, '2026-10-26', 750)
  await waitFor(() => expect(button).toBeEnabled())
})

test('la tira de la semana anuncia cada día con su resumen y marca el elegido', () => {
  render(<SemanaPage />)
  const dia = screen.getByRole('button', { name: /lunes, 26 de octubre de 2026, hoy: 0 de 1 comidas como el plan, 1 anotadas/ })
  expect(dia).toHaveAttribute('aria-pressed', 'true')
  expect(dia).toHaveAttribute('aria-current', 'date')
  expect(screen.getByText('Esta semana: 0 de 1 comidas como el plan')).toBeInTheDocument()
})

test('un contador se puede bajar si se sumó de más', async () => {
  const logHabit = vi.spyOn(api, 'logHabit').mockResolvedValue({ habitId: 2, date: '2026-10-26', value: 250 })
  render(<SemanaPage />)
  expect(screen.getByText('500 ml')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Restar 250 ml de Agua, lunes, 26 de octubre de 2026/ }))
  await waitFor(() => expect(logHabit).toHaveBeenLastCalledWith('tok', 2, '2026-10-26', 250))
})


test('el menú ofrece descargas y Planilla, Escape cierra y devuelve el foco', () => {
  render(<SemanaPage />)
  const trigger = screen.getByRole('button', { name: 'Más opciones de la semana' })
  expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('menuitem', { name: 'Descargar CSV' })).toBeInTheDocument()
  const excel = screen.getByRole('menuitem', { name: 'Descargar Excel (XLSX)' })
  expect(screen.getByRole('menuitem', { name: 'Planilla' })).toBeInTheDocument()
  excel.focus()
  fireEvent.keyDown(excel, { key: 'Escape' })
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
})

test.each(['CASI', 'DE_MAS', 'PREGUNTAR'])('media miga de %s usa la marca sin acento', status => {
  const data = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26').data!
  const week = { ...data, days: data.days.map(day => ({ ...day,
    meals: day.meals?.map(meal => ({ ...meal, status })) })) }
  vi.mocked(useWeek).mockReturnValue({ ...defaultUseWeek('tok', 'user@miga.uy', '2026-10-26'), data: week })
  const { container } = render(<SemanaPage />)
  const half = container.querySelector('.semana-miga--half')!
  expect(half).toBeInTheDocument()
  expect(half.className).not.toMatch(/accent|amarill/)
  expect(half.getAttribute('style') ?? '').not.toMatch(/accent|#f6c344/i)

})
