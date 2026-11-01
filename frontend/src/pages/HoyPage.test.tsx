import { act, render, screen, waitFor, fireEvent, within } from '@testing-library/react'
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
    saveRespuesta: vi.fn(), getSugerencias: vi.fn(), deleteNota: vi.fn(), removeItem: vi.fn() }
})
vi.mock('../auth/authTypes')

const mockGetMyPlan = vi.mocked(plansApi.getMyPlan)
const mockGetDayRegistro = vi.mocked(registroApi.getDayRegistro)
const mockSaveNota = vi.mocked(registroApi.saveNota)
const mockGetSugerencias = vi.mocked(registroApi.getSugerencias)
const mockDeleteNota = vi.mocked(registroApi.deleteNota)

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

test('muestra primero la comida de ahora y el resto en el orden del plan', async () => {
  mockGetMyPlan.mockResolvedValue({
    foodGroups: [
      { id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
      { id: 2, name: 'Cereales',  abbreviation: 'CER', displayOrder: 2, color: null },
    ],
    meals: [
      { id: 3, name: 'Cena', displayOrder: 3, portions: [{ foodGroupId: 1, portions: 1 }] },
      { id: 2, name: 'Almuerzo', displayOrder: 2, portions: [{ foodGroupId: 1, portions: 2 }] },
      { id: 1, name: 'Desayuno', displayOrder: 1, portions: [{ foodGroupId: 2, portions: 1 }] },
    ],
  })
  renderHoy()
  // Sin horarios, la comida de ahora es la última del plan; el resto sigue el orden del plan.
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Cena', level: 2 })).toBeInTheDocument())
  const resto = screen.getByRole('list')
  const nombres = Array.from(resto.querySelectorAll('.hoy-fila__nombre')).map(n => n.textContent)
  expect(nombres).toEqual(['Desayuno', 'Almuerzo'])
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
  await waitFor(() => expect(screen.getByText('0 de 2 porciones')).toBeInTheDocument())
  expect(screen.getAllByRole('img', { name: 'Proteínas: 0 de 2 porciones' }).length).toBeGreaterThan(0)
})

test('el día sin anotar explica las migas', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  renderHoy()
  await waitFor(() => expect(screen.getByText(/Cada porción de tu plan es una miga/)).toBeInTheDocument())
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
  await waitFor(() => expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche con pan'))
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

  await waitFor(() => expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toBeInTheDocument())
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche' } })
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
  await waitFor(() => expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toBeInTheDocument())
}

test('muestra un compuesto en una fila con su regla bajo el título Así lo entendí', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planConComida, foodGroups: gruposBarrita })
  mockSaveNota.mockResolvedValue({
    noteId: 1, version: 0, text: '1 barrita', date: '2025-01-01', mealId: 1, items: [], comparison: [],
    entries: [entradaBarrita(11, 1), entradaBarrita(12, 2), entradaBarrita(13, 3)],
  })
  renderHoy()
  await abrirNota()
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: '1 barrita' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  const titulo = await screen.findByRole('heading', { name: 'Así lo entendí' })
  expect(titulo).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Así lo entendí' })).not.toBeInTheDocument()
  await abrirDetalle()
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de barrita' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cómo lo calculé' }))
  expect(screen.getAllByText(reglaBarrita)).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Corregir grupos de barrita' }))
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

  await abrirDetalle()
  expect(screen.getByText(/cantidad estimada/)).toBeInTheDocument()
  if (screen.getByRole('button', { name: /Revisar lo que/ }).getAttribute('aria-expanded') === 'false') await abrirDetalle()
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
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'mate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de mate' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cómo lo calculé' }))
  expect(screen.getByText('mate = libre (sin porcion asignada)')).toBeInTheDocument()
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
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: '1 barrita' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  await screen.findByRole('heading', { name: 'Así lo entendí' })
  expect(screen.queryByText('barrita (compuesto)')).not.toBeInTheDocument()
  await abrirDetalle()
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de barrita' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cómo lo calculé' }))
  expect(screen.getAllByText(reglaBarrita)).toHaveLength(1)
})


