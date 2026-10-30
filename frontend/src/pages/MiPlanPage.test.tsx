import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, beforeEach, afterEach, test, expect } from 'vitest'
import MiPlanPage from './MiPlanPage'
import * as plansApi from '../api/plans'
import * as AuthContext from '../auth/authTypes'
import * as rulesApi from '../api/planRules'

vi.mock('../api/plans')
vi.mock('../auth/authTypes')
vi.mock('../api/planRules')

const mockUseAuth = vi.mocked(AuthContext.useAuth)
const mockGetMyPlan = vi.mocked(plansApi.getMyPlan)
const mockSaveMyPlan = vi.mocked(plansApi.saveMyPlan)
const mockGetPlanHistory = vi.mocked(plansApi.getPlanHistory)
const gruposDefault = [
  { id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
  { id: 2, name: 'Cereales',  abbreviation: 'CER', displayOrder: 2, color: null },
  { id: 3, name: 'Frutas',    abbreviation: 'FRU', displayOrder: 3, color: null },
  { id: 4, name: 'Lácteos',   abbreviation: 'LAC', displayOrder: 4, color: null },
  { id: 5, name: 'Grasas',    abbreviation: 'GRA', displayOrder: 5, color: null },
  { id: 6, name: 'Verduras',  abbreviation: 'VER', displayOrder: 6, color: null },
]

const planConGrupos = {
  foodGroups: gruposDefault,
  meals: [{ name: 'Desayuno', displayOrder: 1, portions: gruposDefault.map(g => ({ foodGroupId: g.id, portions: 0 })) }],
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ token: 'tok', email: 'u@test.com', firstName: null, login: vi.fn(), setFirstName: vi.fn(), logout: vi.fn() })
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
    foodGroups: gruposDefault,
    meals: [{
      name: 'Desayuno',
      displayOrder: 1,
      portions: [
        { foodGroupId: 1, portions: 1 },
        { foodGroupId: 2, portions: 2 },
        { foodGroupId: 3, portions: 0 },
        { foodGroupId: 4, portions: 0 },
        { foodGroupId: 5, portions: 0 },
        { foodGroupId: 6, portions: 0 },
      ],
    }],
  })
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => expect(screen.getByText('Desayuno')).toBeInTheDocument())
  expect(screen.queryByPlaceholderText('Nombre de la comida')).not.toBeInTheDocument()
})

test('expande una comida al hacer clic en editar', async () => {
  mockGetMyPlan.mockResolvedValue({
    foodGroups: gruposDefault,
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
  mockSaveMyPlan.mockResolvedValue({ foodGroups: [], meals: [] })
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
    foodGroups: gruposDefault,
    meals: [
      { name: 'Desayuno', portions: [{ foodGroupId: 1, portions: 1 }] },
      { name: 'Almuerzo', portions: [{ foodGroupId: 2, portions: 2 }] },
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
    foodGroups: gruposDefault,
    meals: [{ name: 'Cena', portions: [] }],
  }])
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => screen.getByText('1 comidas'))
  fireEvent.click(screen.getByText('1 comidas'))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('dialog'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('abre Reglas de tu plan con una pestaña accesible', async () => {
  mockGetMyPlan.mockResolvedValue(planConGrupos)
  vi.mocked(rulesApi.getPlanRules).mockResolvedValue({ planId: 1, planVersion: 0, modoRegistro: 'LIBRE', grupos: [], alimentos: [], habitos: [] })
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  fireEvent.click(screen.getByRole('tab', { name: 'Reglas de tu plan' }))
  expect(screen.getByRole('tab', { name: 'Reglas de tu plan' })).toHaveAttribute('aria-selected', 'true')
  await waitFor(() => expect(rulesApi.getPlanRules).toHaveBeenCalledWith('tok'))
})

test('recarga las comidas cuando cambian las reglas del plan', async () => {
  mockGetMyPlan.mockResolvedValue(planConGrupos)
  vi.mocked(rulesApi.getPlanRules).mockResolvedValue({ planId: 2, planVersion: 4, modoRegistro: 'PORCIONES', grupos: [], alimentos: [], habitos: [] })
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await waitFor(() => expect(mockGetMyPlan).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('tab', { name: 'Reglas de tu plan' }))
  await waitFor(() => expect(mockGetMyPlan).toHaveBeenCalledTimes(2))
})
