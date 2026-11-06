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

test('Por día muestra cada comida, estado y nota; el contador flexible no se edita', () => {
  const { container } = render(<SemanaPage />)
  expect(container.querySelector('.semana-comida__nombre')).toHaveTextContent('Desayuno')
  expect(container.querySelector('.semana-comida__estado')).toHaveTextContent('Anotada')
  expect(screen.getByText('=pan y café')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Flexibles:/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Agua')).not.toBeInTheDocument()
})

test('Tarjeta y Planilla se eligen con un control segmentado', () => {
  render(<SemanaPage />)
  expect(screen.getByRole('button', { name: 'Tarjeta' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Planilla' }))
  expect(screen.getByRole('button', { name: 'Planilla' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('table')).toBeInTheDocument()
})

test('Planilla muestra la grilla con el texto escrito y los hábitos', () => {
  render(<SemanaPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Planilla' }))
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Desayuno' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '=pan y café' })).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Agua' })).not.toBeInTheDocument()
})

test('identifica el día actual y su fecha completa en ambas vistas', () => {
  render(<SemanaPage />)
  expect(screen.getByRole('heading', { level: 1, name: 'Semana' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'lunes, 26 de octubre de 2026' }).closest('article'))
    .toHaveAttribute('aria-current', 'date')
  expect(screen.getByText('Hoy')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Planilla' }))
  expect(screen.getByRole('rowheader', { name: /lunes, 26 de octubre de 2026/ }))
    .toHaveAttribute('aria-current', 'date')
})

test('la tira de la semana anuncia cada día con su resumen y marca el elegido', () => {
  render(<SemanaPage />)
  const dia = screen.getByRole('button', { name: /lunes, 26 de octubre de 2026, hoy: 0 de 1 comidas como el plan, 1 anotadas/ })
  expect(dia).toHaveAttribute('aria-pressed', 'true')
  expect(dia).toHaveAttribute('aria-current', 'date')
  expect(screen.getByText('comidas como el plan esta semana').parentElement).toHaveTextContent('0 de 1comidas como el plan esta semana')
})

test('Exportar abre una hoja con Excel y PDF, sin CSV ni link, y cierra con Escape devolviendo el foco', async () => {
  const exportWeek = vi.spyOn(api, 'exportWeek').mockResolvedValue()
  render(<SemanaPage />)
  const trigger = screen.getByRole('button', { name: 'Exportar' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Exportar para tu nutri' })
  expect(dialog).toHaveTextContent('Miga no lo comparte con nadie')
  expect(screen.queryByText(/CSV/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Guardar como PDF' })).toBeInTheDocument()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() => expect(trigger).toHaveFocus())
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: 'Descargar planilla de Excel' }))
  await waitFor(() => expect(exportWeek).toHaveBeenCalledWith('tok', '2026-10-26', 'xlsx'))
})

test('la tarjeta pone un guion cuando el plan de ese día no tiene esa comida', () => {
  const data = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26').data!
  const otroDia = { ...data.days[0], date: '2026-10-27', meals: [{ mealId: 11, name: 'Pre entreno', status: 'SIN_ANOTAR', noteText: null }] }
  vi.mocked(useWeek).mockReturnValue({ ...defaultUseWeek('tok', 'user@miga.uy', '2026-10-26'), data: { ...data, days: [data.days[0], otroDia] } })
  const { container } = render(<SemanaPage />)
  expect(container.querySelectorAll('.semana-tarjeta .semana-miga--no-aplica')).toHaveLength(2)
  expect(screen.getByText('No toca ese día')).toBeInTheDocument()
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


test('la tarjeta de develop destaca la comida flexible con el acento, aunque coincida con el plan', () => {
  const base = defaultUseWeek('tok', 'user@miga.uy', '2026-10-26')
  const data = { ...base.data!, days: base.data!.days.map(day => ({ ...day,
    meals: day.meals?.map(meal => ({ ...meal, status: 'EN_PLAN', flexibleCount: 1 })) })) }
  vi.mocked(useWeek).mockReturnValue({ ...base, data })
  const { container } = render(<SemanaPage />)
  expect(container.querySelector('.semana-tarjeta__celda .semana-miga--flexible')).toBeInTheDocument()
  expect(container.querySelector('.semana-comida__estado--flexible')).toHaveTextContent('Flexible')
})