test('conserva el borrador ante conflicto, recarga la versión y usa la nueva al guardar', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  const meal = { mealId: 1, noteId: 5, noteVersion: 2, noteText: 'leche', items: [], comparison: [] }
  mockGetDayRegistro.mockResolvedValue({ ...dayVacio, meals: [meal] })
  renderHoy()
  await waitFor(() => expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche'))
  const textarea = screen.getByRole('textbox', { name: '¿Qué comiste?' })
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
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0, status: 'PREGUNTAR' }],
    }],
  })
  mockGetDayRegistro.mockResolvedValueOnce(dia(2)).mockResolvedValue(dia(3))
  mockSaveNota.mockResolvedValue({
    noteId: 1, text: 'leche y pan', date: '2025-01-01', mealId: 1, version: 3,
    items: [], entries: [], comparison: [],
  })
  renderHoy()
  await abrirNota()

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
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

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  await waitFor(() => expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'leche y pan', 3))
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche y pan')
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

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  expect(await screen.findByText('No se pudo recargar. Intentá de nuevo.')).toBeInTheDocument()

  expect(mockSaveNota).toHaveBeenCalledTimes(1)
  expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'leche y pan', 2)
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche y pan')
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

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(mockGetDayRegistro).toHaveBeenCalledTimes(3))

  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche y pan')
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
  expect(screen.queryByText(/Según tu plan/)).not.toBeInTheDocument()
  const suggestion = await screen.findByRole('button', { name: 'leche con pan' })
  fireEvent.click(suggestion)
  fireEvent.click(suggestion)
  expect(suggestion).toBeDisabled()
  expect(mockSaveNota).toHaveBeenCalledTimes(1)
  expect(mockSaveNota).toHaveBeenCalledWith('tok', expect.any(String), 1, 'leche con pan', null)
  finish({ noteId: 1, version: 1, text: 'leche con pan', date: dayVacio.date, mealId: 1, items: [], entries: [], comparison: [] })
  await screen.findByRole('button', { name: 'Guardar cambios' })
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'otra nota' } })
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
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('mate')
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
  const draft = screen.getByRole('textbox', { name: '¿Qué comiste?' })
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
  const draft = screen.getByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(draft, { target: { value: 'mate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Dictar', pressed: false }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  act(() => result({ results: [[{ transcript: 'con pan' }]] }))
  await act(async () => {
    terminarGuardado({ noteId: 1, text: 'mate', date: '2025-01-01', mealId: 1, version: 1, items: [], entries: [], comparison: [] })
  })

  await waitFor(() => expect(draft).toHaveValue('mate con pan'))
})

test('corregir mueve el foco a la cantidad y cancelar lo devuelve al botón', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockResolvedValue({
    date: '2025-01-01', summary: [],
    meals: [{
      mealId: 1, noteId: 1, noteText: 'leche', noteVersion: 1, comparison: [],
      items: [{ id: 31, food: 'leche', quantity: 1, unit: 'taza', foodGroupId: 1, portions: 1,
        origin: 'REGLA', uncertain: false, appliedRule: null, occurrenceId: 'occ-31' }],
    }],
  })
  renderHoy()
  await abrirNota()

  if (screen.getByRole('button', { name: /Revisar lo que/ }).getAttribute('aria-expanded') === 'false') await abrirDetalle()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  expect(screen.getByRole('spinbutton', { name: 'Cantidad de leche' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

  await waitFor(() => expect(screen.getByRole('button', { name: 'Corregir leche' })).toHaveFocus())
})

test('si falla una respuesta a la pregunta, se muestra el error', async () => {
  vi.mocked(registroApi.saveRespuesta).mockRejectedValue(new Error('sin red'))
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockResolvedValue({
    date: '2025-01-01', summary: [],
    meals: [{
      mealId: 1, noteId: 1, noteText: 'leche', noteVersion: 1, items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0, status: 'PREGUNTAR' }],
    }],
  })
  renderHoy()
  await abrirNota()

  fireEvent.click(screen.getByRole('button', { name: 'Sí' }))

  expect(await screen.findByText('No se pudo guardar la respuesta. Intentá de nuevo.')).toBeInTheDocument()
})

