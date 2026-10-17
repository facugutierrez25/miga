import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import HoyPage from './HoyPage'
import * as plansApi from '../api/plans'
import * as registroApi from '../api/registro'
import * as AuthContext from '../auth/AuthContext'

vi.mock('../api/plans')
vi.mock('../api/registro')
vi.mock('../auth/AuthContext')

const mockGetMyPlan = vi.mocked(plansApi.getMyPlan)
const mockGetLog = vi.mocked(registroApi.getLog)
const mockMarkMealEaten = vi.mocked(registroApi.markMealEaten)
const mockUnmarkMealEaten = vi.mocked(registroApi.unmarkMealEaten)

const planConComida = {
  meals: [{
    id: 1,
    name: 'Desayuno',
    suggestedTime: '08:00:00',
    displayOrder: 1,
    portions: [{ foodGroup: 'PROTEINS' as const, portions: 2 }],
  }],
}

beforeEach(() => {
  vi.mocked(AuthContext.useAuth).mockReturnValue({
    token: 'tok',
    email: 'facu@miga.uy',
    login: vi.fn(),
    logout: vi.fn(),
  })
  mockGetLog.mockResolvedValue([])
  mockMarkMealEaten.mockResolvedValue()
  mockUnmarkMealEaten.mockResolvedValue()
})

afterEach(() => {
  vi.clearAllMocks()
})

function renderHoy() {
  return render(<MemoryRouter><HoyPage /></MemoryRouter>)
}

test('muestra cargando mientras carga el plan', () => {
  mockGetMyPlan.mockReturnValue(new Promise(() => {}))
  renderHoy()
  expect(screen.getByText('Cargando tu día…')).toBeInTheDocument()
})

test('muestra link a mi plan cuando no hay plan cargado', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  renderHoy()
  await waitFor(() => expect(screen.getByText('Cargar mi plan')).toBeInTheDocument())
  expect(screen.getByRole('link', { name: 'Cargar mi plan' })).toHaveAttribute('href', '/onboarding')
})

test('muestra las comidas del plan ordenadas', async () => {
  mockGetMyPlan.mockResolvedValue({
    meals: [
      { id: 2, name: 'Almuerzo', displayOrder: 2, portions: [{ foodGroup: 'PROTEINS', portions: 2 }] },
      { id: 1, name: 'Desayuno', displayOrder: 1, portions: [{ foodGroup: 'GRAINS', portions: 1 }] },
    ],
  })
  renderHoy()
  await waitFor(() => expect(screen.getByText('Desayuno')).toBeInTheDocument())
  const nombres = screen.getAllByText(/Desayuno|Almuerzo/)
  expect(nombres[0]).toHaveTextContent('Desayuno')
  expect(nombres[1]).toHaveTextContent('Almuerzo')
})

test('muestra la hora sugerida cuando está presente', async () => {
  mockGetMyPlan.mockResolvedValue({
    meals: [{ id: 1, name: 'Desayuno', suggestedTime: '08:00:00', displayOrder: 1, portions: [{ foodGroup: 'DAIRY', portions: 1 }] }],
  })
  renderHoy()
  await waitFor(() => expect(screen.getByText('08:00')).toBeInTheDocument())
})

test('muestra solo los grupos con porciones mayores a cero', async () => {
  mockGetMyPlan.mockResolvedValue({
    meals: [{
      id: 1, name: 'Desayuno', displayOrder: 1,
      portions: [
        { foodGroup: 'PROTEINS', portions: 1 },
        { foodGroup: 'GRAINS',   portions: 0 },
      ],
    }],
  })
  renderHoy()
  await waitFor(() => expect(screen.getByText('Proteínas')).toBeInTheDocument())
  expect(screen.queryByText('Cereales')).not.toBeInTheDocument()
})

test('muestra el nombre del usuario en el saludo', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  renderHoy()
  await waitFor(() => expect(screen.getAllByText(/facu/).length).toBeGreaterThan(0))
})

test('muestra el resumen de porciones cuando hay un plan', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  renderHoy()
  await waitFor(() => expect(screen.getByText('porciones')).toBeInTheDocument())
})

test('el botón "Ya lo comí" marca la comida como hecha', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  renderHoy()
  await waitFor(() => expect(screen.getByText('Ya lo comí')).toBeInTheDocument())
  fireEvent.click(screen.getByText('Ya lo comí'))
  expect(mockMarkMealEaten).toHaveBeenCalledWith('tok', 1, expect.any(String))
  await waitFor(() => expect(screen.getByText('✓ Hecho')).toBeInTheDocument())
})

test('marca como comida las que ya están en el log', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetLog.mockResolvedValue([1])
  renderHoy()
  await waitFor(() => expect(screen.getByText('✓ Hecho')).toBeInTheDocument())
})

test('muestra "Hoy" en la barra de navegación por defecto', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  renderHoy()
  await waitFor(() => expect(screen.getAllByText('Hoy').length).toBeGreaterThan(0))
})
