import {
  mockGetMyPlan,
  mockGetDayRecord,
  mockSaveNote,
  mockGetSuggestions,
  planWithMeal,
  emptyDay,
  renderToday,
  openNote,
  twoMealPlan,
} from './test-utils'
import * as recordsApi from '../../api/records'
import { ItemOrigin } from '../../api/records'
import { act, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
test('muestra nota guardada si el día tiene texto', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue({
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
  renderToday()
  await waitFor(() => expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche con pan'))
})

test('el botón guardar envía la nota al backend', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockSaveNote.mockResolvedValue({
    noteId: 1, version: 0,
    text: 'leche',
    date: '2025-01-01',
    mealId: 1,
    items: [],
    entries: [],
    comparison: [],
  })
  renderToday()
  await waitFor(() => expect(screen.getByText('Desayuno')).toBeInTheDocument())

  await waitFor(() => expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toBeInTheDocument())
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await waitFor(() => expect(mockSaveNote).toHaveBeenCalledWith('tok', expect.any(String), 1, 'leche', null))
})

test('lo de siempre guarda en un toque, bloquea doble envío y permite editar después', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, createdAt: '2026-10-03' })
  mockGetSuggestions.mockResolvedValue(['leche con pan'])
  let finish!: (value: recordsApi.NoteInterpretationDto) => void
  mockSaveNote.mockReturnValue(new Promise(resolve => { finish = resolve }))
  renderToday()
  await openNote()
  expect(screen.queryByText(/Según tu plan/)).not.toBeInTheDocument()
  const suggestion = await screen.findByRole('button', { name: 'Anotar: leche con pan' })
  expect(screen.getByRole('heading', { name: 'Lo de siempre' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' }).compareDocumentPosition(suggestion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(suggestion.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  fireEvent.click(suggestion)
  fireEvent.click(suggestion)
  expect(suggestion).toBeDisabled()
  expect(mockSaveNote).toHaveBeenCalledTimes(1)
  expect(mockSaveNote).toHaveBeenCalledWith('tok', expect.any(String), 1, 'leche con pan', null)
  finish({ noteId: 1, version: 1, text: 'leche con pan', date: emptyDay.date, mealId: 1, items: [], entries: [], comparison: [] })
  await screen.findByRole('button', { name: 'Guardar cambios' })
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'otra nota' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(mockSaveNote).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'otra nota', 1)
})

test('lo dictado mientras se guarda no se pierde al terminar el guardado', async () => {
  let result!: (event: unknown) => void
  vi.stubGlobal('SpeechRecognition', class {
    set onresult(handler: (event: unknown) => void) { result = handler }
    start() {}
    abort() {}
  })
  let finishSaving!: (value: unknown) => void
  mockSaveNote.mockReturnValue(new Promise(resolve => { finishSaving = resolve }) as never)
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  renderToday()
  await openNote()
  const draft = screen.getByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(draft, { target: { value: 'mate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Dictar', pressed: false }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  act(() => result({ results: [[{ transcript: 'con pan' }]] }))
  await act(async () => {
    finishSaving({ noteId: 1, text: 'mate', date: '2025-01-01', mealId: 1, version: 1, items: [], entries: [], comparison: [] })
  })

  await waitFor(() => expect(draft).toHaveValue('mate con pan'))
})

test('si falla una respuesta a la pregunta, se muestra el error', async () => {
  vi.mocked(recordsApi.saveAnswer).mockRejectedValue(new Error('sin red'))
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue({
    date: '2025-01-01', summary: [],
    meals: [{
      mealId: 1, noteId: 1, noteText: 'leche', noteVersion: 1, items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0, status: 'PREGUNTAR' }],
    }],
  })
  renderToday()
  await openNote()

  fireEvent.click(screen.getByRole('button', { name: 'Sí' }))

  expect(await screen.findByText('No se pudo guardar la respuesta. Intentá de nuevo.')).toBeInTheDocument()
})

test('al guardar dice qué faltó y suma lo anotado al día', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockSaveNote.mockResolvedValue({
    noteId: 1, version: 0, text: 'un huevo', date: '2025-01-01', mealId: 1, items: [],
    entries: [{ id: 7, food: 'huevo', quantity: 1, unit: 'u', foodGroupId: 1, portions: 1, origin: ItemOrigin.RULE,
      uncertain: false, originalText: 'un huevo', appliedRule: null, occurrenceId: null }],
    comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded: 1, status: 'CASI' }],
  })
  renderToday()
  const textarea = await screen.findByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(textarea, { target: { value: 'un huevo' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Guardado. Faltó 1 porción de Proteínas.')
  expect(screen.getByText('1 de 2 porciones')).toBeInTheDocument()
  expect(screen.getAllByRole('img', { name: 'Proteínas: 1 de 2 porciones' }).length).toBeGreaterThan(0)
})

test('un grupo por confirmar muestra la pregunta y el estado', async () => {
  mockGetMyPlan.mockResolvedValue(twoMealPlan)
  mockGetDayRecord.mockResolvedValue({
    ...emptyDay,
    meals: [{
      mealId: 1, noteId: 3, noteVersion: 0, noteText: 'tostadas', items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0, status: 'PREGUNTAR' }],
    }],
  })
  renderToday()
  const renderRow = await screen.findByRole('button', { name: /Desayuno/, expanded: false })
  expect(renderRow).toHaveTextContent('Por confirmar')
  fireEvent.click(renderRow)
  expect(screen.getByText(/¿Consumiste/)).toHaveTextContent('¿Consumiste Proteínas?')
})

test('al guardar suma al día también los grupos que esa comida no tenía previstos', async () => {
  mockGetMyPlan.mockResolvedValue(twoMealPlan)
  mockSaveNote.mockResolvedValue({
    noteId: 1, version: 0, text: 'pollo y una manzana', date: '2025-01-01', mealId: 2, items: [],
    entries: [
      { id: 8, food: 'pollo', quantity: 1, unit: 'u', foodGroupId: 1, portions: 2, origin: ItemOrigin.RULE,
        uncertain: false, originalText: 'pollo', appliedRule: null, occurrenceId: null },
      { id: 9, food: 'manzana', quantity: 1, unit: 'u', foodGroupId: 2, portions: 1, origin: ItemOrigin.RULE,
        uncertain: false, originalText: 'manzana', appliedRule: null, occurrenceId: null },
    ],
    comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded: 2, status: 'EN_PLAN' }],
  })
  renderToday()
  const textarea = await screen.findByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(textarea, { target: { value: 'pollo y una manzana' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByText('3 de 4 porciones')).toBeInTheDocument()
  expect(screen.getAllByRole('img', { name: 'Frutas: 1 de 1 porciones' }).length).toBeGreaterThan(0)
})

test('una respuesta guardada no se reporta como error si falla la recarga del día', async () => {
  vi.mocked(recordsApi.saveAnswer).mockResolvedValue(undefined)
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const day = {
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, noteId: 1, noteText: 'leche', noteVersion: 1, items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0, status: 'PREGUNTAR' }] }],
  }
  mockGetDayRecord.mockResolvedValue(day)
  renderToday()
  await openNote()
  mockGetDayRecord.mockRejectedValue(new Error('offline'))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sí' })) })
  expect(screen.queryByRole('button', { name: 'Sí' })).not.toBeInTheDocument()
  expect(screen.queryByText(/No se pudo guardar la respuesta/)).not.toBeInTheDocument()
})

