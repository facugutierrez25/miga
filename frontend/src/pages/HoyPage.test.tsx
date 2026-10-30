import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import HoyPage from './HoyPage'
import * as plansApi from '../api/plans'
import * as registroApi from '../api/registro'
import * as AuthContext from '../auth/authTypes'

vi.mock('../api/plans')
vi.mock('../api/registro', async importOriginal => {
  const actual = await importOriginal<typeof import('../api/registro')>()
  return { ...actual, getDayRegistro: vi.fn(), saveNota: vi.fn(), patchItem: vi.fn(),
    saveRespuesta: vi.fn(), getSugerencias: vi.fn() }
})
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
    sessionExpired: false,
    logout: vi.fn(),
  })
  mockGetDayRegistro.mockResolvedValue(dayVacio)
  mockGetSugerencias.mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
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
      noteId: 5, noteVersion: 0,
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
    noteId: 1, version: 0,
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
  await waitFor(() => expect(mockSaveNota).toHaveBeenCalledWith('tok', expect.any(String), 1, 'leche', null))
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
    noteId: 1, version: 0, text: '1 barrita', date: '2025-01-01', mealId: 1, items: [], comparison: [],
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
      mealId: 1, noteId: 1, noteVersion: 0, noteText: 'leche', comparison: [],
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

test('muestra los alimentos reconocidos sin grupo con su regla', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockSaveNota.mockResolvedValue({
    noteId: 1, version: 0, text: 'mate', date: '2025-01-01', mealId: 1, comparison: [], entries: [{ id: 99, food: 'mate', quantity: 1, unit: 'u', foodGroupId: null, portions: null, origin: 'MENTION', uncertain: false, appliedRule: 'mate = libre (sin porcion asignada)', occurrenceId: 'mate-1' }],
    items: [{
      originalText: 'mate', foodName: 'mate', quantity: 1, unit: 'u', foodGroupId: null,
      standardGroupKey: null, portions: 0, appliedRule: 'mate = libre (sin porcion asignada)',
      uncertain: false, recognized: true, tipo: 'LIBRE',
    }],
  })
  renderHoy()
  await abrirNota()
  fireEvent.change(screen.getByPlaceholderText(/Qué comiste/), { target: { value: 'mate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText('mate = libre (sin porcion asignada)')).toBeInTheDocument()
  expect(screen.queryByText('Sin grupo en tu plan')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Corregir mate' })).not.toBeInTheDocument()
})

test('no duplica las menciones que ya generaron ítems', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planConComida, foodGroups: gruposBarrita })
  mockSaveNota.mockResolvedValue({
    noteId: 1, version: 0, text: '1 barrita', date: '2025-01-01', mealId: 1, comparison: [],
    items: [{
      originalText: '1 barrita', foodName: 'barrita', quantity: 1, unit: 'u', foodGroupId: null,
      standardGroupKey: null, portions: 1, appliedRule: 'barrita (compuesto)',
      uncertain: false, recognized: true, tipo: 'COMPUESTO',
    }],
    entries: [entradaBarrita(11, 1), entradaBarrita(12, 2), entradaBarrita(13, 3)],
  })
  renderHoy()
  await abrirNota()
  fireEvent.change(screen.getByPlaceholderText(/Qué comiste/), { target: { value: '1 barrita' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  await screen.findByRole('heading', { name: 'Así lo entendí' })
  expect(screen.queryByText('barrita (compuesto)')).not.toBeInTheDocument()
  expect(screen.getAllByText(reglaBarrita)).toHaveLength(1)
})


test('conserva el borrador ante conflicto, recarga la versión y usa la nueva al guardar', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  const meal = { mealId: 1, noteId: 5, noteVersion: 2, noteText: 'leche', items: [], comparison: [] }
  mockGetDayRegistro.mockResolvedValue({ ...dayVacio, meals: [meal] })
  renderHoy()
  await waitFor(() => expect(screen.getByText('0 ítems')).toBeInTheDocument())
  const toggle = screen.getByRole('button', { name: '0 ítems' })
  if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle)
  const textarea = screen.getByRole('textbox', { name: 'Nota de la comida' })
  fireEvent.change(textarea, { target: { value: 'mi borrador' } })
  const message = 'Esta nota cambió en otro dispositivo. Recargá para ver la versión actual.'
  mockSaveNota.mockRejectedValueOnce(new registroApi.NoteConflictError(message))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message))
  expect(textarea).toHaveValue('mi borrador')
  expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'mi borrador', 2)
  mockGetDayRegistro.mockResolvedValue({ ...dayVacio, meals: [{ ...meal, noteVersion: 3, noteText: 'otro dispositivo' }] })
  fireEvent.click(screen.getByRole('button', { name: 'Recargar' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(textarea).toHaveValue('mi borrador')
  mockSaveNota.mockResolvedValue({ noteId: 5, version: 4, text: 'mi borrador', date: dayVacio.date,
    mealId: 1, items: [], entries: [], comparison: [] })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'mi borrador', 3))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled())
  fireEvent.change(textarea, { target: { value: 'segunda edición' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'segunda edición', 4))
})

