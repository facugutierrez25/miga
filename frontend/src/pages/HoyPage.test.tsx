import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import HoyPage from './HoyPage'
import * as plansApi from '../api/plans'
import * as registroApi from '../api/registro'
import * as AuthContext from '../auth/authTypes'

vi.mock('../api/plans')
vi.mock('../api/registro')
vi.mock('../auth/authTypes')

const mockGetMyPlan = vi.mocked(plansApi.getMyPlan)
const mockGetDayRegistro = vi.mocked(registroApi.getDayRegistro)
const mockSaveNota = vi.mocked(registroApi.saveNota)
const mockGetSugerencias = vi.mocked(registroApi.getSugerencias)

const gruposPRO = [{ id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null }]

const planConComida = {
  foodGroups: gruposPRO,
  meals: [{
    id: 1,
    name: 'Desayuno',
    suggestedTime: '08:00:00',
    displayOrder: 1,
    portions: [{ foodGroupId: 1, portions: 2 }],
  }],
}

const dayVacio = {
  date: '2025-01-01',
  meals: [],
  summary: [],
}

beforeEach(() => {
  vi.mocked(AuthContext.useAuth).mockReturnValue({
    token: 'tok',
    email: 'facu@miga.uy',
    firstName: 'Facu',
    login: vi.fn(),
    setFirstName: vi.fn(),
    logout: vi.fn(),
  })
  mockGetDayRegistro.mockResolvedValue(dayVacio)
  mockGetSugerencias.mockResolvedValue([])
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
    foodGroups: [
      { id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
      { id: 2, name: 'Cereales',  abbreviation: 'CER', displayOrder: 2, color: null },
    ],
    meals: [
      { id: 2, name: 'Almuerzo', displayOrder: 2, portions: [{ foodGroupId: 1, portions: 2 }] },
      { id: 1, name: 'Desayuno', displayOrder: 1, portions: [{ foodGroupId: 2, portions: 1 }] },
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
    foodGroups: [{ id: 4, name: 'Lácteos', abbreviation: 'LAC', displayOrder: 4, color: null }],
    meals: [{ id: 1, name: 'Desayuno', suggestedTime: '08:00:00', displayOrder: 1, portions: [{ foodGroupId: 4, portions: 1 }] }],
  })
  renderHoy()
  await waitFor(() => expect(screen.getByText('08:00')).toBeInTheDocument())
})

test('muestra solo los grupos con porciones mayores a cero', async () => {
  mockGetMyPlan.mockResolvedValue({
    foodGroups: [
      { id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
      { id: 2, name: 'Cereales',  abbreviation: 'CER', displayOrder: 2, color: null },
    ],
    meals: [{
      id: 1, name: 'Desayuno', displayOrder: 1,
      portions: [
        { foodGroupId: 1, portions: 1 },
        { foodGroupId: 2, portions: 0 },
      ],
    }],
  })
  renderHoy()
  await waitFor(() => expect(screen.getAllByText('Proteínas').length).toBeGreaterThan(0))
  expect(screen.queryByText('Cereales')).not.toBeInTheDocument()
})

test('muestra el nombre del usuario en el saludo', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  renderHoy()
  await waitFor(() => expect(screen.getAllByText(/facu/i).length).toBeGreaterThan(0))
})

test('muestra el resumen de porciones cuando hay un plan', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  renderHoy()
  await waitFor(() => expect(screen.getByText('porciones')).toBeInTheDocument())
})

test('muestra botón "Anotar" para comidas sin nota', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  renderHoy()
  await waitFor(() => expect(screen.getByText('Anotar')).toBeInTheDocument())
})

test('muestra nota guardada si el día tiene texto', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockResolvedValue({
    date: '2025-01-01',
    meals: [{
      mealId: 1,
      noteId: 5,
      noteText: 'leche con pan',
      items: [],
      comparison: [],
    }],
    summary: [],
  })
  renderHoy()
  await waitFor(() => expect(screen.getByText('0 ítems')).toBeInTheDocument())
})