test('al guardar dice qué faltó y suma lo anotado al día', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockSaveNota.mockResolvedValue({
    noteId: 1, version: 0, text: 'un huevo', date: '2025-01-01', mealId: 1, items: [],
    entries: [{ id: 7, food: 'huevo', quantity: 1, unit: 'u', foodGroupId: 1, portions: 1, origin: 'REGLA',
      uncertain: false, originalText: 'un huevo', appliedRule: null, occurrenceId: null }],
    comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded: 1, status: 'CASI' }],
  })
  renderHoy()
  const textarea = await screen.findByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(textarea, { target: { value: 'un huevo' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Guardado. Faltó 1 porción de Proteínas.')
  expect(screen.getByText('1 de 2 porciones')).toBeInTheDocument()
  expect(screen.getAllByRole('img', { name: 'Proteínas: 1 de 2 porciones' }).length).toBeGreaterThan(0)
})

test('las otras comidas muestran su estado en texto y se abren para anotar', async () => {
  mockGetMyPlan.mockResolvedValue({
    foodGroups: gruposPRO,
    meals: [
      { id: 1, name: 'Desayuno', displayOrder: 1, portions: [{ foodGroupId: 1, portions: 1 }] },
      { id: 2, name: 'Cena', displayOrder: 2, portions: [{ foodGroupId: 1, portions: 2 }] },
    ],
  })
  mockGetDayRegistro.mockResolvedValue({
    ...dayVacio,
    meals: [{
      mealId: 1, noteId: 3, noteVersion: 0, noteText: 'dos huevos', items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 2, status: 'DE_MAS' }],
    }],
  })
  renderHoy()
  const fila = await screen.findByRole('button', { name: /Desayuno/, expanded: false })
  expect(fila).toHaveTextContent('De más: 1 porción de Proteínas')
  fireEvent.click(fila)
  expect(fila).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getAllByRole('textbox', { name: '¿Qué comiste?' }).some(t => (t as HTMLTextAreaElement).value === 'dos huevos')).toBe(true)
})

const planDosComidas = {
  foodGroups: [
    { id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
    { id: 2, name: 'Frutas', abbreviation: 'FRU', displayOrder: 2, color: null },
  ],
  meals: [
    { id: 1, name: 'Desayuno', displayOrder: 1, portions: [{ foodGroupId: 1, portions: 1 }] },
    { id: 2, name: 'Cena', displayOrder: 2, portions: [{ foodGroupId: 1, portions: 2 }, { foodGroupId: 2, portions: 1 }] },
  ],
}

test('el borrador de una comida del resto del día sobrevive al cerrar y reabrir la fila', async () => {
  mockGetMyPlan.mockResolvedValue(planDosComidas)
  renderHoy()
  const fila = await screen.findByRole('button', { name: /Desayuno/, expanded: false })
  fireEvent.click(fila)
  const editor = () => document.getElementById('comida-detalle-1')!.querySelector('textarea')!
  fireEvent.change(editor(), { target: { value: 'café con leche' } })
  fireEvent.click(fila)
  expect(document.getElementById('comida-detalle-1')).toBeNull()
  fireEvent.click(fila)
  expect(editor()).toHaveValue('café con leche')
})

test('un grupo por confirmar muestra la pregunta y el estado', async () => {
  mockGetMyPlan.mockResolvedValue(planDosComidas)
  mockGetDayRegistro.mockResolvedValue({
    ...dayVacio,
    meals: [{
      mealId: 1, noteId: 3, noteVersion: 0, noteText: 'tostadas', items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0, status: 'PREGUNTAR' }],
    }],
  })
  renderHoy()
  const fila = await screen.findByRole('button', { name: /Desayuno/, expanded: false })
  expect(fila).toHaveTextContent('Por confirmar')
  fireEvent.click(fila)
  expect(screen.getByText(/¿Consumiste/)).toHaveTextContent('¿Consumiste Proteínas?')
})

