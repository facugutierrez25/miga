import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, beforeEach, afterEach, test, expect } from 'vitest'
import MiPlanPage from './MiPlanPage'
import * as plansApi from '../api/plans'
import * as AuthContext from '../auth/AuthContext'

vi.mock('../api/plans')
vi.mock('../auth/AuthContext')

const mockUseAuth = vi.mocked(AuthContext.useAuth)
const mockGetMyPlan = vi.mocked(plansApi.getMyPlan)
const mockSaveMyPlan = vi.mocked(plansApi.saveMyPlan)

beforeEach(() => {
  mockUseAuth.mockReturnValue({ token: 'tok', login: vi.fn(), logout: vi.fn() })
})

afterEach(() => {
  vi.clearAllMocks()
})

test('muestra cargando mientras carga el plan', () => {
  mockGetMyPlan.mockReturnValue(new Promise(() => {}))
  render(<MiPlanPage />)
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
  render(<MiPlanPage />)
  await waitFor(() => expect(screen.getByText('Desayuno')).toBeInTheDocument())
  expect(screen.queryByPlaceholderText('Nombre de la comida')).not.toBeInTheDocument()
})

test('expande una comida al hacer clic en editar', async () => {
  mockGetMyPlan.mockResolvedValue({
    meals: [{ name: 'Almuerzo', displayOrder: 1, portions: [] }],
  })
  render(<MiPlanPage />)
  await waitFor(() => screen.getByLabelText('Editar comida'))
  fireEvent.click(screen.getByLabelText('Editar comida'))
  expect(screen.getByDisplayValue('Almuerzo')).toBeInTheDocument()
})

test('minimiza una comida al guardarla', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MiPlanPage />)
  await waitFor(() => screen.getByText('Agregar comida'))
  fireEvent.click(screen.getByText('Agregar comida'))
  fireEvent.change(screen.getByPlaceholderText('Nombre de la comida'), { target: { value: 'Merienda' } })
  fireEvent.click(screen.getByText('Guardar comida'))
  expect(screen.getByText('Merienda')).toBeInTheDocument()
  expect(screen.queryByPlaceholderText('Nombre de la comida')).not.toBeInTheDocument()
})

test('deshabilita guardar comida si el nombre está vacío', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MiPlanPage />)
  await waitFor(() => screen.getByText('Agregar comida'))
  fireEvent.click(screen.getByText('Agregar comida'))
  expect(screen.getByText('Guardar comida')).toBeDisabled()
})

test('agrega una comida expandida al hacer clic en agregar', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MiPlanPage />)
  await waitFor(() => screen.getByText('Agregar comida'))
  fireEvent.click(screen.getByText('Agregar comida'))
  expect(screen.getByPlaceholderText('Nombre de la comida')).toBeInTheDocument()
})

test('elimina una comida expandida', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MiPlanPage />)
  await waitFor(() => screen.getByText('Agregar comida'))
  fireEvent.click(screen.getByText('Agregar comida'))
  fireEvent.click(screen.getByLabelText('Eliminar comida'))
  expect(screen.queryByPlaceholderText('Nombre de la comida')).not.toBeInTheDocument()
})

test('confirma el plan y muestra mensaje de éxito', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  mockSaveMyPlan.mockResolvedValue({ meals: [] })
  render(<MiPlanPage />)
  await waitFor(() => screen.getByText('Confirmar plan'))
  fireEvent.click(screen.getByText('Confirmar plan'))
  await waitFor(() => expect(screen.getByText('¡Plan guardado!')).toBeInTheDocument())
})

test('muestra error si falla el confirmar', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  mockSaveMyPlan.mockRejectedValue(new Error('error de red'))
  render(<MiPlanPage />)
  await waitFor(() => screen.getByText('Confirmar plan'))
  fireEvent.click(screen.getByText('Confirmar plan'))
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
})