test('el botón guardar envía la nota al backend', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockSaveNota.mockResolvedValue({
    noteId: 1,
    text: 'leche',
    date: '2025-01-01',
    mealId: 1,
    items: [],
    entries: [],
    comparison: [],
  })
  renderHoy()
  await waitFor(() => expect(screen.getByText('Desayuno')).toBeInTheDocument())

  // abrir la sección si está cerrada
  const toggles = screen.queryAllByRole('button', { expanded: false })
  const toggle = toggles.find(b => b.className.includes('nota-toggle'))
  if (toggle) fireEvent.click(toggle)

  await waitFor(() => expect(screen.getByPlaceholderText(/Qué comiste/)).toBeInTheDocument())
  fireEvent.change(screen.getByPlaceholderText(/Qué comiste/), { target: { value: 'leche' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await waitFor(() => expect(mockSaveNota).toHaveBeenCalledWith('tok', expect.any(String), 1, 'leche'))
})

test('muestra error si getDayRegistro falla', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockRejectedValue(new Error('red error'))
  renderHoy()
  await waitFor(() => expect(screen.getByText(/No se pudo cargar/)).toBeInTheDocument())
})

test('muestra "Hoy" en la barra de navegación por defecto', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  renderHoy()
  await waitFor(() => expect(screen.getAllByText('Hoy').length).toBeGreaterThan(0))
})

const gruposBarrita = [
  { id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
  { id: 2, name: 'Cereales', abbreviation: 'CER', displayOrder: 2, color: null },
  { id: 3, name: 'Grasas', abbreviation: 'GRA', displayOrder: 3, color: null },
]

const reglaBarrita = '1 barrita = 1 Proteínas + 1 Cereales + 1 Grasas'

function entradaBarrita(id: number, foodGroupId: number) {
  return {
    id, food: 'barrita', quantity: 1, unit: 'u', foodGroupId, portions: 1, origin: 'REGLA',
    uncertain: false, originalText: '1 barrita', appliedRule: reglaBarrita, occurrenceId: 'occ-1',
  }
}

async function abrirNota() {
  await waitFor(() => expect(screen.getByText('Desayuno')).toBeInTheDocument())
  const toggle = screen.queryAllByRole('button', { expanded: false })
    .find(b => b.className.includes('nota-toggle'))
  if (toggle) fireEvent.click(toggle)
  await waitFor(() => expect(screen.getByPlaceholderText(/Qué comiste/)).toBeInTheDocument())
}

test('muestra un compuesto en una fila con su regla bajo el título Así lo entendí', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planConComida, foodGroups: gruposBarrita })
  mockSaveNota.mockResolvedValue({
    noteId: 1, text: '1 barrita', date: '2025-01-01', mealId: 1, items: [], comparison: [],
    entries: [entradaBarrita(11, 1), entradaBarrita(12, 2), entradaBarrita(13, 3)],
  })
  renderHoy()
  await abrirNota()
  fireEvent.change(screen.getByPlaceholderText(/Qué comiste/), { target: { value: '1 barrita' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  const titulo = await screen.findByRole('heading', { name: 'Así lo entendí' })
  expect(titulo).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Así lo entendí' })).not.toBeInTheDocument()
  expect(screen.getAllByText(reglaBarrita)).toHaveLength(1)
  expect(screen.getByRole('list', { name: 'Grupos de barrita' }).querySelectorAll('li')).toHaveLength(3)
})

test('corregir permite repartir un ítem en varios grupos', async () => {
  const mockPatchItem = vi.mocked(registroApi.patchItem)
  mockGetMyPlan.mockResolvedValue({ ...planConComida, foodGroups: gruposBarrita })
  mockGetDayRegistro.mockResolvedValue({
    date: '2025-01-01', summary: [],
    meals: [{
      mealId: 1, noteId: 1, noteText: 'leche', comparison: [],
      items: [{ id: 21, food: 'leche', quantity: 1, unit: 'taza', foodGroupId: 1, portions: 1,
        origin: 'REGLA', uncertain: true, appliedRule: '1 leche = 1 Proteínas', occurrenceId: 'occ-2' }],
    }],
  })
  mockPatchItem.mockResolvedValue({ replacedItemIds: [21], items: [] })
  renderHoy()
  await abrirNota()

  expect(screen.getByText(/cantidad supuesta/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  fireEvent.click(screen.getByRole('button', { name: 'Repartir en varios grupos' }))
  fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y usar siempre' }))

  await waitFor(() => expect(mockPatchItem).toHaveBeenCalledWith('tok', expect.any(String), 21, {
    quantity: 1,
    grupos: [{ foodGroupId: 1, porciones: 1 }, { foodGroupId: 3, porciones: 1 }],
    saveAsRule: true,
  }))
})
