import { renderToday, setupRemoval, removableItems, unknownFood, openDetails, mockGetDayRecord, mockGetMyPlan, planWithMeal, emptyDay } from './test-utils'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import * as recordsApi from '../../api/records'

test('abre directamente cada alimento sin reconocer y permite dejarlo para la nutri', async () => {
  setupRemoval([unknownFood, { ...unknownFood, id: 503, food: 'otro alimento', originalText: 'otro alimento' }])
  renderToday()
  const buttons = await screen.findAllByRole('button', { name: 'Decime qué es' })
  expect(buttons).toHaveLength(2)
  fireEvent.click(buttons[1])
  const dialog = screen.getByRole('dialog', { name: '¿Qué es «otro alimento»?' })
  expect(within(dialog).getByRole('checkbox', { name: 'Reconocerlo siempre que lo escriba' })).toBeChecked()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Dejarlo así para mi nutri' }))
  expect(screen.getByRole('dialog', { name: 'Así lo entendí' })).toBeVisible()
  expect(recordsApi.resolveItem).not.toHaveBeenCalled()
})

test.each([false, true])('corrige por medias porciones para esta comida; usar siempre: %s', async remember => {
  setupRemoval([{ ...removableItems[0], quantity: 2, uncertain: true, appliedRule: '2 u de leche = 1 porcion' }])
  vi.mocked(recordsApi.patchItem).mockResolvedValue({ status: 'EN_PLAN', replacedItemIds: [101], items: [] })
  renderToday()
  await openDetails()
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent('1 porción de Proteínas')
  expect(dialog).toHaveTextContent('2 u de leche = 1 porción')
  expect(dialog).toHaveTextContent('cantidad estimada')
  expect(within(dialog).getByText('leche').closest('li')?.querySelector('.nota-item__dot')?.getAttribute('style')).toContain('background: var(--g-prot)')
  expect(within(dialog).getByText('2 unidades')).toBeVisible()
  expect(within(dialog).getByRole('link', { name: 'Ver todas las reglas en Mi plan' })).toHaveAttribute('href', '/mi-plan')
  expect(within(dialog).queryByRole('button', { name: 'Cómo lo calculé' })).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Corregir leche' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Menos porciones de leche' }))
  expect(within(dialog).getByRole('button', { name: 'Menos porciones de leche' })).toBeDisabled()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Más porciones de leche' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Más porciones de leche' }))
  if (remember) fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Usar siempre' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Listo' }))
  await waitFor(() => expect(recordsApi.patchItem).toHaveBeenCalledWith('tok', expect.any(String), 101, { portions: 1.5, saveAsRule: remember }))
})

test('la corrección de cantidad conserva el cálculo de porciones de la API', async () => {
  setupRemoval([removableItems[0]])
  vi.mocked(recordsApi.patchItem).mockResolvedValue({ status: 'EN_PLAN', replacedItemIds: [101], items: [] })
  renderToday()
  await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad de leche' }), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cantidad' }))
  await waitFor(() => expect(recordsApi.patchItem).toHaveBeenCalledWith('tok', expect.any(String), 101, { quantity: 3, unit: 'u', saveAsRule: false }))
})

test.each(['Sí', 'No'])('responder %s quita la pregunta y actualiza el estado del panel', async answer => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const meal = { mealId: 1, status: 'PREGUNTAR' as const, noteId: 1, noteVersion: 1, noteText: 'leche', items: [], comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0, status: 'PREGUNTAR' }] }
  mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [meal] })
  vi.mocked(recordsApi.saveAnswer).mockResolvedValue(undefined)
  renderToday()
  const button = await screen.findByRole('button', { name: answer })
  mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [{ ...meal, status: 'EN_PLAN', comparison: [] }] })
  fireEvent.click(button)
  await waitFor(() => expect(mockGetDayRecord).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('button', { name: answer })).not.toBeInTheDocument()
  expect(screen.getAllByText('Como el plan').length).toBeGreaterThan(0)
})
