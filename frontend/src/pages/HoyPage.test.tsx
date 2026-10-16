import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import HoyPage from './HoyPage'
import * as plansApi from '../api/plans'
import * as AuthContext from '../auth/AuthContext'

vi.mock('../api/plans')
vi.mock('../auth/AuthContext')

const mockGetMyPlan = vi.mocked(plansApi.getMyPlan)

beforeEach(() => {
  vi.mocked(AuthContext.useAuth).mockReturnValue({
    token: 'tok',
    email: 'facu@miga.uy',
    login: vi.fn(),
    logout: vi.fn(),
  })
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
      {
        name: 'Almuerzo',
        displayOrder: 2,
        portions: [{ foodGroup: 'PROTEINS', portions: 2 }],
      },
      {
        name: 'Desayuno',
        displayOrder: 1,
        portions: [{ foodGroup: 'GRAINS', portions: 1 }],
      },
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
    meals: [{
      name: 'Desayuno',
      suggestedTime: '08:00:00',
      displayOrder: 1,
      portions: [{ foodGroup: 'DAIRY', portions: 1 }],
    }],
  })
  renderHoy()
  await waitFor(() => expect(screen.getByText('08:00')).toBeInTheDocument())
})

test('muestra solo los grupos con porciones mayores a cero', async () => {
  mockGetMyPlan.mockResolvedValue({
    meals: [{
      name: 'Desayuno',
      displayOrder: 1,
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
  await waitFor(() => expect(screen.getByText(/facu/)).toBeInTheDocument())
})
