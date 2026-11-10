import { render as renderBase, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, afterEach } from 'vitest'
import WeekPage from './WeekPage'
import * as api from '../api/week'
import { useWeek } from '../hooks/useWeek'
const render = (ui: ReactElement) => renderBase(<MemoryRouter>{ui}</MemoryRouter>)

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
  expect(screen.getAllByText('Agua')).toHaveLength(2)
})

test('Tarjeta y Planilla se eligen con un control segmentado', () => {
  render(<WeekPage />)
  expect(screen.getByRole('radio', { name: 'Tarjeta' })).toBeChecked()
  fireEvent.click(screen.getByRole('radio', { name: 'Planilla' }))
  expect(screen.getByRole('radio', { name: 'Planilla' })).toBeChecked()
  expect(screen.getByRole('table')).toBeInTheDocument()
})

test('Planilla muestra la grilla con el texto escrito y los hábitos', () => {
  render(<WeekPage />)
  fireEvent.click(screen.getByRole('radio', { name: 'Planilla' }))
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
  fireEvent.click(screen.getByRole('radio', { name: 'Planilla' }))
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
  const otherDay = { ...data.days[0], date: '2026-10-27', meals: [{ mealId: 11, name: 'Pre entreno', planned: true, status: 'SIN_ANOTAR' as const, noteText: null }] }
  vi.mocked(useWeek).mockReturnValue({ ...defaultUseWeek('tok', 'user@miga.uy', '2026-10-26'), data: { ...data, days: [data.days[0], otherDay] } })
  const { container } = render(<WeekPage />)
  expect(container.querySelectorAll('.semana-tarjeta .semana-miga--no-aplica')).toHaveLength(2)
  expect(screen.getByText('No toca ese día')).toBeInTheDocument()
})

test.each(['CASI', 'DE_MAS', 'PREGUNTAR'] as const)('media miga de %s usa la marca sin acento', status => {
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


test('la tarjeta destaca el estado flexible de la API', () => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  const data = { ...base.data!, days: base.data!.days.map(day => ({ ...day,
    meals: day.meals?.map(meal => ({ ...meal, planned: true, status: 'FLEXIBLE' as const, flexibleCount: 0 })) })) }
  vi.mocked(useWeek).mockReturnValue({ ...base, data })
  const { container } = render(<WeekPage />)
  expect(container.querySelector('.semana-tarjeta__celda .semana-miga--flexible')).toBeInTheDocument()
  expect(container.querySelector('.semana-comida__estado--flexible')).toHaveTextContent('Flexible')
})


test.each([false, true])('respeta EN_PLAN aunque haya conteos flexibles antiguos (otro día: %s)', otherDay => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  const day = { ...base.data!.days[0], habitIds: [2],
    meals: [{ mealId: 10, name: 'Desayuno', planned: true, status: 'EN_PLAN' as const, noteText: 'pan', flexibleCount: 1 }] }
  const data = { ...base.data!, days: otherDay ? [day, { ...day, date: '2026-10-27', habitIds: [1, 2] }] : [day] }
  vi.mocked(useWeek).mockReturnValue({ ...base, data })
  const { container } = render(<WeekPage />)
  expect(container.querySelector('.semana-tarjeta__celda .semana-miga--flexible')).not.toBeInTheDocument()
  expect(container.querySelector('.semana-comida__estado--flexible')).not.toBeInTheDocument()
  expect(container.querySelector('.semana-comida__estado--full')).toHaveTextContent('Como el plan')
  expect(container.querySelector('.semana-leyenda .semana-miga--noted')).toBeInTheDocument()
  expect(container.querySelector('.semana-leyenda .semana-miga--flexible')).toBeInTheDocument()
})

test('la leyenda conserva todos los estados aunque no haya hábitos', () => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  vi.mocked(useWeek).mockReturnValue({ ...base, data: { ...base.data!, habits: [] } })
  const { container } = render(<WeekPage />)
  expect(container.querySelector('.semana-leyenda .semana-miga--flexible')).toBeInTheDocument()
  expect(container.querySelector('.semana-leyenda .semana-miga--noted')).toBeInTheDocument()
  expect(container.querySelector('.semana-leyenda')).toHaveTextContent('Como el plan o meta cumplida')
  expect(container.querySelector('.semana-leyenda')).toHaveTextContent('Faltó o sobró algo')
  expect(container.querySelector('.semana-leyenda')).toHaveTextContent('Flexible')
  expect(container.querySelector('.semana-leyenda')).toHaveTextContent('Anotada')
  expect(container.querySelector('.semana-leyenda')).toHaveTextContent('Sin anotar')
  expect(container.querySelector('.semana-leyenda')).toHaveTextContent('Todavía no')
})


