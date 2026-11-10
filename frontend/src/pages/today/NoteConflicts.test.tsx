import {
  mockGetMyPlan,
  mockGetDayRecord,
  mockSaveNote,
  mockDeleteNote,
  planWithMeal,
  emptyDay,
  renderToday,
  openNote,
  dayWithNote,
  setupRemoval,
  openDetails,
} from './test-utils'
import * as recordsApi from '../../api/records'
import { ItemOrigin } from '../../api/records'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
test('conserva el borrador ante conflicto, recarga la versión y usa la nueva al guardar', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const meal = { mealId: 1, status: 'REGISTRADA' as const, noteId: 5, noteVersion: 2, noteText: 'leche', items: [], comparison: [] }
  mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [meal] })
  renderToday()
  await openNote()
  await waitFor(() => expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche'))
  const textarea = screen.getByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'mi borrador' } })
  const message = 'Esta nota cambió en otro dispositivo. Recargá para ver la versión actual.'
  mockSaveNote.mockRejectedValueOnce(new recordsApi.NoteConflictError(message))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message))
  expect(textarea).toHaveValue('mi borrador')
  expect(mockSaveNote).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'mi borrador', 2)
  mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [{ ...meal, noteVersion: 3, noteText: 'otro dispositivo' }] })
  fireEvent.click(screen.getByRole('button', { name: 'Recargar' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(textarea).toHaveValue('mi borrador')
  mockSaveNote.mockResolvedValue({ status: 'REGISTRADA' as const, noteId: 5, version: 4, text: 'mi borrador', date: emptyDay.date,
    mealId: 1, items: [], entries: [], comparison: [] })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(mockSaveNote).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'mi borrador', 3))
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled())
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'segunda edición' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(mockSaveNote).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'segunda edición', 4))
})

test('un borrador empezado sobre una versión vieja sigue dando conflicto tras una recarga automática', async () => {
  const mockSaveAnswer = vi.mocked(recordsApi.saveAnswer)
  mockSaveAnswer.mockResolvedValue(undefined)
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const day = (noteVersion: number) => ({
    date: '2025-01-01', summary: [],
    meals: [{
      mealId: 1, status: 'PREGUNTAR' as const, noteId: 1, noteText: 'leche', noteVersion, items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0, status: 'PREGUNTAR' }],
    }],
  })
  mockGetDayRecord.mockResolvedValueOnce(day(2)).mockResolvedValue(day(3))
  mockSaveNote.mockResolvedValue({
    status: 'REGISTRADA' as const, noteId: 1, text: 'leche y pan', date: '2025-01-01', mealId: 1, version: 3,
    items: [], entries: [], comparison: [],
  })
  renderToday()
  await openNote()

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sí' }))
  await waitFor(() => expect(mockGetDayRecord).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  await waitFor(() => expect(mockSaveNote).toHaveBeenCalledWith('tok', expect.any(String), 1, 'leche y pan', 2))
})

test('recargar desde el conflicto adopta la versión actual aunque no haya cambiado', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const day = {
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, status: 'REGISTRADA' as const, noteId: 1, noteText: 'leche', noteVersion: 3, items: [], comparison: [] }],
  }
  mockGetDayRecord.mockResolvedValue(day)
  mockSaveNote
    .mockRejectedValueOnce(new recordsApi.NoteConflictError('Esta nota cambió en otro dispositivo.'))
    .mockResolvedValue({ status: 'REGISTRADA' as const, noteId: 1, text: 'leche y pan', date: '2025-01-01', mealId: 1, version: 4, items: [], entries: [], comparison: [] })
  renderToday()
  await openNote()

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  await waitFor(() => expect(mockSaveNote).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'leche y pan', 3))
  expect(await screen.findByText('leche y pan', { selector: '.comida__texto' })).toBeInTheDocument()
})

test('si recargar falla, la versión base no cambia', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord
    .mockResolvedValueOnce({
      date: '2025-01-01', summary: [],
      meals: [{ mealId: 1, status: 'REGISTRADA' as const, noteId: 1, noteText: 'leche', noteVersion: 2, items: [], comparison: [] }],
    })
    .mockRejectedValue(new Error('sin red'))
  mockSaveNote.mockRejectedValue(new recordsApi.NoteConflictError('Esta nota cambió en otro dispositivo.'))
  renderToday()
  await openNote()

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  expect(await screen.findByText('No se pudo recargar. Intentá de nuevo.')).toBeInTheDocument()

  expect(mockSaveNote).toHaveBeenCalledTimes(1)
  expect(mockSaveNote).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'leche y pan', 2)
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche y pan')
})

test('un reintento general del día no borra el borrador ni su versión base', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const day = (noteVersion: number) => ({
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, status: 'REGISTRADA' as const, noteId: 1, noteText: 'leche', noteVersion, items: [], comparison: [] }],
  })
  mockGetDayRecord
    .mockResolvedValueOnce(day(2))
    .mockRejectedValueOnce(new Error('sin red'))
    .mockResolvedValue(day(3))
  mockSaveNote.mockRejectedValue(new recordsApi.NoteConflictError('Esta nota cambió en otro dispositivo.'))
  renderToday()
  await openNote()

  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(mockGetDayRecord).toHaveBeenCalledTimes(3))

  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche y pan')
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(mockSaveNote).toHaveBeenLastCalledWith('tok', expect.any(String), 1, 'leche y pan', 2)
})

test('al recargar muestra menciones persistidas sin corrección ni porciones', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [{ mealId: 1, status: 'REGISTRADA' as const, noteId: 5, noteVersion: 2,
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
  mockGetDayRecord.mockResolvedValue(dayWithNote)
  mockDeleteNote.mockRejectedValue(new recordsApi.NoteConflictError('Esta nota cambió en otro dispositivo. Recargá para ver la versión actual.'))
  renderToday()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar lo anotado' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta nota cambió en otro dispositivo')
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche y pan')
})

test('quitar con conflicto ofrece Recargar', async () => {
  setupRemoval()
  vi.mocked(recordsApi.removeItem).mockRejectedValue(new recordsApi.NoteConflictError('La nota cambió.'))
  renderToday()
  await openDetails()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de manzana' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Quitar' }))
  expect(await screen.findByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(screen.getByText('La nota cambió.')).toBeInTheDocument()
})