test('respeta el margen del plan: dentro del margen la comida es como el plan', async () => {
  mockGetMyPlan.mockResolvedValue(planDosComidas)
  mockGetDayRegistro.mockResolvedValue({
    ...dayVacio,
    meals: [{
      mealId: 1, noteId: 3, noteVersion: 0, noteText: 'medio huevo', items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0.5, status: 'EN_PLAN' }],
    }],
  })
  renderHoy()
  expect(await screen.findByRole('button', { name: /Desayuno/, expanded: false })).toHaveTextContent('Como el plan')
})

test('al guardar suma al día también los grupos que esa comida no tenía previstos', async () => {
  mockGetMyPlan.mockResolvedValue(planDosComidas)
  mockSaveNota.mockResolvedValue({
    noteId: 1, version: 0, text: 'pollo y una manzana', date: '2025-01-01', mealId: 2, items: [],
    entries: [
      { id: 8, food: 'pollo', quantity: 1, unit: 'u', foodGroupId: 1, portions: 2, origin: 'REGLA',
        uncertain: false, originalText: 'pollo', appliedRule: null, occurrenceId: null },
      { id: 9, food: 'manzana', quantity: 1, unit: 'u', foodGroupId: 2, portions: 1, origin: 'REGLA',
        uncertain: false, originalText: 'manzana', appliedRule: null, occurrenceId: null },
    ],
    comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded: 2, status: 'EN_PLAN' }],
  })
  renderHoy()
  const textarea = await screen.findByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(textarea, { target: { value: 'pollo y una manzana' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByText('3 de 4 porciones')).toBeInTheDocument()
  expect(screen.getAllByRole('img', { name: 'Frutas: 1 de 1 porciones' }).length).toBeGreaterThan(0)
})

const dayConNota = {
  ...dayVacio,
  meals: [{
    mealId: 1, noteId: 5, noteVersion: 3, noteText: 'leche y pan',
    items: [
      { id: 21, food: 'leche', quantity: 1, unit: 'taza', foodGroupId: 1, portions: 1, origin: 'REGLA',
        uncertain: false, originalText: 'leche', appliedRule: null, occurrenceId: 'occ-a' },
      { id: 22, food: 'pan', quantity: 1, unit: 'u', foodGroupId: 1, portions: 1, origin: 'REGLA',
        uncertain: false, originalText: 'pan', appliedRule: null, occurrenceId: 'occ-b' },
    ],
    comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded: 2, status: 'EN_PLAN' }],
  }],
  summary: [{ foodGroupId: 1, name: 'Proteínas', clave: 'PRO', totalRecorded: 2 }],
}

test('borrar lo anotado pide confirmación, vacía la comida y conserva la versión', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockResolvedValue(dayConNota)
  mockDeleteNota.mockResolvedValue(4)
  mockSaveNota.mockResolvedValue({
    noteId: 5, version: 5, text: 'leche y pan', date: '2025-01-01', mealId: 1, items: [],
    entries: dayConNota.meals[0].items, comparison: dayConNota.meals[0].comparison,
  })
  renderHoy()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de Desayuno' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Borrar lo anotado' }))
  const confirmar = screen.getByRole('button', { name: 'Borrar' })
  expect(confirmar).toHaveFocus()
  fireEvent.click(confirmar)
  await waitFor(() => expect(mockDeleteNota).toHaveBeenCalledWith('tok', expect.any(String), 1, 3))
  expect(await screen.findByRole('status')).toHaveTextContent('Borraste lo anotado en Desayuno.')
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('')
  expect(screen.getByText('0 de 2 porciones')).toBeInTheDocument()
  const textarea = screen.getByRole('textbox', { name: '¿Qué comiste?' })
  expect(textarea).toHaveFocus()
  fireEvent.change(textarea, { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await waitFor(() => expect(mockSaveNota).toHaveBeenCalledWith('tok', expect.any(String), 1, 'leche y pan', 4))
})

