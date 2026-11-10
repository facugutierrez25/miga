import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import TodayPage from './TodayPage'
import WeekPage from './WeekPage'
import { getWeek } from '../api/week'
import { MemoryRouter, Routes, Route, Link, createMemoryRouter, RouterProvider } from 'react-router-dom'
import { vi, beforeEach, afterEach, test, expect } from 'vitest'
import MyPlanPage from './MyPlanPage'
import * as plansApi from '../api/plans'
import * as AuthContext from '../auth/authTypes'
import * as rulesApi from '../api/planRules'

vi.mock('../api/week')
vi.mock('../hooks/useDayRecord', () => ({ useDayRecord: () => ({ data: { meals: [], summary: [] }, status: 'success', retry: vi.fn(), reload: vi.fn(), setData: vi.fn() }) }))
vi.mock('../components/TodayHabits', () => ({ default: () => null }))
vi.mock('../api/plans')
vi.mock('../auth/authTypes')
vi.mock('../api/planRules')

const mockUseAuth = vi.mocked(AuthContext.useAuth)
const mockGetMyPlan = vi.mocked(plansApi.getMyPlan)
const mockSaveMyPlan = vi.mocked(plansApi.saveMyPlan)
const mockGetPlanHistory = vi.mocked(plansApi.getPlanHistory)
const defaultGroups = [
  { id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
  { id: 2, name: 'Cereales',  abbreviation: 'CER', displayOrder: 2, color: null },
  { id: 3, name: 'Frutas',    abbreviation: 'FRU', displayOrder: 3, color: null },
  { id: 4, name: 'Lácteos',   abbreviation: 'LAC', displayOrder: 4, color: null },
  { id: 5, name: 'Grasas',    abbreviation: 'GRA', displayOrder: 5, color: null },
  { id: 6, name: 'Verduras',  abbreviation: 'VER', displayOrder: 6, color: null },
]

const planWithGroups = {
  version: 4,
  createdAt: '2026-11-09',
  foodGroups: defaultGroups,
  meals: [{ name: 'Desayuno', displayOrder: 1, suggestedTime: '08:00:00', weekdays: [1, 3], portions: [{ foodGroupId: 1, portions: 2 }, { foodGroupId: 2, portions: 1 }] }],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 9, 12))
  mockUseAuth.mockReturnValue({ token: 'tok', email: 'u@test.com', firstName: null, login: vi.fn(), setFirstName: vi.fn(),
    sessionExpired: false, restoring: false, logout: vi.fn() })
  mockGetPlanHistory.mockResolvedValue([])
  vi.mocked(rulesApi.getPlanRules).mockResolvedValue({ planId: 1, planVersion: 0, modoRegistro: 'LIBRE', grupos: [], alimentos: [], habitos: [] })

})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})