test('PDF descarga el documento generado sin imprimir ni cambiar la vista', async () => {
  const exportWeek = vi.spyOn(api, 'exportWeek').mockResolvedValue()
  const print = vi.spyOn(window, 'print').mockImplementation(() => {})
  render(<WeekPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }))
  await waitFor(() => expect(exportWeek).toHaveBeenCalledWith('tok', '2026-10-26', 'pdf'))
  expect(print).not.toHaveBeenCalled()
  expect(screen.getByRole('radio', { name: 'Tarjeta' })).toBeChecked()
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

test.each([
  [{ dailyGoal: 2 }, 0, 'empty'],
  [{ dailyGoal: 2 }, 1, 'half'],
  [{ dailyGoal: 2 }, 2, 'full'],
  [{ dailyGoal: 2 }, 3, 'full'],
  [{ dailyGoal: null }, 1, 'full'],
  [{ habitType: 'SI_NO', dailyGoal: null }, 1, 'full'],
  [{ period: 'SEMANA', dailyGoal: 5 }, 1, 'half'],
] as const)('la tarjeta aplica D12 al hábito %j con valor %s', (habit, value, aspect) => {
  renderProgress(habit, [value, value])
  const row = document.querySelector('.semana-tarjeta__habito')!
  expect(row.previousElementSibling).toHaveClass('semana-tarjeta__sep')
  expect(row.querySelector('button .meal-crumb')).toHaveClass(`meal-crumb--${aspect}`)
  expect(row.querySelectorAll('button')[1].querySelector('.meal-crumb')).toHaveClass('meal-crumb--future')
})

test('solo el encabezado entra en el recorrido de teclado y cualquier celda elige el día', async () => {
  renderProgress({}, [1, 2])
  const card = screen.getByRole('region', { name: 'Tarjeta de la semana' })
  const headers = within(card).getAllByRole('button')
  expect(headers).toHaveLength(2)
  headers[0].focus()
  await userEvent.tab()
  expect(headers[1]).toHaveFocus()
  const cells = card.querySelectorAll('.semana-tarjeta__celda')
  expect(cells).toHaveLength(2)
  cells.forEach(cell => expect(cell).toHaveAttribute('tabindex', '-1'))
  fireEvent.click(cells[1])
  expect(headers[1]).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Este día todavía no llegó')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Hoy|Abrir este día/ })).not.toBeInTheDocument()
})

test('el resumen cuenta cuatro comidas con porciones hasta hoy, sin Extra ni días futuros', () => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  const meals = (['CASI', 'DE_MAS', 'PREGUNTAR', 'SIN_ANOTAR'] as const).map((status, i) => ({
    mealId: i, name: ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'][i], planned: true,
    status,
    noteText: i === 0 ? 'Pan y café' : null,
  }))
  const day = { ...base.data!.days[0], meals: [...meals,
    { mealId: 5, name: 'Extra', planned: false, status: 'SIN_ANOTAR' as const, noteText: null }] }
  vi.mocked(useWeek).mockReturnValue({ ...base, data: { ...base.data!, days: [
    { ...day, date: '2026-10-25' }, day, { ...day, date: '2026-10-27' },
  ] } })
  const { container } = render(<WeekPage />)
  expect(container.querySelector('.semana-resumen__num')).toHaveTextContent('0 de 8')
  expect(screen.getByRole('button', { name: /lunes.*0 de 4 comidas/ })).toBeInTheDocument()
  const card = screen.getByRole('region', { name: 'Tarjeta de la semana' })
  expect(card.querySelectorAll('.meal-crumb--dash')).toHaveLength(3)
  expect(card.querySelectorAll('.semana-tarjeta__habito')).toHaveLength(1)
  const detail = container.querySelector('article')!
  expect(within(detail).getByText('Pan y café')).toBeInTheDocument()
  expect(within(detail).getByText('Faltó algo')).toBeInTheDocument()
  expect(within(detail).getByText('De más')).toBeInTheDocument()
  expect(within(detail).getByText('Por confirmar')).toBeInTheDocument()
  expect(within(detail).getAllByText('Sin anotar', { selector: '.status-chip' })).toHaveLength(2)
  expect(within(detail).getByRole('group', { name: /Agua: 500 ml/ })).toBeInTheDocument()
  expect(within(detail).queryByText('Flexibles')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ir a Hoy' })).toHaveAttribute('href', '/hoy?fecha=2026-10-26')
  fireEvent.click(card.querySelector('.semana-tarjeta__celda')!)
  expect(screen.getByRole('link', { name: 'Abrir este día para anotar o corregir' }))
    .toHaveAttribute('href', '/hoy?fecha=2026-10-25')
})