test('cancelar el borrado devuelve el foco al botón', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockResolvedValue(dayConNota)
  renderHoy()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de Desayuno' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Borrar lo anotado' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.getByRole('button', { name: 'Más opciones de Desayuno' })).toHaveFocus()
  expect(mockDeleteNota).not.toHaveBeenCalled()
})

test('si la nota cambió en otro dispositivo, no la borra y ofrece recargar', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockResolvedValue(dayConNota)
  mockDeleteNota.mockRejectedValue(new registroApi.NoteConflictError('Esta nota cambió en otro dispositivo. Recargá para ver la versión actual.'))
  renderHoy()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de Desayuno' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Borrar lo anotado' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta nota cambió en otro dispositivo')
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche y pan')
})

test('lo que se escribe mientras se borra no se pierde', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockResolvedValue(dayConNota)
  let resolver: (v: number) => void = () => {}
  mockDeleteNota.mockReturnValue(new Promise<number>(r => { resolver = r }))
  renderHoy()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de Desayuno' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Borrar lo anotado' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'una manzana' } })
  await act(async () => { resolver(4) })
  expect(await screen.findByRole('status')).toHaveTextContent('Borraste lo anotado en Desayuno.')
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('una manzana')
})

const removableItems = [
  { id: 101, food: 'leche', quantity: 1, unit: 'u', foodGroupId: 1, portions: 1, origin: 'REGLA', uncertain: false, occurrenceId: 'milk' },
  { id: 102, food: 'manzana', quantity: 1, unit: 'u', foodGroupId: null, portions: null, origin: 'MENTION', uncertain: false, occurrenceId: 'apple' },
]

function setupRemoval(items: registroApi.EntryItemDto[] = removableItems) {
  mockGetMyPlan.mockResolvedValue(planConComida)
  const meal = { mealId: 1, noteId: 3, noteVersion: 7, noteText: 'leche, manzana', items, comparison: [] }
  mockGetDayRegistro.mockResolvedValue({ ...dayVacio, meals: [meal] })
  return meal
}

test('quitar usa la versión, actualiza texto y lista, anuncia y enfoca el título', async () => {
  const meal = setupRemoval()
  vi.mocked(registroApi.removeItem).mockResolvedValue({ ...meal, noteVersion: 8, noteText: 'leche', items: [removableItems[0]] })
  renderHoy()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de manzana' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Quitar' }))
  await waitFor(() => expect(registroApi.removeItem).toHaveBeenCalledWith('tok', expect.any(String), 102, 7))
  expect(await screen.findByText('Quitaste manzana.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Quitar manzana' })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche')
  expect(screen.getByRole('heading', { name: 'Así lo entendí' })).toHaveFocus()
})

test('quitar con conflicto ofrece Recargar', async () => {
  setupRemoval()
  vi.mocked(registroApi.removeItem).mockRejectedValue(new registroApi.NoteConflictError('La nota cambió.'))
  renderHoy()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de manzana' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Quitar' }))
  expect(await screen.findByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(screen.getByText('La nota cambió.')).toBeInTheDocument()
})

test('un compuesto tiene un único botón de quitar en la cabecera', async () => {
  setupRemoval(removableItems.map((item, i) => ({ ...item, foodGroupId: i + 1, food: 'barrita', occurrenceId: 'compound' })))
  renderHoy()
  await abrirDetalle()
  const button = screen.getByRole('button', { name: 'Más opciones de barrita' })
  expect(button.closest('.nota-compuesto__header')).toBeInTheDocument()
  fireEvent.click(button)
  expect(screen.getAllByRole('menuitem', { name: 'Quitar' })).toHaveLength(1)
})