function setup() {
  mockGetMyPlan.mockResolvedValue(planWithGroups)
  render(<MemoryRouter><MyPlanPage /></MemoryRouter>)
}
test('carga, error y reintento', async () => {
  mockGetMyPlan.mockRejectedValueOnce(new Error('error')).mockResolvedValue(planWithGroups)
  render(<MemoryRouter><MyPlanPage /></MemoryRouter>)
  fireEvent.click(await screen.findByText('Reintentar'))
  expect(await screen.findByText('Desayuno')).toBeInTheDocument()
})
test('portada con fecha, porciones, migas por grupo, totales y accesos con cantidades', async () => {
  setup()
  const meal = await screen.findByRole('button', { name: 'Editar Desayuno' })
  expect(meal).toHaveTextContent('08:00')
  expect(meal).toHaveTextContent('3 porciones')
  expect(meal).toHaveTextContent('2 Proteínas · 1 Cereales')
  expect(meal.querySelectorAll('.meal-crumb')).toHaveLength(3)
  expect(meal.querySelectorAll('[style]')[0].getAttribute('style')).toContain('--crumb-color')
  expect(screen.getByText(/Actualizado el/)).toHaveTextContent('9 de noviembre de 2026')
  expect(screen.getByText('Tu día completo · hoy, lunes')).toBeInTheDocument()
  expect(document.querySelector('.plan-totals')).toHaveTextContent('Proteínas2')
  for (const label of ['Tus alimentos', 'Hábitos', 'Grupos', 'Planes anteriores']) {
    expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toHaveTextContent(/\d/)
  }
  expect(screen.queryByRole('button', { name: 'Listo, ir a Hoy' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Editar plan' })).not.toBeInTheDocument()
})
test('guarda el plan completo con versión, días y las otras comidas intactas', async () => {
  const other = { name: 'Cena', displayOrder: 2, weekdays: [2], portions: [{ foodGroupId: 1, portions: 1 }] }
  mockGetMyPlan.mockResolvedValue({ ...planWithGroups, meals: [...planWithGroups.meals, other] })
  mockSaveMyPlan.mockResolvedValue({ ...planWithGroups, version: 5 })
  render(<MemoryRouter><MyPlanPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Desayuno' }))
  fireEvent.click(screen.getByRole('button', { name: 'Aumentar Proteínas' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(mockSaveMyPlan).toHaveBeenCalledWith('tok', expect.objectContaining({
    clientVersion: 4,
    meals: [
      expect.objectContaining({ name: 'Desayuno', weekdays: [1, 3], portions: expect.arrayContaining([{ foodGroupAbbr: 'PRO', portions: 2.5 }]) }),
      expect.objectContaining({ name: 'Cena', weekdays: [2] }),
    ],
  })))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
test('agrega una comida desde la hoja vacía y elimina con confirmación', async () => {
  setup()
  await screen.findByText('Desayuno')
  fireEvent.click(screen.getByRole('button', { name: 'Agregar comida' }))
  expect(screen.getByLabelText('Nombre de la comida')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Editar Desayuno' }))
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar comida' }))
  expect(mockSaveMyPlan).not.toHaveBeenCalled()
  mockSaveMyPlan.mockResolvedValue({ ...planWithGroups, meals: [], version: 5 })
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  await waitFor(() => expect(mockSaveMyPlan).toHaveBeenCalledWith('tok', { clientVersion: 4, meals: [] }))
})
test('un conflicto conserva la hoja y permite recargar', async () => {
  setup()
  mockSaveMyPlan.mockRejectedValue(new plansApi.PlanConflictError())
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Desayuno' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByText(/modificado en otro dispositivo/)).toBeInTheDocument()
  mockGetMyPlan.mockResolvedValue({ ...planWithGroups, meals: [{ ...planWithGroups.meals[0], name: 'Nuevo desayuno' }] })
  fireEvent.click(screen.getAllByRole('button', { name: 'Recargar plan' }).at(-1)!)
  expect(await screen.findByText('Nuevo desayuno')).toBeInTheDocument()
})
test('sin plan permite agregar una comida', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  render(<MemoryRouter><MyPlanPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar comida' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
test('los planes anteriores conservan el detalle de solo lectura', async () => {
  mockGetPlanHistory.mockResolvedValue([{ ...planWithGroups, createdAt: '2026-10-01', supersededAt: '2026-11-01', mealCount: 1 }])
  setup()
  fireEvent.click(await screen.findByRole('button', { name: /Planes anteriores/ }))
  fireEvent.click(await screen.findByRole('button', { name: /1 comidas/ }))
  expect(screen.getByRole('dialog', { name: 'Detalle del plan' })).toBeInTheDocument()
})

test('navegar a Hoy y Semana tras guardar consulta la versión nueva sin recargar la página', async () => {
  let current = planWithGroups
  mockGetMyPlan.mockImplementation(async () => current)
  mockSaveMyPlan.mockImplementation(async (_token, input) => {
    current = { ...planWithGroups, version: 5, meals: input.meals.map((meal, index) => ({
      ...meal, id: index + 1, suggestedTime: meal.suggestedTime ?? '', weekdays: meal.weekdays ?? [],
      portions: meal.portions.map(p => ({ foodGroupId: defaultGroups.find(g => g.abbreviation === p.foodGroupAbbr)!.id, portions: p.portions })),
    })) }
    return current
  })
  vi.mocked(getWeek).mockImplementation(async () => ({
    weekStart: '2026-11-09', weekEnd: '2026-11-15', habits: [],
    days: [{ date: '2026-11-09', hasData: false, totalRecorded: 0, totalGoal: 3, habitLogs: [],
      meals: current.meals.map((meal, index) => ({ mealId: index + 1, name: meal.name, status: 'SIN_ANOTAR', planned: true, noteText: null })) }],
  }))
  render(<MemoryRouter initialEntries={['/mi-plan']}>
    <nav><Link to="/hoy">Ir a Hoy</Link><Link to="/semana">Ir a Semana</Link><Link to="/mi-plan">Ir a Mi plan</Link></nav>
    <Routes><Route path="/mi-plan" element={<MyPlanPage />} /><Route path="/hoy" element={<TodayPage />} /><Route path="/semana" element={<WeekPage />} /></Routes>
  </MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Desayuno' }))
  fireEvent.change(screen.getByLabelText('Nombre de la comida'), { target: { value: 'Desayuno nuevo' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await screen.findByText('¡Plan guardado!')
  fireEvent.click(screen.getByText('Ir a Hoy'))
  expect((await screen.findAllByText('Desayuno nuevo')).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByText('Ir a Semana'))
  expect((await screen.findAllByText('Desayuno nuevo')).length).toBeGreaterThan(0)
  expect(getWeek).toHaveBeenCalled()
})

test('el PUT real invalida la caché GET del plan y de Semana', async () => {
  const plans = await vi.importActual<typeof import('../api/plans')>('../api/plans')
  const week = await vi.importActual<typeof import('../api/week')>('../api/week')
  let version = 4
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PUT') version = 5
    return new Response(JSON.stringify(String(input).includes('semana') ? { version } : { ...planWithGroups, version }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  try {
    await plans.getMyPlan('cache-plan-359')
    await week.getWeek('cache-plan-359', '2026-11-09')
    await plans.saveMyPlan('cache-plan-359', { clientVersion: 4, meals: [] })
    expect((await plans.getMyPlan('cache-plan-359')).version).toBe(5)
    expect(await week.getWeek('cache-plan-359', '2026-11-09')).toMatchObject({ version: 5 })
    expect(fetchMock).toHaveBeenCalledTimes(5)
  } finally { vi.unstubAllGlobals() }
})


test('los totales de hoy incluyen solo las comidas del día y las de todos los días', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planWithGroups, meals: [
    ...planWithGroups.meals,
    { name: 'Martes', displayOrder: 2, weekdays: [2], portions: [{ foodGroupId: 1, portions: 8 }] },
    { name: 'Diaria', displayOrder: 3, portions: [{ foodGroupId: 1, portions: 1 }] },
    { name: 'Sin días', displayOrder: 4, weekdays: [], portions: [{ foodGroupId: 1, portions: 0.5 }] },
  ] })
  render(<MemoryRouter><MyPlanPage /></MemoryRouter>)
  await screen.findByRole('button', { name: 'Editar Martes' })
  expect(screen.getByRole('heading', { name: 'Tu día completo · hoy, lunes' })).toBeInTheDocument()
  expect(document.querySelector('.plan-totals')).toHaveTextContent('Proteínas3,5')
})

test('en onboarding guarda cada comida y espera el botón final para ir a Hoy', async () => {
  mockGetMyPlan.mockResolvedValue(planWithGroups)
  mockSaveMyPlan.mockResolvedValue({ ...planWithGroups, version: 5 })
  render(<MemoryRouter initialEntries={[{ pathname: '/mi-plan', state: { meals: [{ name: 'Desayuno', suggestedTime: '08:00' }] } }]}>
    <Routes><Route path="/mi-plan" element={<MyPlanPage />} /><Route path="/hoy" element={<h1>Hoy</h1>} /></Routes>
  </MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Desayuno' }))
  fireEvent.click(screen.getByRole('button', { name: 'Aumentar Proteínas' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await screen.findByText('¡Plan guardado!')
  await new Promise(resolve => setTimeout(resolve, 1900))
  expect(screen.getByRole('button', { name: 'Editar Desayuno' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Hoy' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Listo, ir a Hoy' }))
  expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
  expect(mockSaveMyPlan).toHaveBeenLastCalledWith('tok', expect.objectContaining({ clientVersion: 5 }))
})

test('el botón final guarda las comidas pendientes y permanece si falla', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  let finishSave!: (plan: typeof planWithGroups) => void
  mockSaveMyPlan.mockRejectedValueOnce(new Error('sin conexión')).mockImplementationOnce(() =>
    new Promise(resolve => { finishSave = resolve }))
  const router = createMemoryRouter([
    { path: '/mi-plan', element: <MyPlanPage /> },
    { path: '/hoy', element: <h1>Hoy</h1> },
  ], { initialEntries: [{ pathname: '/mi-plan', state: { meals: [
    { name: 'Desayuno', suggestedTime: '08:00' },
    { name: 'Cena', suggestedTime: '20:00' },
  ] } }] })
  render(<RouterProvider router={router} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Listo, ir a Hoy' }))
  expect(await screen.findByText('No se pudo guardar el plan. Intentá de nuevo.')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/mi-plan')
  fireEvent.click(screen.getByRole('button', { name: 'Listo, ir a Hoy' }))
  expect(mockSaveMyPlan).toHaveBeenLastCalledWith('tok', {
    clientVersion: undefined,
    meals: ['Desayuno', 'Cena'].map((name, index) => ({
      name, suggestedTime: index ? '20:00:00' : '08:00:00', displayOrder: index + 1,
      weekdays: undefined,
      portions: defaultGroups.map(group => ({ foodGroupAbbr: group.abbreviation, portions: 0 })),
    })),
  })
  expect(router.state.location.pathname).toBe('/mi-plan')
  await act(async () => finishSave(planWithGroups))
  expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
  expect(screen.queryByRole('alert', { name: 'Cambios sin guardar' })).not.toBeInTheDocument()
})

test('al volver con cambios la confirmación está dentro de la hoja y permite continuar o descartar', async () => {
  mockGetMyPlan.mockResolvedValue(planWithGroups)
  const router = createMemoryRouter([
    { path: '/anterior', element: <h1>Anterior</h1> },
    { path: '/mi-plan', element: <MyPlanPage /> },
  ], { initialEntries: ['/anterior', '/mi-plan'] })
  render(<RouterProvider router={router} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Desayuno' }))
  fireEvent.change(screen.getByLabelText('Nombre de la comida'), { target: { value: 'Desayuno nuevo' } })
  await act(async () => { await router.navigate(-1) })
  const dialog = screen.getByRole('dialog', { name: 'Editar comida' })
  const notice = within(dialog).getByRole('alert', { name: 'Cambios sin guardar' })
  const discard = within(notice).getByRole('button', { name: 'Descartar cambios' })
  discard.focus()
  expect(discard).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
  expect(dialog).toContainElement(document.activeElement as HTMLElement)
  fireEvent.click(within(notice).getByRole('button', { name: 'Seguir editando' }))
  expect(router.state.location.pathname).toBe('/mi-plan')
  expect(screen.getByLabelText('Nombre de la comida')).toHaveValue('Desayuno nuevo')
  await act(async () => { await router.navigate(-1) })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Descartar cambios' }))
  expect(await screen.findByRole('heading', { name: 'Anterior' })).toBeInTheDocument()
})
