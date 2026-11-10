import {
  mockGetMyPlan,
  mockGetDayRecord,
  mockSaveNote,
  planWithMeal,
  renderToday,
  barGroups,
  barRule,
  barEntry,
  removableItems,
  setupRemoval,
  openDetails,
} from './test-utils'
import * as recordsApi from '../../api/records'
import { ItemOrigin } from '../../api/records'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
test('muestra un compuesto en una fila con su regla bajo el título Así lo entendí', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, foodGroups: barGroups })
  mockSaveNote.mockResolvedValue({
    status: 'REGISTRADA' as const, noteId: 1, version: 0, text: '1 barrita', date: '2025-01-01', mealId: 1, items: [], comparison: [],
    entries: [barEntry(11, 1), barEntry(12, 2), barEntry(13, 3)],
  })
  renderToday()
  await screen.findByRole('heading', { name: 'Desayuno', level: 2 })
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: '1 barrita' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByRole('button', { name: /^Así lo entendí/ })).toHaveAttribute('aria-haspopup', 'dialog')
  await openDetails()
  expect(screen.getByRole('dialog', { name: 'Así lo entendí' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de barrita' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cómo lo calculé' }))
  expect(screen.getAllByText(barRule)).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Corregir grupos de barrita' }))
  expect(screen.getByRole('list', { name: 'Grupos de barrita' }).querySelectorAll('li')).toHaveLength(3)
})

test('corregir permite repartir un ítem en varios grupos', async () => {
  const mockPatchItem = vi.mocked(recordsApi.patchItem)
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, foodGroups: barGroups })
  mockGetDayRecord.mockResolvedValue({
    date: '2025-01-01', summary: [],
    meals: [{
      mealId: 1, status: 'REGISTRADA' as const, noteId: 1, noteVersion: 0, noteText: 'leche', comparison: [],
      items: [{ id: 21, food: 'leche', quantity: 1, unit: 'taza', foodGroupId: 1, portions: 1,
        origin: ItemOrigin.RULE, uncertain: true, appliedRule: '1 leche = 1 Proteínas', occurrenceId: 'occ-2' }],
    }],
  })
  mockPatchItem.mockResolvedValue({ status: 'REGISTRADA' as const, replacedItemIds: [21], items: [] })
  renderToday()
  await screen.findByRole('heading', { name: 'Desayuno', level: 2 })

  await openDetails()
  expect(screen.getByText(/cantidad estimada/)).toBeInTheDocument()
  if (screen.getByRole('button', { name: /^Así lo entendí/ }).getAttribute('aria-expanded') === 'false') await openDetails()
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
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockSaveNote.mockResolvedValue({
    status: 'REGISTRADA' as const, noteId: 1, version: 0, text: 'mate', date: '2025-01-01', mealId: 1, comparison: [], entries: [{ id: 99, food: 'mate', quantity: 1, unit: 'u', foodGroupId: null, portions: null, origin: ItemOrigin.MENTION, uncertain: false, appliedRule: 'mate = libre (sin porcion asignada)', occurrenceId: 'mate-1' }],
    items: [{
      originalText: 'mate', foodName: 'mate', quantity: 1, unit: 'u', foodGroupId: null,
      standardGroupKey: null, portions: 0, appliedRule: 'mate = libre (sin porcion asignada)',
      uncertain: false, recognized: true, tipo: 'LIBRE',
    }],
  })
  renderToday()
  await screen.findByRole('heading', { name: 'Desayuno', level: 2 })
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'mate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  await openDetails()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de mate' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cómo lo calculé' }))
  expect(screen.getByText('mate = libre (sin porción asignada)')).toBeInTheDocument()
  expect(screen.queryByText('Sin grupo en tu plan')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Corregir mate' })).not.toBeInTheDocument()
})

test('no duplica las menciones que ya generaron ítems', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, foodGroups: barGroups })
  mockSaveNote.mockResolvedValue({
    status: 'REGISTRADA' as const, noteId: 1, version: 0, text: '1 barrita', date: '2025-01-01', mealId: 1, comparison: [],
    items: [{
      originalText: '1 barrita', foodName: 'barrita', quantity: 1, unit: 'u', foodGroupId: null,
      standardGroupKey: null, portions: 1, appliedRule: 'barrita (compuesto)',
      uncertain: false, recognized: true, tipo: 'COMPUESTO',
    }],
    entries: [barEntry(11, 1), barEntry(12, 2), barEntry(13, 3)],
  })
  renderToday()
  await screen.findByRole('heading', { name: 'Desayuno', level: 2 })
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: '1 barrita' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  await screen.findByRole('button', { name: /^Así lo entendí/ })
  expect(screen.queryByText('barrita (compuesto)')).not.toBeInTheDocument()
  await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de barrita' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cómo lo calculé' }))
  expect(screen.getAllByText(barRule)).toHaveLength(1)
})

test('corregir mueve el foco a la cantidad y cancelar lo devuelve al botón', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue({
    date: '2025-01-01', summary: [],
    meals: [{
      mealId: 1, status: 'REGISTRADA' as const, noteId: 1, noteText: 'leche', noteVersion: 1, comparison: [],
      items: [{ id: 31, food: 'leche', quantity: 1, unit: 'taza', foodGroupId: 1, portions: 1,
        origin: ItemOrigin.RULE, uncertain: false, appliedRule: null, occurrenceId: 'occ-31' }],
    }],
  })
  renderToday()
  await screen.findByRole('heading', { name: 'Desayuno', level: 2 })

  if (screen.getByRole('button', { name: /^Así lo entendí/ }).getAttribute('aria-expanded') === 'false') await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  expect(screen.getByRole('spinbutton', { name: 'Cantidad de leche' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

  await waitFor(() => expect(screen.getByRole('button', { name: 'Corregir leche' })).toHaveFocus())
})

test('un compuesto resume cuatro grupos y despliega las correcciones por grupo', async () => {
  const names = ['Proteínas', 'Cereales', 'Verduras', 'Grasas']
  setupRemoval(names.map((_, i) => ({ ...removableItems[0], portions: 1, id: 201 + i, food: 'Chivito', foodGroupId: i + 1, occurrenceId: 'chivito' })))
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, foodGroups: names.map((name, i) => ({ id: i + 1, name, abbreviation: ['PRO', 'CER', 'VER', 'GRA'][i], displayOrder: i, color: null })) })
  renderToday()
  await openDetails()
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

test('un ítem de un grupo sin nombre nunca muestra el identificador', async () => {
  setupRemoval([{ ...removableItems[0], portions: 1, foodGroupId: 987654 }])
  renderToday()
  await openDetails()
  expect(screen.getByText('Grupo del plan')).toBeInTheDocument()
  expect(document.body).not.toHaveTextContent('987654')
})