test('un borrador empezado sobre una versión vieja sigue dando conflicto tras una recarga automática', async () => {
  const mockSaveRespuesta = vi.mocked(registroApi.saveRespuesta)
  mockSaveRespuesta.mockResolvedValue(undefined)
  mockGetMyPlan.mockResolvedValue(planConComida)
  const dia = (noteVersion: number) => ({
    date: '2025-01-01', summary: [],
    meals: [{
      mealId: 1, noteId: 1, noteText: 'leche', noteVersion, items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0, status: 'PREGUNTA', dailyGoal: null }],
    }],
  })
  mockGetDayRegistro.mockResolvedValueOnce(dia(2)).mockResolvedValue(dia(3))
  mockSaveNota.mockResolvedValue({
    noteId: 1, text: 'leche y pan', date: '2025-01-01', mealId: 1, version: 3,
    items: [], entries: [], comparison: [],
  })
  renderHoy()
  await abrirNota()

  fireEvent.change(screen.getByPlaceholderText(/Qué comiste/), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sí' }))
  await waitFor(() => expect(mockGetDayRegistro).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  await waitFor(() => expect(mockSaveNota).toHaveBeenCalledWith('tok', expect.any(String), 1, 'leche y pan', 2))
})

test('recargar desde el conflicto adopta la versión actual aunque no haya cambiado', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  const dia = {
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, noteId: 1, noteText: 'leche', noteVersion: 3, items: [], comparison: [] }],
  }
  mockGetDayRegistro.mockResolvedValue(dia)
  mockSaveNota
    .mockRejectedValueOnce(new registroApi.NoteConflictError('Esta nota cambió en otro dispositivo.'))
    .mockResolvedValue({ noteId: 1, text: 'leche y pan', date: '2025-01-01', mealId: 1, version: 4, items: [], entries: [], comparison: [] })
  renderHoy()
  await abrirNota()

  fireEvent.change(screen.getByPlaceholderText(/Qué comiste/), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  await waitFor(() => expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'leche y pan', 3))
  expect(screen.getByPlaceholderText(/Qué comiste/)).toHaveValue('leche y pan')
})

test('si recargar falla, la versión base no cambia', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro
    .mockResolvedValueOnce({
      date: '2025-01-01', summary: [],
      meals: [{ mealId: 1, noteId: 1, noteText: 'leche', noteVersion: 2, items: [], comparison: [] }],
    })
    .mockRejectedValue(new Error('sin red'))
  mockSaveNota.mockRejectedValue(new registroApi.NoteConflictError('Esta nota cambió en otro dispositivo.'))
  renderHoy()
  await abrirNota()

  fireEvent.change(screen.getByPlaceholderText(/Qué comiste/), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  expect(await screen.findByText('No se pudo recargar. Intentá de nuevo.')).toBeInTheDocument()

  expect(mockSaveNota).toHaveBeenCalledTimes(1)
  expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'leche y pan', 2)
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/Qué comiste/)).toHaveValue('leche y pan')
})


test('muestra el inicio del plan aunque el registro del día siga pendiente', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  mockGetDayRegistro.mockReturnValue(new Promise(() => {}))
  renderHoy()
  await waitFor(() => expect(screen.getByRole('link', { name: 'Cargar mi plan' })).toBeInTheDocument())
})

test('permite reintentar un error del plan aunque el día siga pendiente', async () => {
  mockGetMyPlan.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce(planConComida)
  mockGetDayRegistro.mockReturnValue(new Promise(() => {}))
  renderHoy()
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el plan.'))
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(mockGetMyPlan).toHaveBeenCalledTimes(2))
})

test('un reintento general del día no borra el borrador ni su versión base', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  const dia = (noteVersion: number) => ({
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, noteId: 1, noteText: 'leche', noteVersion, items: [], comparison: [] }],
  })
  mockGetDayRegistro
    .mockResolvedValueOnce(dia(2))
    .mockRejectedValueOnce(new Error('sin red'))
    .mockResolvedValue(dia(3))
  mockSaveNota.mockRejectedValue(new registroApi.NoteConflictError('Esta nota cambió en otro dispositivo.'))
  renderHoy()
  await abrirNota()

  fireEvent.change(screen.getByPlaceholderText(/Qué comiste/), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(mockGetDayRegistro).toHaveBeenCalledTimes(3))

  expect(screen.getByPlaceholderText(/Qué comiste/)).toHaveValue('leche y pan')
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'leche y pan', 2)
})


