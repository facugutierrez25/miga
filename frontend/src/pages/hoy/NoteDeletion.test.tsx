import {
  mockGetMyPlan,
  mockGetDayRegistro,
  mockSaveNota,
  mockGetSugerencias,
  mockDeleteNota,
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
import * as registroApi from '../../api/registro'
test('un error al guardar una sugerencia conserva el borrador y permite reintentar', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetSugerencias.mockResolvedValue(['mate'])
  mockSaveNota.mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce({ noteId: 1, version: 0,
    text: 'mate', date: emptyDay.date, mealId: 1, items: [], entries: [], comparison: [] })
  renderToday()
  await openNote()
  fireEvent.click(await screen.findByRole('button', { name: 'Anotar: mate' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar')
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('mate')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await screen.findByRole('button', { name: 'Guardar cambios' })
  expect(mockSaveNota).toHaveBeenCalledTimes(2)
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
  expect(mockSaveNota).not.toHaveBeenCalled()
})

test('el borrador de una comida del resto del día sobrevive al cerrar y reabrir la fila', async () => {
  mockGetMyPlan.mockResolvedValue(twoMealPlan)
  renderToday()
  const renderRow = await screen.findByRole('button', { name: /Desayuno/, expanded: false })
  fireEvent.click(renderRow)
  const editor = () => document.getElementById('comida-detalle-1')!.querySelector('textarea')!
  fireEvent.change(editor(), { target: { value: 'café con leche' } })
  fireEvent.click(renderRow)
  expect(document.getElementById('comida-detalle-1')).toBeNull()
  fireEvent.click(renderRow)
  expect(editor()).toHaveValue('café con leche')
})

test('borrar lo anotado pide confirmación, vacía la comida y conserva la versión', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRegistro.mockResolvedValue(dayWithNote)
  mockDeleteNota.mockResolvedValue(4)
  mockSaveNota.mockResolvedValue({
    noteId: 5, version: 5, text: 'leche y pan', date: '2025-01-01', mealId: 1, items: [],
    entries: dayWithNote.meals[0].items, comparison: dayWithNote.meals[0].comparison,
  })
  renderToday()
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
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRegistro.mockResolvedValue(dayWithNote)
  renderToday()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de Desayuno' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Borrar lo anotado' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.getByRole('button', { name: 'Más opciones de Desayuno' })).toHaveFocus()
  expect(mockDeleteNota).not.toHaveBeenCalled()
})

test('lo que se escribe mientras se borra no se pierde', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRegistro.mockResolvedValue(dayWithNote)
  let resolver: (v: number) => void = () => {}
  mockDeleteNota.mockReturnValue(new Promise<number>(r => { resolver = r }))
  renderToday()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de Desayuno' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Borrar lo anotado' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'una manzana' } })
  await act(async () => { resolver(4) })
  expect(await screen.findByRole('status')).toHaveTextContent('Borraste lo anotado en Desayuno.')
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('una manzana')
})

test('quitar la última mención enfoca el editor y conserva un borrador sucio', async () => {
  const meal = setupRemoval([removableItems[0]])
  vi.mocked(registroApi.removeItem).mockResolvedValue({ ...meal, noteVersion: 8, noteText: '', items: [] })
  renderToday()
  await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de leche' }))
  const button = screen.getByRole('menuitem', { name: 'Quitar' })
  const editor = screen.getByRole('textbox', { name: '¿Qué comiste?' })
  fireEvent.change(editor, { target: { value: 'Mi borrador' } })
  fireEvent.click(button)
  expect(await screen.findByText('Quitaste leche.')).toBeInTheDocument()
  expect(editor).toHaveValue('Mi borrador')
  expect(editor).toHaveFocus()
})

