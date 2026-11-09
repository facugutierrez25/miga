import { renderToday, removableItems, setupRemoval, openDetails } from './test-utils'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import * as recordsApi from '../../api/records'
test('quitar usa la versión, actualiza texto y lista, anuncia y enfoca el título', async () => {
  const meal = setupRemoval()
  vi.mocked(recordsApi.removeItem).mockResolvedValue({ ...meal, noteVersion: 8, noteText: 'leche', items: [removableItems[0]] })
  renderToday()
  await openDetails()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de manzana' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Quitar' }))
  await waitFor(() => expect(recordsApi.removeItem).toHaveBeenCalledWith('tok', expect.any(String), 102, 7))
  expect(await screen.findByText('Quitaste manzana.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Quitar manzana' })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toHaveValue('leche')
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