test('lo de siempre guarda en un toque, bloquea doble envío y permite editar después', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planConComida, createdAt: '2026-10-03' })
  mockGetSugerencias.mockResolvedValue(['leche con pan'])
  let finish!: (value: registroApi.NoteInterpretationDto) => void
  mockSaveNota.mockReturnValue(new Promise(resolve => { finish = resolve }))
  renderHoy()
  await abrirNota()
  expect(screen.getByText('Según tu plan · cargado el 03/10')).toBeInTheDocument()
  const suggestion = await screen.findByRole('button', { name: 'leche con pan' })
  fireEvent.click(suggestion)
  fireEvent.click(suggestion)
  expect(suggestion).toBeDisabled()
  expect(mockSaveNota).toHaveBeenCalledTimes(1)
  expect(mockSaveNota).toHaveBeenCalledWith('tok', expect.any(String), 1, 'leche con pan', null)
  finish({ noteId: 1, version: 1, text: 'leche con pan', date: dayVacio.date, mealId: 1, items: [], entries: [], comparison: [] })
  await screen.findByRole('button', { name: 'Guardar cambios' })
  fireEvent.change(screen.getByRole('textbox', { name: 'Nota de la comida' }), { target: { value: 'otra nota' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'otra nota', 1)
})

test('un error al guardar una sugerencia conserva el borrador y permite reintentar', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetSugerencias.mockResolvedValue(['mate'])
  mockSaveNota.mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce({ noteId: 1, version: 0,
    text: 'mate', date: dayVacio.date, mealId: 1, items: [], entries: [], comparison: [] })
  renderHoy()
  await abrirNota()
  fireEvent.click(await screen.findByRole('button', { name: 'mate' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar')
  expect(screen.getByRole('textbox', { name: 'Nota de la comida' })).toHaveValue('mate')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await screen.findByRole('button', { name: 'Guardar cambios' })
  expect(mockSaveNota).toHaveBeenCalledTimes(2)
})

test('al recargar muestra menciones persistidas sin corrección ni porciones', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockResolvedValue({ ...dayVacio, meals: [{ mealId: 1, noteId: 5, noteVersion: 2,
    noteText: 'mate, algo raro', comparison: [], items: [
      { id: 51, food: 'mate', quantity: 1, unit: 'u', foodGroupId: null, portions: null, origin: 'MENTION', uncertain: false, appliedRule: 'libre' },
      { id: 52, food: 'algo raro', quantity: 1, unit: 'u', foodGroupId: null, portions: null, origin: 'UNKNOWN', uncertain: false },
    ] }] })
  renderHoy()
  await abrirNota()
  expect(screen.getByText('mate')).toBeInTheDocument()
  expect(screen.getByText('algo raro')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Corregir/ })).not.toBeInTheDocument()
})


test('dictado agrega texto al borrador sin guardarlo', async () => {
  let result!: (event: unknown) => void
  vi.stubGlobal('SpeechRecognition', class {
    set onresult(handler: (event: unknown) => void) { result = handler }
    start() {}
    abort() {}
  })
  mockGetMyPlan.mockResolvedValue(planConComida)
  renderHoy()
  await abrirNota()
  const draft = screen.getByRole('textbox', { name: 'Nota de la comida' })
  fireEvent.change(draft, { target: { value: 'mate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Dictar', pressed: false }))
  act(() => result({ results: [[{ transcript: 'con pan' }]] }))
  expect(draft).toHaveValue('mate con pan')
  expect(mockSaveNota).not.toHaveBeenCalled()
})

test('lo dictado mientras se guarda no se pierde al terminar el guardado', async () => {
  let result!: (event: unknown) => void
  vi.stubGlobal('SpeechRecognition', class {
    set onresult(handler: (event: unknown) => void) { result = handler }
    start() {}
    abort() {}
  })
  let terminarGuardado!: (value: unknown) => void
  mockSaveNota.mockReturnValue(new Promise(resolve => { terminarGuardado = resolve }) as never)
  mockGetMyPlan.mockResolvedValue(planConComida)
  renderHoy()
  await abrirNota()
  const draft = screen.getByRole('textbox', { name: 'Nota de la comida' })
  fireEvent.change(draft, { target: { value: 'mate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Dictar', pressed: false }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  act(() => result({ results: [[{ transcript: 'con pan' }]] }))
  await act(async () => {
    terminarGuardado({ noteId: 1, text: 'mate', date: '2025-01-01', mealId: 1, version: 1, items: [], entries: [], comparison: [] })
  })

  await waitFor(() => expect(draft).toHaveValue('mate con pan'))
})
