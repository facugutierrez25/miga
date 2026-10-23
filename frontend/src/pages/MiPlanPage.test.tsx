import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, beforeEach, afterEach, test, expect } from 'vitest'
import MiPlanPage from './MiPlanPage'
import * as plansApi from '../api/plans'
import * as AuthContext from '../auth/AuthContext'

vi.mock('../api/plans')
vi.mock('../auth/AuthContext')

const mockUseAuth = vi.mocked(AuthContext.useAuth)
const mockGetMyPlan = vi.mocked(plansApi.getMyPlan)
const mockSaveMyPlan = vi.mocked(plansApi.saveMyPlan)
const mockGetPlanHistory = vi.mocked(plansApi.getPlanHistory)

beforeEach(() => {
  mockUseAuth.mockReturnValue({ token: 'tok', email: 'u@test.com', login: vi.fn(), logout: vi.fn() })
  mockGetPlanHistory.mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

test('muestra cargando mientras carga el plan', () => {
  mockGetMyPlan.mockReturnValue(new Promise(() => {}))
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  expect(screen.getByText('Cargando tu plan…')).toBeInTheDocument()
})

test('muestra las comidas minimizadas al cargar el plan', async () => {
  mockGetMyPlan.mockResolvedValue({
    meals: [{
      name: 'Desayuno',
      displayOrder: 1,
      portions: [
        { foodGroup: 'PROTEINS',   portions: 1 },
        { foodGroup: 'GRAINS',     portions: 2 },
        { foodGroup: 'FRUITS',     portions: 0 },
        { foodGroup: 'DAIRY',      portions: 0 },
        { foodGroup: 'FATS',       portions: 0 },
        { foodGroup: 'VEGETABLES', portions: 0 },
      ],
    }],
  })
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => expect(screen.getByText('Desayuno')).toBeInTheDocument())
  expect(screen.queryByPlaceholderText('Nombre de la comida')).not.toBeInTheDocument()
})

test('expande una comida al hacer clic en editar', async () => {
  mockGetMyPlan.mockResolvedValue({
    meals: [{ name: 'Almuerzo', displayOrder: 1, portions: [] }],
  })
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => screen.getByLabelText('Editar comida'))
  fireEvent.click(screen.getByLabelText('Editar comida'))
  expect(screen.getByDisplayValue('Almuerzo')).toBeInTheDocument()
})

test('minimiza una comida al guardarla', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => screen.getByText('Agregar comida'))
  fireEvent.click(screen.getByText('Agregar comida'))
  fireEvent.change(screen.getByPlaceholderText('Nombre de la comida'), { target: { value: 'Merienda' } })
  fireEvent.click(screen.getByText('Guardar comida'))
  expect(screen.getByText('Merienda')).toBeInTheDocument()
  expect(screen.queryByPlaceholderText('Nombre de la comida')).not.toBeInTheDocument()
})

test('deshabilita guardar comida si el nombre está vacío', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => screen.getByText('Agregar comida'))
  fireEvent.click(screen.getByText('Agregar comida'))
  expect(screen.getByText('Guardar comida')).toBeDisabled()
})

test('agrega una comida expandida al hacer clic en agregar', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => screen.getByText('Agregar comida'))
  fireEvent.click(screen.getByText('Agregar comida'))
  expect(screen.getByPlaceholderText('Nombre de la comida')).toBeInTheDocument()
})

test('elimina una comida expandida', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => screen.getByText('Agregar comida'))
  fireEvent.click(screen.getByText('Agregar comida'))
  fireEvent.click(screen.getByLabelText('Eliminar comida'))
  await waitFor(() => expect(screen.getByText('Eliminar')).toBeInTheDocument())
  fireEvent.click(screen.getByText('Eliminar'))
  expect(screen.queryByPlaceholderText('Nombre de la comida')).not.toBeInTheDocument()
})

test('confirma el plan y muestra mensaje de éxito', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  mockSaveMyPlan.mockResolvedValue({ meals: [] })
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => screen.getByText('Confirmar plan'))
  fireEvent.click(screen.getByText('Confirmar plan'))
  await waitFor(() => expect(screen.getByText('¡Plan guardado!')).toBeInTheDocument())
})

test('muestra error si falla el confirmar', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  mockSaveMyPlan.mockRejectedValue(new Error('error de red'))
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => screen.getByText('Confirmar plan'))
  fireEvent.click(screen.getByText('Confirmar plan'))
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
})

test('abre el modal al hacer click en un plan del historial', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  mockGetPlanHistory.mockResolvedValue([{
    createdAt: '2026-09-01',
    supersededAt: '2026-10-01',
    mealCount: 2,
    meals: [
      { name: 'Desayuno', portions: [{ foodGroup: 'PROTEINS', portions: 1 }] },
      { name: 'Almuerzo', portions: [{ foodGroup: 'GRAINS', portions: 2 }] },
    ],
  }])
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => screen.getByText('2 comidas'))
  fireEvent.click(screen.getByText('2 comidas'))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText('Desayuno')).toBeInTheDocument()
  expect(screen.getByText('Almuerzo')).toBeInTheDocument()
})

test('cierra el modal al hacer click en el overlay', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  mockGetPlanHistory.mockResolvedValue([{
    createdAt: '2026-09-01',
    supersededAt: '2026-10-01',
    mealCount: 1,
    meals: [{ name: 'Cena', portions: [] }],
  }])
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => screen.getByText('1 comidas'))
  fireEvent.click(screen.getByText('1 comidas'))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('dialog'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
