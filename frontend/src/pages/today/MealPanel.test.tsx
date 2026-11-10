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
  expect(within(dialog).getByText('leche').tagName).toBe('STRONG')
  expect(within(dialog).getByText('leche').parentElement).toHaveClass('nota-item__contenido')
  expect(within(dialog).getByRole('link', { name: 'Ver todas las reglas en Mi plan' })).toHaveAttribute('href', '/mi-plan')
  expect(within(dialog).queryByRole('button', { name: 'Cómo lo calculé' })).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Corregir leche' }))
  const correction = within(dialog).getByRole('button', { name: 'Listo' }).closest('.fin')
  expect(correction?.parentElement).toHaveClass('nota-item__linea')
  const rememberLine = within(dialog).getByRole('checkbox', { name: 'Usar siempre' }).parentElement
  expect(rememberLine?.parentElement).toHaveClass('nota-item__secondary')
  expect(rememberLine?.nextElementSibling).toBe(within(dialog).getByRole('button', { name: 'Repartir en varios grupos' }))

  fireEvent.click(within(dialog).getByRole('button', { name: 'Menos porciones de leche' }))
  expect(within(dialog).getByRole('button', { name: 'Menos porciones de leche' })).toBeEnabled()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Más porciones de leche' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Más porciones de leche' }))
  if (remember) fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Usar siempre' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Listo' }))
  await waitFor(() => expect(recordsApi.patchItem).toHaveBeenCalledWith('tok', expect.any(String), 101, { portions: 1.5, saveAsRule: remember }))
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
