import { render, screen, fireEvent } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import SemanaPage from './SemanaPage'

vi.mock('../auth/authTypes', () => ({ useAuth: () => ({ token: 'tok', email: 'user@miga.uy' }) }))
vi.mock('../hooks/useWeek', () => ({ useWeek: () => ({
  status: 'success', setData: vi.fn(), retry: vi.fn(), data: {
    weekStart: '2026-10-26', weekEnd: '2026-11-01', habits: [
      { id: 1, name: 'Flexibles', habitType: 'CONTADOR', step: 1, countsFlexibleMeals: true }
    ], days: [{ date: '2026-10-26', hasData: true, totalRecorded: 0, totalGoal: 0,
      habitIds: [1], habitLogs: [{ habitId: 1, date: '2026-10-26', value: 2 }],
      meals: [{ mealId: 10, name: 'Desayuno', status: 'REGISTRADA', noteText: '=pan y café' }] }]
  }
}) }))

test('Por día muestra cada comida, estado y nota; el contador flexible no se edita', () => {
  render(<SemanaPage />)
  expect(screen.getByText('Desayuno')).toBeInTheDocument()
  expect(screen.getByText(/Registrada/)).toBeInTheDocument()
  expect(screen.getByText('=pan y café')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Flexibles: completado' })).toBeDisabled()
})

test('Planilla muestra la grilla con el texto escrito y los hábitos', () => {
  render(<SemanaPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Planilla' }))
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Desayuno' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '=pan y café' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument()
})