test('un compuesto resume cuatro grupos y despliega las correcciones por grupo', async () => {
  const names = ['Proteínas', 'Cereales', 'Verduras', 'Grasas']
  setupRemoval(names.map((_, i) => ({ ...removableItems[0], portions: 1, id: 201 + i, food: 'Chivito', foodGroupId: i + 1, occurrenceId: 'chivito' })))
  mockGetMyPlan.mockResolvedValue({ ...planConComida, foodGroups: names.map((name, i) => ({ id: i + 1, name, abbreviation: ['PRO', 'CER', 'VER', 'GRA'][i], displayOrder: i, color: null })) })
  renderHoy()
  await abrirDetalle()
  const button = await screen.findByRole('button', { name: 'Corregir grupos de Chivito', expanded: false })
  const section = screen.getByRole('region', { name: 'Así lo entendí' })
  expect(within(section).getAllByRole('listitem')).toHaveLength(1)
  expect(within(section).getAllByText('Chivito', { exact: false }).length).toBeGreaterThan(0)
  expect(screen.getByText('1 Proteínas · 1 Cereales · 1 Verduras · 1 Grasas')).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Grupos de Chivito' })).not.toBeInTheDocument()
  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  expect(within(screen.getByRole('list', { name: 'Grupos de Chivito' })).getAllByRole('listitem')).toHaveLength(4)
  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'false')
})

test.each([
  { names: ['Proteínas'], amounts: [1], expected: 'Faltó 1 porción de Proteínas' },
  { names: ['Proteínas', 'Cereales'], amounts: [1, 2], expected: 'Faltó 1 porción de Proteínas y 2 de Cereales' },
  { names: ['Proteínas', 'Cereales', 'Verduras'], amounts: [2, 1, 0.5], expected: 'Faltó 2 porciones de Proteínas, 1 de Cereales y 0,5 de Verduras' },
  { names: [''], amounts: [2], expected: 'Faltó 2 porciones de un grupo del plan' },
])('describe las faltas: $expected', async ({ names, amounts, expected }) => {
  mockGetMyPlan.mockResolvedValue(planDosComidas)
  mockGetDayRegistro.mockResolvedValue({ ...dayVacio, meals: [{ mealId: 1, noteId: 1, noteVersion: 0, noteText: 'comida', items: [], comparison: [
    ...names.map((name, i) => ({ foodGroupId: 9876 + i, name, expected: amounts[i], recorded: 0, status: 'CASI' })),
    { foodGroupId: 9999, name: 'Grasas', expected: 0, recorded: 1, status: 'DE_MAS' },
  ] }] })
  renderHoy()
  const row = await screen.findByRole('button', { name: /Desayuno/ })
  expect(row).toHaveTextContent(`${expected} · De más: 1 porción de Grasas`)
  expect(row).not.toHaveTextContent(/9876|9999/)
})

test('un ítem de un grupo sin nombre nunca muestra el identificador', async () => {
  setupRemoval([{ ...removableItems[0], portions: 1, foodGroupId: 987654 }])
  renderHoy()
  await abrirDetalle()
  expect(screen.getByText('Grupo del plan')).toBeInTheDocument()
  expect(document.body).not.toHaveTextContent('987654')
})

test('quitar la última mención enfoca el editor y conserva un borrador sucio', async () => {
  const meal = setupRemoval([removableItems[0]])
  vi.mocked(registroApi.removeItem).mockResolvedValue({ ...meal, noteVersion: 8, noteText: '', items: [] })
  renderHoy()
  await abrirDetalle()
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de leche' }))
  const button = screen.getByRole('menuitem', { name: 'Quitar' })
  const editor = screen.getByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(editor, { target: { value: 'Mi borrador' } })
  fireEvent.click(button)
  expect(await screen.findByText('Quitaste leche.')).toBeInTheDocument()
  expect(editor).toHaveValue('Mi borrador')
  expect(editor).toHaveFocus()
})