test('las metas incluyen semanales sin meta y flexibles con migas amarillas y conteo', () => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  vi.mocked(useWeek).mockReturnValue({ ...base, data: { ...base.data!, habits: base.data!.habits.map(h => ({
    ...h, period: 'SEMANA', dailyGoal: h.countsFlexibleMeals ? 3 : null,
  })) } })
  render(<WeekPage />)
  const region = screen.getByRole('region', { name: 'Metas de la semana' })
  expect(within(region).getByRole('listitem', { name: 'Agua: 500 ml esta semana, completado' })).toBeInTheDocument()
  const flexible = within(region).getByRole('listitem', { name: 'Flexibles: 2 de 3 esta semana, pendiente' })
  expect(flexible.querySelectorAll('.meal-crumb--flexible')).toHaveLength(2)
  expect(flexible.querySelectorAll('.meal-crumb--empty')).toHaveLength(1)
})

test('lunes con tres comidas a medias y Cena sin anotar resume 0 de 4 sin Extra', () => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  const meals = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Extra'].map((name, index) => ({
    mealId: index, name, planned: name !== 'Extra', noteText: null,
    status: index < 3 ? 'CASI' as const : 'SIN_ANOTAR' as const,
  }))
  vi.mocked(useWeek).mockReturnValue({ ...base, data: { ...base.data!, days: [{ ...base.data!.days[0], meals }] } })
  const { container } = render(<WeekPage />)
  expect(container.querySelector('.semana-resumen__num')).toHaveTextContent('0 de 4')
  expect(container.querySelectorAll('.semana-tarjeta__celda .meal-crumb--half')).toHaveLength(3)
  expect(container.querySelectorAll('.semana-tarjeta__celda .meal-crumb--empty')).toHaveLength(1)
  expect(container.querySelectorAll('.semana-tarjeta__celda .meal-crumb--dash')).toHaveLength(1)
})


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



test('Metas de la semana permanece visible tanto en Tarjeta como en Planilla', () => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  const data = { ...base.data!, habits: base.data!.habits.map(h => ({ ...h, period: 'SEMANA', dailyGoal: 5 })) }
  vi.mocked(useWeek).mockReturnValue({ ...base, data })
  render(<WeekPage />)
  expect(screen.getByRole('region', { name: 'Metas de la semana' })).toBeVisible()
  fireEvent.click(screen.getByRole('radio', { name: 'Planilla' }))
  expect(screen.getByRole('region', { name: 'Metas de la semana' })).toBeVisible()
})


test.each([false, true])('FLEXIBLE siempre es amarilla sin depender del hábito (%s)', withHabit => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  const data = { ...base.data!, habits: withHabit ? base.data!.habits : [],
    days: base.data!.days.map(day => ({ ...day, habitIds: [],
      meals: day.meals?.map(meal => ({ ...meal, status: 'FLEXIBLE' as const, flexibleCount: 0 })) })) }
  vi.mocked(useWeek).mockReturnValue({ ...base, data })
  const { container } = render(<WeekPage />)
  expect(container.querySelector('.semana-tarjeta__celda .meal-crumb--flexible')).toBeInTheDocument()
  expect(screen.getAllByText('Flexible').length).toBeGreaterThan(0)
})

test('Semana muestra guion para Extra sin anotar y la etiqueta MIXED de la API', () => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  const data = { ...base.data!, days: [{ ...base.data!.days[0], meals: [
    { mealId: 1, name: 'Extra', planned: false, status: 'SIN_ANOTAR' as const, noteText: null },
    { mealId: 2, name: 'Cena', planned: true, status: 'MIXED' as const, noteText: 'pan' },
  ] }] }
  vi.mocked(useWeek).mockReturnValue({ ...base, data })
  const { container } = render(<WeekPage />)
  expect(container.querySelector('.semana-tarjeta__celda .meal-crumb--dash')).toBeInTheDocument()
  expect(screen.getByText('Faltó y de más')).toBeInTheDocument()
})


test.each(['1', '0'])('el parámetro exportar=%s controla la apertura inicial de la hoja', value => {
  window.history.replaceState({}, '', `/semana?exportar=${value}`)
  try {
    render(<WeekPage />)
    const dialog = screen.queryByRole('dialog', { name: 'Exportar para tu nutri' })
    if (value === '1') {
      expect(dialog).toBeInTheDocument()
      fireEvent.keyDown(dialog!, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } else {
      expect(dialog).not.toBeInTheDocument()
    }
  } finally {
    window.history.replaceState({}, '', '/')
  }
})
