import {
  mockGetMyPlan,
  mockGetDayRegistro,
  mockSaveNota,
  mockDeleteNota,
  planWithMeal,
  emptyDay,
  renderToday,
  openNote,
  dayWithNote,
  setupRemoval,
  openDetails,
} from './test-utils'
import * as registroApi from '../../api/registro'
import { ItemOrigin } from '../../api/registro'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
test('conserva el borrador ante conflicto, recarga la versión y usa la nueva al guardar', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const meal = { mealId: 1, noteId: 5, noteVersion: 2, noteText: 'leche', items: [], comparison: [] }
  mockGetDayRegistro.mockResolvedValue({ ...emptyDay, meals: [meal] })
  renderToday()
  await waitFor(() => expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche'))
  const textarea = screen.getByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(textarea, { target: { value: 'mi borrador' } })
  const message = 'Esta nota cambió en otro dispositivo. Recargá para ver la versión actual.'
  mockSaveNota.mockRejectedValueOnce(new registroApi.NoteConflictError(message))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message))
  expect(textarea).toHaveValue('mi borrador')
  expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'mi borrador', 2)
  mockGetDayRegistro.mockResolvedValue({ ...emptyDay, meals: [{ ...meal, noteVersion: 3, noteText: 'otro dispositivo' }] })
  fireEvent.click(screen.getByRole('button', { name: 'Recargar' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(textarea).toHaveValue('mi borrador')
  mockSaveNota.mockResolvedValue({ noteId: 5, version: 4, text: 'mi borrador', date: emptyDay.date,
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
  mockGetMyPlan.mockResolvedValue(planWithMeal)
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
  renderToday()
  await openNote()

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sí' }))
  await waitFor(() => expect(mockGetDayRegistro).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  await waitFor(() => expect(mockSaveNota).toHaveBeenCalledWith('tok', expect.any(String), 1, 'leche y pan', 2))
})

test('recargar desde el conflicto adopta la versión actual aunque no haya cambiado', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const dia = {
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, noteId: 1, noteText: 'leche', noteVersion: 3, items: [], comparison: [] }],
  }
  mockGetDayRegistro.mockResolvedValue(dia)
  mockSaveNota
    .mockRejectedValueOnce(new registroApi.NoteConflictError('Esta nota cambió en otro dispositivo.'))
    .mockResolvedValue({ noteId: 1, text: 'leche y pan', date: '2025-01-01', mealId: 1, version: 4, items: [], entries: [], comparison: [] })
  renderToday()
  await openNote()

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  await waitFor(() => expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'leche y pan', 3))
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche y pan')
})

test('si recargar falla, la versión base no cambia', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRegistro
    .mockResolvedValueOnce({
      date: '2025-01-01', summary: [],
      meals: [{ mealId: 1, noteId: 1, noteText: 'leche', noteVersion: 2, items: [], comparison: [] }],
    })
    .mockRejectedValue(new Error('sin red'))
  mockSaveNota.mockRejectedValue(new registroApi.NoteConflictError('Esta nota cambió en otro dispositivo.'))
  renderToday()
  await openNote()

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  expect(await screen.findByText('No se pudo recargar. Intentá de nuevo.')).toBeInTheDocument()

  expect(mockSaveNota).toHaveBeenCalledTimes(1)
  expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'leche y pan', 2)
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche y pan')
})

test('un reintento general del día no borra el borrador ni su versión base', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const dia = (noteVersion: number) => ({
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, noteId: 1, noteText: 'leche', noteVersion, items: [], comparison: [] }],
  })
  mockGetDayRegistro
    .mockResolvedValueOnce(dia(2))
    .mockRejectedValueOnce(new Error('sin red'))
    .mockResolvedValue(dia(3))
  mockSaveNota.mockRejectedValue(new registroApi.NoteConflictError('Esta nota cambió en otro dispositivo.'))
  renderToday()
  await openNote()

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(mockGetDayRegistro).toHaveBeenCalledTimes(3))

  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche y pan')
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(mockSaveNota).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'leche y pan', 2)
})

test('al recargar muestra menciones persistidas sin corrección ni porciones', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRegistro.mockResolvedValue({ ...emptyDay, meals: [{ mealId: 1, noteId: 5, noteVersion: 2,
    noteText: 'mate, algo raro', comparison: [], items: [
      { id: 51, food: 'mate', quantity: 1, unit: 'u', foodGroupId: null, portions: null, origin: ItemOrigin.MENTION, uncertain: false, appliedRule: 'libre' },
      { id: 52, food: 'algo raro', quantity: 1, unit: 'u', foodGroupId: null, portions: null, origin: ItemOrigin.UNKNOWN, uncertain: false },
    ] }] })
  renderToday()
  await openNote()
  expect(screen.getByText('mate')).toBeInTheDocument()
  expect(screen.getByText('«algo raro»')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Corregir/ })).not.toBeInTheDocument()
})

test('si la nota cambió en otro dispositivo, no la borra y ofrece recargar', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRegistro.mockResolvedValue(dayWithNote)
  mockDeleteNota.mockRejectedValue(new registroApi.NoteConflictError('Esta nota cambió en otro dispositivo. Recargá para ver la versión actual.'))
  renderToday()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de Desayuno' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Borrar lo anotado' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta nota cambió en otro dispositivo')
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche y pan')
})

test('quitar con conflicto ofrece Recargar', async () => {
  setupRemoval()
  vi.mocked(registroApi.removeItem).mockRejectedValue(new registroApi.NoteConflictError('La nota cambió.'))
  renderToday()
  await openDetails()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de manzana' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Quitar' }))
  expect(await screen.findByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(screen.getByText('La nota cambió.')).toBeInTheDocument()
})

