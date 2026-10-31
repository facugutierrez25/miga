import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, test, expect, afterEach } from 'vitest'
import SemanaPage from './SemanaPage'
import * as api from '../api/semana'

afterEach(() => vi.restoreAllMocks())

vi.mock('../hooks/useAhora', () => ({ useAhora: () => new Date('2026-10-26T12:00:00') }))

vi.mock('../auth/authTypes', () => ({ useAuth: () => ({ token: 'tok', email: 'user@miga.uy' }) }))
vi.mock('../hooks/useWeek', () => ({ useWeek: () => ({
  status: 'success', setData: vi.fn(), retry: vi.fn(), data: {
    weekStart: '2026-10-26', weekEnd: '2026-11-01', habits: [
      { id: 1, name: 'Flexibles', habitType: 'CONTADOR', step: 1, countsFlexibleMeals: true },
      { id: 2, name: 'Agua', habitType: 'CONTADOR', step: 250, unit: 'ml' }
    ], days: [{ date: '2026-10-26', hasData: true, totalRecorded: 0, totalGoal: 0,
      habitIds: [1, 2], habitLogs: [{ habitId: 1, date: '2026-10-26', value: 2 }, { habitId: 2, date: '2026-10-26', value: 500 }],
      meals: [{ mealId: 10, name: 'Desayuno', status: 'REGISTRADA', noteText: '=pan y café' }] }]
  }
}) }))

test('Por día muestra cada comida, estado y nota; el contador flexible no se edita', () => {
  render(<SemanaPage />)
  expect(screen.getByText('Desayuno')).toBeInTheDocument()
  expect(screen.getByText(/Registrada/)).toBeInTheDocument()
  expect(screen.getByText('=pan y café')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Flexibles: completado, 2, lunes, 26 de octubre de 2026/ })).toBeDisabled()
})

test('Planilla muestra la grilla con el texto escrito y los hábitos', () => {
  render(<SemanaPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Planilla' }))
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
  fireEvent.click(screen.getByRole('button', { name: 'Planilla' }))
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