test('usa el color del grupo propio en sus migas', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planConComida, foodGroups: [
    { id: 1, name: 'Grupo propio', abbreviation: 'CUS', displayOrder: 1, color: '#368C91' },
  ] })
  const { container } = renderHoy()
  await screen.findAllByText('Grupo propio')
  await waitFor(() => expect(container.querySelector('path[stroke="var(--g-turq)"]')).toBeInTheDocument())
  expect(container.querySelector('path[stroke="var(--g-prot)"]')).not.toBeInTheDocument()
})

async function abrirDetalle() {
  fireEvent.click(await screen.findByRole('button', { name: /Revisar lo que/ }))
}

test('el detalle empieza cerrado, se abre y conserva la corrección al plegarlo', async () => {
  setupRemoval([{ ...removableItems[0], uncertain: true }])
  renderHoy()
  const toggle = await screen.findByRole('button', { name: 'Revisar lo que entendí · 1 estimados' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'Corregir leche' })).not.toBeInTheDocument()
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const correct = screen.getByRole('button', { name: 'Corregir leche' })
  expect(correct).toHaveTextContent('Corregir')
  fireEvent.click(correct)
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad de leche' }), { target: { value: '3' } })
  fireEvent.click(toggle)
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  fireEvent.click(toggle)
  expect(screen.getByRole('spinbutton', { name: 'Cantidad de leche' })).toHaveValue(3)
})

test('las preguntas y los alimentos sin grupo o sin reconocer se ven con el detalle cerrado', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockResolvedValue({ ...dayVacio, meals: [{
    mealId: 1, noteId: 1, noteVersion: 1, noteText: 'leche, manzana, algo raro',
    items: [...removableItems, { ...removableItems[1], id: 103, food: 'algo raro', origin: 'UNKNOWN' }],
    comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded: 1, status: 'PREGUNTAR' }],
  }] })
  renderHoy()
  expect(await screen.findByRole('button', { name: /Revisar lo que/ })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText(/¿Consumiste/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Sí' })).toBeVisible()
  expect(screen.getByText('manzana')).toBeVisible()
  expect(screen.getByText('algo raro')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Corregir leche' })).not.toBeInTheDocument()
})

test.each([
  { recorded: 1, difference: 'falta 1', label: 'Proteínas: 1 de 2, falta 1' },
  { recorded: 2, difference: '', label: 'Proteínas: 2 de 2' },
  { recorded: 3, difference: '1 de más', label: 'Proteínas: 3 de 2, 1 de más' },
  { recorded: 1.5, difference: 'falta 0,5', label: 'Proteínas: 1,5 de 2, falta 0,5' },
])('la comida muestra solo la diferencia: $label', async ({ recorded, difference, label }) => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockResolvedValue({ ...dayVacio, meals: [{
    mealId: 1, noteId: 1, noteVersion: 1, noteText: 'leche', items: [],
    comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded, status: 'EN_PLAN' }],
  }] })
  renderHoy()
  const meal = await screen.findByRole('article', { name: 'Desayuno' })
  const row = within(meal).getByRole('img', { name: label })
  expect(row.querySelector('.migas__count')).toHaveTextContent(difference)
  expect(row.querySelector('.migas__count')?.textContent).toBe(difference)
  expect(within(meal).queryByText(`${recorded} de 2`)).not.toBeInTheDocument()
})

test('el menú se abre, se cierra con Escape y devuelve el foco al botón', async () => {
  mockGetMyPlan.mockResolvedValue(planConComida)
  mockGetDayRegistro.mockResolvedValue(dayConNota)
  renderHoy()
  const trigger = await screen.findByRole('button', { name: 'Más opciones de Desayuno' })
  expect(trigger).toHaveTextContent('⋯')
  expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(trigger)
  const action = screen.getByRole('menuitem', { name: 'Borrar lo anotado' })
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(action).toHaveFocus()
  fireEvent.keyDown(action, { key: 'Escape' })
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(trigger).toHaveFocus()
})
