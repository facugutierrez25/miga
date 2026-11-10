import { renderToday, removableItems, setupRemoval, openDetails } from './test-utils'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import * as recordsApi from '../../api/records'
test('quitar usa la versión, actualiza texto y lista, anuncia y enfoca el título', async () => {
  const meal = setupRemoval(removableItems.map(item => ({ ...item, origin: recordsApi.ItemOrigin.RULE, foodGroupId: 1, portions: 1 })))
  vi.mocked(recordsApi.removeItem).mockResolvedValue({ ...meal, noteVersion: 8, noteText: 'leche', items: [removableItems[0]] })
  renderToday()
  await openDetails()
  expect(screen.queryByRole('button', { name: 'Más opciones de manzana' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir manzana' }))
  fireEvent.click(screen.getByRole('button', { name: 'Menos porciones de manzana' }))
  fireEvent.click(screen.getByRole('button', { name: 'Menos porciones de manzana' }))
  expect(screen.getByLabelText('Porciones de manzana')).toHaveTextContent('0')
  expect(screen.queryByRole('checkbox', { name: 'Usar siempre' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Listo' }))
  await waitFor(() => expect(recordsApi.removeItem).toHaveBeenCalledWith('tok', expect.any(String), 102, 7))
  expect(await screen.findByText('Quitaste manzana.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Quitar manzana' })).not.toBeInTheDocument()
  expect(screen.getByText('leche', { selector: '.comida__texto' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Así lo entendí' })).toHaveFocus()
})

test('un compuesto tiene un único botón de quitar en la cabecera', async () => {
  setupRemoval(removableItems.map((item, i) => ({ ...item, foodGroupId: i + 1, food: 'barrita', occurrenceId: 'compound' })))
  renderToday()
  await openDetails()
  const button = screen.getByRole('button', { name: 'Más opciones de barrita' })
  expect(button.closest('.nota-compuesto__header')).toBeInTheDocument()
  fireEvent.click(button)
  expect(screen.getAllByRole('menuitem', { name: 'Quitar' })).toHaveLength(1)
})

test('una mención sin grupo se puede quitar desde el detalle', async () => {
  const manzana = { ...removableItems[1], origin: recordsApi.ItemOrigin.MENTION, foodGroupId: null, portions: null }
  const meal = setupRemoval([removableItems[0], manzana])
  vi.mocked(recordsApi.removeItem).mockResolvedValue({ ...meal, noteVersion: 8, noteText: 'leche', items: [removableItems[0]] })
  renderToday()
  await openDetails()
  expect(screen.queryByRole('button', { name: 'Corregir manzana' })).not.toBeInTheDocument()
  const remove = screen.getByRole('button', { name: 'Quitar manzana' })
  expect(remove).toHaveClass('nota-item__edit')
  expect(remove).toHaveTextContent('Quitar')
  fireEvent.click(remove)
  await waitFor(() => expect(recordsApi.removeItem).toHaveBeenCalledExactlyOnceWith('tok', expect.any(String), 102, 7))
  expect(await screen.findByText('Quitaste manzana.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Quitar manzana' })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Así lo entendí' })).toBeVisible()
})
