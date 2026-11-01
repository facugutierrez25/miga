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
  mockUseAuth.mockReturnValue({ token: 'tok', email: 'u@test.com', firstName: null, login: vi.fn(), setFirstName: vi.fn(),
    sessionExpired: false, logout: vi.fn() })
  mockGetPlanHistory.mockResolvedValue([])
  vi.mocked(rulesApi.getPlanRules).mockResolvedValue({ planId: 1, planVersion: 0, modoRegistro: 'LIBRE', grupos: [], alimentos: [], habitos: [] })

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
  fireEvent.click(await screen.findByRole('button', { name: 'Editar plan' }))
  expect(screen.getByDisplayValue('Almuerzo')).toBeInTheDocument()
})

test('minimiza una comida al guardarla', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Editar plan' }))
  await screen.findByText('Agregar comida')
  fireEvent.click(screen.getByText('Agregar comida'))
  fireEvent.change(screen.getByPlaceholderText('Nombre de la comida'), { target: { value: 'Merienda' } })
  fireEvent.click(screen.getByText('Listo'))
  expect(screen.getByText('Merienda')).toBeInTheDocument()
  expect(screen.queryByPlaceholderText('Nombre de la comida')).not.toBeInTheDocument()
})

test('deshabilita guardar comida si el nombre está vacío', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Editar plan' }))
  await screen.findByText('Agregar comida')
  fireEvent.click(screen.getByText('Agregar comida'))
  expect(screen.getByText('Listo')).toBeDisabled()
})

test('agrega una comida expandida al hacer clic en agregar', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Editar plan' }))
  await screen.findByText('Agregar comida')
  fireEvent.click(screen.getByText('Agregar comida'))
  expect(screen.getByPlaceholderText('Nombre de la comida')).toBeInTheDocument()
})

test('elimina una comida expandida', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Editar plan' }))
  await screen.findByText('Agregar comida')
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
  fireEvent.click(await screen.findByRole('button', { name: 'Editar plan' }))
  await screen.findByText('Guardar cambios')
  fireEvent.click(screen.getByText('Guardar cambios'))
  await waitFor(() => expect(screen.getByText('¡Plan guardado!')).toBeInTheDocument())
})

test('muestra error si falla el confirmar', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  mockSaveMyPlan.mockRejectedValue(new Error('error de red'))
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Editar plan' }))
  await screen.findByText('Guardar cambios')
  fireEvent.click(screen.getByText('Guardar cambios'))
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
  fireEvent.click(screen.getByRole('dialog').parentElement!)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('el detalle del plan enfoca su primer control, cierra con Escape y devuelve el foco', async () => {
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
  const trigger = screen.getByText('1 comidas').closest('button') ?? screen.getByText('1 comidas')
  ;(trigger as HTMLElement).focus()
  fireEvent.click(trigger)

  const dialog = screen.getByRole('dialog')
  expect(dialog.contains(document.activeElement)).toBe(true)
  fireEvent.keyDown(document, { key: 'Escape' })

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

test('abre Tus alimentos desde el resumen y recarga las comidas al cambiar reglas', async () => {
  mockGetMyPlan.mockResolvedValue(planConGrupos)
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Tus alimentos (0)' }))
  await screen.findByRole('button', { name: 'Agregar alimento' })
  await waitFor(() => expect(mockGetMyPlan).toHaveBeenCalledTimes(2))
})

test('cargar Mi plan no mueve el foco y editar lo lleva al nombre de la comida', async () => {
  mockGetMyPlan.mockResolvedValue(planConGrupos)
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await screen.findByRole('button', { name: 'Editar plan' })
  await screen.findByText('Desayuno')
  expect(document.activeElement).toBe(document.body)

  fireEvent.click(screen.getByRole('button', { name: 'Editar plan' }))

  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Nombre de la comida' })).toHaveFocus())
})

test('cancelar con cambios pide aviso inline y descarta el borrador', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planConGrupos, version: 3, createdAt: '2026-10-01' })
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  expect(await screen.findByText(/Cargado el/)).toBeInTheDocument()
  const edit = screen.getByRole('button', { name: 'Editar plan' })
  edit.focus()
  fireEvent.click(edit)
  fireEvent.change(await screen.findByLabelText('Nombre de la comida'), { target: { value: 'Cena' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.getByRole('alert')).toHaveTextContent('cambios sin guardar')
  fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }))
  expect(screen.getByDisplayValue('Cena')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect(screen.getByText('Desayuno')).toBeInTheDocument()
  expect(mockSaveMyPlan).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Editar plan' })).toHaveFocus())
})

test('guardar cambios envía la versión y vuelve al resumen', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planConGrupos, version: 3 })
  mockSaveMyPlan.mockResolvedValue({ ...planConGrupos, version: 4 })
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Editar plan' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await screen.findByRole('button', { name: 'Editar plan' })
  expect(mockSaveMyPlan).toHaveBeenCalledWith('tok', expect.objectContaining({ clientVersion: 3 }))
  expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
})

test('resumen muestra fecha, hora, porciones y color del grupo sin controles de edición', async () => {
  mockGetMyPlan.mockResolvedValue({
    ...planConGrupos, createdAt: '2026-10-01',
    foodGroups: [{ ...gruposDefault[0], color: '#B5627A' }],
    meals: [{ name: 'Desayuno', suggestedTime: '08:30:00', displayOrder: 1, portions: [{ foodGroupId: 1, portions: 1.5 }] }],
  })
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  await screen.findByText('Desayuno')
  expect(screen.getByText('08:30')).toBeInTheDocument()
  expect(screen.getByText('1,5')).toBeInTheDocument()
  expect(screen.getByText('Proteínas').closest('.porcion-chip')).toHaveStyle({ '--chip-dot': 'var(--g-frut)' })
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Eliminar comida' })).not.toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Hábitos (0)' })).toBeInTheDocument()
})

test('un conflicto conserva el borrador y permite recargar la versión actual', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planConGrupos, version: 3 })
  mockSaveMyPlan.mockRejectedValue(new plansApi.PlanConflictError())
  render(<MemoryRouter><MiPlanPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Editar plan' }))
  fireEvent.change(screen.getByLabelText('Nombre de la comida'), { target: { value: 'Cena' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('otro dispositivo')
  expect(screen.getByDisplayValue('Cena')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  mockGetMyPlan.mockResolvedValue({ ...planConGrupos, version: 4 })
  fireEvent.click(screen.getByRole('button', { name: 'Recargar plan' }))
  await screen.findByText('Desayuno')
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
})
