import {
  mockGetMyPlan,
  mockGetDayRecord,
  mockSaveNote,
  mockGetSuggestions,
  mockDeleteNote,
  planWithMeal,
  emptyDay,
  renderToday,
  openNote,
  twoMealPlan,
  dayWithNote,
  removableItems,
  setupRemoval,
  openDetails,
} from './test-utils'
import { act, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import * as recordsApi from '../../api/records'
test('un error al guardar una sugerencia conserva el borrador y permite reintentar', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetSuggestions.mockResolvedValue(['mate'])
  mockSaveNote.mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce({ status: 'REGISTRADA' as const, noteId: 1, version: 0,
    text: 'mate', date: emptyDay.date, mealId: 1, items: [], entries: [], comparison: [] })
  renderToday()
  await openNote()
  fireEvent.click(await screen.findByRole('button', { name: 'Anotar: mate' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar')
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('mate')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
  await screen.findByRole('button', { name: 'Guardar cambios' })
  expect(mockSaveNote).toHaveBeenCalledTimes(2)
})

test('dictado agrega texto al borrador sin guardarlo', async () => {
  let result!: (event: unknown) => void
  vi.stubGlobal('SpeechRecognition', class {
    set onresult(handler: (event: unknown) => void) { result = handler }
    start() {}
    abort() {}
  })
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  renderToday()
  await openNote()
  const draft = screen.getByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(draft, { target: { value: 'mate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Dictar', pressed: false }))
  act(() => result({ results: [[{ transcript: 'con pan' }]] }))
  expect(draft).toHaveValue('mate con pan')
  expect(mockSaveNote).not.toHaveBeenCalled()
})

test('el borrador sobrevive al cambiar de miga y volver', async () => {
  mockGetMyPlan.mockResolvedValue(twoMealPlan)
  renderToday()
  fireEvent.click(await screen.findByRole('button', { name: /Desayuno:/ }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'borrador' } })
  fireEvent.click(screen.getByRole('button', { name: /Cena:/ }))
  fireEvent.click(screen.getByRole('button', { name: /Desayuno:/ }))
  expect(screen.getByRole('textbox')).toHaveValue('borrador')
})

test('borrar lo anotado pide confirmación, vacía la comida y conserva la versión', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue(dayWithNote)
  mockDeleteNote.mockResolvedValue(4)
  mockSaveNote.mockResolvedValue({
    status: 'REGISTRADA' as const, noteId: 5, version: 5, text: 'leche y pan', date: '2025-01-01', mealId: 1, items: [],
    entries: dayWithNote.meals[0].items, comparison: dayWithNote.meals[0].comparison,
  })
  renderToday()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar lo anotado' }))
  const confirm = screen.getByRole('button', { name: 'Borrar' })
  expect(confirm).toHaveFocus()
  fireEvent.click(confirm)
  await waitFor(() => expect(mockDeleteNote).toHaveBeenCalledWith('tok', expect.any(String), 1, 3))
  expect(await screen.findByRole('status')).toHaveTextContent('Borraste lo anotado en Desayuno.')
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('')
  expect(screen.getByText('0 de 2 porciones')).toBeInTheDocument()
  const textarea = screen.getByRole('textbox', { name: '¿Qué comiste?' })
  expect(textarea).toHaveFocus()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'leche y pan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await waitFor(() => expect(mockSaveNote).toHaveBeenCalledWith('tok', expect.any(String), 1, 'leche y pan', 4))
})

test('cancelar el borrado devuelve el foco al botón', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue(dayWithNote)
  renderToday()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar lo anotado' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.getByRole('button', { name: 'Borrar lo anotado' })).toHaveFocus()
  expect(mockDeleteNote).not.toHaveBeenCalled()
})

test('lo que se escribe mientras se borra no se pierde', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue(dayWithNote)
  let resolve: (v: number) => void = () => {}
  mockDeleteNote.mockReturnValue(new Promise<number>(r => { resolve = r }))
  renderToday()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar lo anotado' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'una manzana' } })
  await act(async () => { resolve(4) })
  expect(await screen.findByRole('status')).toHaveTextContent('Borraste lo anotado en Desayuno.')
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('una manzana')
})

test('quitar la última mención enfoca el editor y conserva un borrador sucio', async () => {
  const meal = setupRemoval([removableItems[0]])
  vi.mocked(recordsApi.removeItem).mockResolvedValue({ ...meal, noteVersion: 8, noteText: '', items: [] })
  renderToday()
  await openNote()
  await openDetails()
  expect(screen.queryByRole('button', { name: 'Más opciones de leche' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  fireEvent.click(screen.getByRole('button', { name: 'Menos porciones de leche' }))
  fireEvent.click(screen.getByRole('button', { name: 'Menos porciones de leche' }))
  expect(screen.getByLabelText('Porciones de leche')).toHaveTextContent('0')
  expect(screen.queryByRole('checkbox', { name: 'Usar siempre' })).not.toBeInTheDocument()
  const button = screen.getByRole('button', { name: 'Listo' })
  const editor = screen.getByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(editor, { target: { value: 'Mi borrador' } })
  fireEvent.click(button)
  expect(await screen.findByText('Quitaste leche.')).toBeInTheDocument()
  expect(editor).toHaveValue('Mi borrador')
  expect(editor).toHaveFocus()
})

