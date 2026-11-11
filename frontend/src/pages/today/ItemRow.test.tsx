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
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import { ItemRow } from './ItemRow'

test.each(['NO_CUENTA', 'LIBRE'])('Quitar en Corregir llama a onRemove para un item %s sin grupo', rule => {
  const onRemove = vi.fn()
  const item = { ...removableItems[0], foodGroupId: null, portions: null, appliedRule: `leche = ${rule}` }
  render(<ItemRow item={item} date="2025-01-01" token="tok" groupsMap={{}} onPatched={vi.fn()} onRemove={onRemove} />)

  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  const remove = screen.getByRole('button', { name: 'Quitar' })
  expect(remove.parentElement).toBe(screen.getByRole('button', { name: 'Repartir en varios grupos' }).parentElement)
  expect(screen.getByRole('button', { name: 'Listo' })).toBeVisible()
  fireEvent.click(remove)
  expect(onRemove).toHaveBeenCalledTimes(1)
})

test.each(['NO_CUENTA', 'LIBRE', 'FLEXIBLE'] as const)('un item %s sin grupo permite corregir, repartir y cerrar', async rule => {
  const item = { ...removableItems[0], foodGroupId: null, portions: null, appliedRule: `leche = ${rule}`, ruleType: rule }
  setupRemoval([item])
  vi.mocked(recordsApi.patchItem).mockResolvedValue({ status: 'REGISTRADA', replacedItemIds: [item.id], items: [item] })
  renderToday()
  await openDetails()

  expect(screen.queryByRole('button', { name: 'Quitar leche' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  expect(screen.getByRole('button', { name: 'Listo' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Menos porciones de leche' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: rule === 'FLEXIBLE' ? 'No es flexible' : 'Repartir en varios grupos' }))
  expect(screen.getByRole('group', { name: 'Repartir leche en grupos' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Listo' }))
  expect(await screen.findByRole('button', { name: 'Corregir leche' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Listo' })).not.toBeInTheDocument()
  expect(recordsApi.patchItem).not.toHaveBeenCalled()
  expect(recordsApi.removeItem).not.toHaveBeenCalled()
})

test.each([
  { touched: false, saveAsRule: false },
  { touched: true, saveAsRule: false },
  { touched: false, saveAsRule: true },
  { touched: true, saveAsRule: true },
])('Listo con grupo: %j', async ({ touched, saveAsRule }) => {
  setupRemoval([removableItems[0]])
  const mockPatchItem = vi.mocked(recordsApi.patchItem)
  mockPatchItem.mockResolvedValue({ status: 'REGISTRADA', replacedItemIds: [101], items: [removableItems[0]] })
  renderToday()
  await openDetails()
  for (const edit of [{ touched, saveAsRule }, { touched: false, saveAsRule: false }]) {
    const previousCalls = mockPatchItem.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
    if (edit.touched) fireEvent.click(screen.getByRole('button', { name: 'M\u00e1s porciones de leche' }))
    if (edit.saveAsRule) fireEvent.click(screen.getByRole('checkbox', { name: 'Usar siempre' }))
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }))
    await screen.findByRole('button', { name: 'Corregir leche' })
    expect(mockPatchItem).toHaveBeenCalledTimes(previousCalls + (edit.touched || edit.saveAsRule ? 1 : 0))
    if (edit.touched || edit.saveAsRule) {
      expect(mockPatchItem).toHaveBeenLastCalledWith('tok', expect.any(String), 101, {
        ...(edit.touched ? { portions: 1.5 } : {}), saveAsRule: edit.saveAsRule,
      })
    }
  }
})

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
  expect(screen.getAllByText(barRule).filter(node => !node.closest('[hidden]'))).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Corregir grupos de barrita' }))
  expect(screen.getByRole('list', { name: 'Grupos de barrita' }).querySelectorAll('li')).toHaveLength(3)
})

test('contar un compuesto como flexible quita todas sus filas y el encabezado', async () => {
  const compound = [barEntry(11, 1), barEntry(12, 2), barEntry(13, 3)]
  const otherOccurrence = { ...barEntry(14, 1), occurrenceId: 'occ-2' }
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, foodGroups: barGroups })
  mockGetDayRecord.mockResolvedValueOnce({
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, status: 'REGISTRADA', noteId: 1, noteVersion: 0,
      noteText: 'barrita, barrita', comparison: [], items: [...compound, otherOccurrence] }],
  }).mockImplementation(() => new Promise(() => {}))
  vi.mocked(recordsApi.patchItem).mockResolvedValue({
    status: 'FLEXIBLE', replacedItemIds: [11, 12, 13],
    items: [{ ...compound[1], foodGroupId: null, portions: null, ruleType: 'FLEXIBLE',
      origin: ItemOrigin.USER, appliedRule: 'barrita: cuenta como comida flexible' }],
  })
  renderToday()
  await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir grupos de barrita' }))
  const groupRows = screen.getByRole('list', { name: 'Grupos de barrita' })
  fireEvent.click(within(groupRows).getAllByRole('button', { name: 'Corregir barrita' })[1])
  fireEvent.click(screen.getByRole('button', { name: 'Contar como comida flexible' }))

  await waitFor(() => expect(screen.queryByRole('button', { name: 'Corregir grupos de barrita' })).not.toBeInTheDocument())
  expect(screen.queryByRole('list', { name: 'Grupos de barrita' })).not.toBeInTheDocument()
  const dialog = screen.getByRole('dialog', { name: 'Así lo entendí' })
  expect(dialog.querySelectorAll('.nota-compuesto')).toHaveLength(0)
  expect(dialog.querySelectorAll('.nota-item__food')).toHaveLength(2)
  expect(within(dialog).getByText('barrita: cuenta como comida flexible')).toBeVisible()
  expect(recordsApi.patchItem).toHaveBeenCalledWith('tok', expect.any(String), 12, { flexible: true, saveAsRule: false })
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
  fireEvent.click(screen.getByRole('checkbox', { name: 'Usar siempre' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  await waitFor(() => expect(mockPatchItem).toHaveBeenCalledWith('tok', expect.any(String), 21, {
    quantity: 1,
    grupos: [{ foodGroupId: 1, porciones: 1 }, { foodGroupId: 3, porciones: 1 }],
    saveAsRule: true,
  }))
})

test('el reparto conserva la cantidad original', async () => {
  setupRemoval([removableItems[0]])
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, foodGroups: barGroups })
  const mockPatchItem = vi.mocked(recordsApi.patchItem)
  mockPatchItem.mockResolvedValue({ status: 'REGISTRADA', replacedItemIds: [101], items: [] })
  renderToday()
  await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  fireEvent.click(screen.getByRole('button', { name: 'Repartir en varios grupos' }))
  fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '3' } })
  const save = screen.getByRole('button', { name: 'Guardar' })
  expect(save).toBeEnabled()
  fireEvent.click(save)
  await waitFor(() => expect(mockPatchItem).toHaveBeenCalledExactlyOnceWith('tok', expect.any(String), 101, {
    quantity: 1,
    grupos: [{ foodGroupId: 1, porciones: 1 }, { foodGroupId: 3, porciones: 1 }],
    saveAsRule: false,
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
  expect(screen.getAllByText(barRule).filter(node => !node.closest('[hidden]'))).toHaveLength(1)
})

test('Listo devuelve el foco a Corregir', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue({
    date: '2025-01-01', summary: [],
    meals: [{
      mealId: 1, status: 'REGISTRADA' as const, noteId: 1, noteText: 'leche', noteVersion: 1, comparison: [],
      items: [{ id: 31, food: 'leche', quantity: 1, unit: 'taza', foodGroupId: 1, portions: 1,
        origin: ItemOrigin.RULE, uncertain: false, appliedRule: null, occurrenceId: 'occ-31' }],
    }],
  })
  vi.mocked(recordsApi.patchItem).mockResolvedValue({ status: 'REGISTRADA', replacedItemIds: [], items: [] })
  renderToday()
  await screen.findByRole('heading', { name: 'Desayuno', level: 2 })

  if (screen.getByRole('button', { name: /^Así lo entendí/ }).getAttribute('aria-expanded') === 'false') await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  expect(screen.getByRole('button', { name: 'Menos porciones de leche' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Listo' }))

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
  expect(screen.getByText('1 porción de Proteínas · 1 porción de Cereales · 1 porción de Verduras · 1 porción de Grasas')).toBeInTheDocument()
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
  expect(screen.getByText(/de Grupo del plan/)).toBeInTheDocument()
  expect(document.body).not.toHaveTextContent('987654')
})


test('corregir muestra los editores secundarios solo al abrir sus enlaces', async () => {
  setupRemoval([removableItems[0]])
  renderToday()
  await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  expect(screen.getByRole('button', { name: 'Listo' })).toBeVisible()
  expect(screen.getByRole('checkbox', { name: 'Usar siempre' })).toBeVisible()
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: /Repartir leche/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cambiar la cantidad' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar cantidad' })).not.toBeInTheDocument()
  const split = screen.getByRole('button', { name: 'Repartir en varios grupos', expanded: false })
  fireEvent.click(split)
  expect(screen.getByRole('group', { name: /Repartir leche/ })).toBeVisible()
  fireEvent.click(split)
  expect(screen.queryByRole('group', { name: /Repartir leche/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
})


test('ANSWER conserva el mínimo de media porción', async () => {
  setupRemoval([{ ...removableItems[0], origin: ItemOrigin.ANSWER }])
  renderToday()
  await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  const minus = screen.getByRole('button', { name: 'Menos porciones de leche' })
  fireEvent.click(minus)
  expect(screen.getByLabelText('Porciones de leche')).toHaveTextContent('0,5')
  expect(minus).toBeDisabled()
  expect(recordsApi.removeItem).not.toHaveBeenCalled()
})

test.each([false, true])('cuenta un alimento reconocido como flexible, usar siempre %s', async remember => {
  const item = removableItems[0]
  const onPatched = vi.fn()
  const result = { status: 'FLEXIBLE' as const, replacedItemIds: [item.id], items: [{ ...item, ruleType: 'FLEXIBLE' as const, foodGroupId: null, portions: null }] }
  vi.mocked(recordsApi.patchItem).mockResolvedValue(result)
  render(<ItemRow item={item} date="2025-01-01" token="tok" groupsMap={{}} onPatched={onPatched} />)
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  if (remember) fireEvent.click(screen.getByRole('checkbox', { name: 'Usar siempre' }))
  const flexible = screen.getByRole('button', { name: 'Contar como comida flexible' })
  expect(flexible.parentElement).toBe(screen.getByRole('button', { name: 'Repartir en varios grupos' }).parentElement)
  fireEvent.click(flexible)
  await waitFor(() => expect(onPatched).toHaveBeenCalledWith(result))
  expect(recordsApi.patchItem).toHaveBeenLastCalledWith('tok', '2025-01-01', item.id, { flexible: true, saveAsRule: remember })
})

test('Usar siempre y Listo guarda como regla un ítem que ya es flexible', async () => {
  const item = { ...removableItems[0], origin: ItemOrigin.MENTION, ruleType: 'FLEXIBLE' as const, foodGroupId: null, portions: null }
  const onPatched = vi.fn()
  const result = { status: 'FLEXIBLE' as const, replacedItemIds: [item.id], items: [item] }
  let completeSave!: (value: typeof result) => void
  vi.mocked(recordsApi.patchItem).mockReturnValue(new Promise(resolve => { completeSave = resolve }))
  render(<ItemRow item={item} date="2025-01-01" token="tok" groupsMap={{}} onPatched={onPatched} />)

  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Usar siempre' }))
  fireEvent.click(screen.getByRole('button', { name: 'Listo' }))

  expect(recordsApi.patchItem).toHaveBeenCalledExactlyOnceWith('tok', '2025-01-01', item.id, {
    flexible: true, saveAsRule: true,
  })
  expect(screen.getByRole('button', { name: 'Listo' })).toBeDisabled()
  expect(onPatched).not.toHaveBeenCalled()
  completeSave(result)
  await waitFor(() => expect(onPatched).toHaveBeenCalledWith(result))
  expect(screen.queryByRole('button', { name: 'Listo' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Corregir leche' })).toBeVisible()
})

test.each([1, 0.5, 1.5])('No es flexible permite volver a un solo grupo con %s porciones', async portions => {
  const item = { ...removableItems[0], origin: ItemOrigin.MENTION, ruleType: 'FLEXIBLE' as const, foodGroupId: null, portions: null }
  const onPatched = vi.fn()
  vi.mocked(recordsApi.patchItem).mockResolvedValue({ status: 'REGISTRADA', replacedItemIds: [item.id], items: [] })
  render(<ItemRow item={item} date="2025-01-01" token="tok" groupsMap={{ 1: { name: 'Grupo', token: 'red' } }} onPatched={onPatched} />)
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  expect(screen.queryByRole('button', { name: 'Contar como comida flexible' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'No es flexible' }))
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  expect(screen.getByRole('spinbutton', { name: 'Porciones del grupo 1' })).toHaveValue(1)
  if (portions < 1) fireEvent.click(screen.getByRole('button', { name: 'Menos porciones del grupo 1' }))
  if (portions > 1) fireEvent.click(screen.getByRole('button', { name: 'Más porciones del grupo 1' }))
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await waitFor(() => expect(onPatched).toHaveBeenCalled())
  expect(recordsApi.patchItem).toHaveBeenLastCalledWith('tok', '2025-01-01', item.id, {
    foodGroupId: 1, portions, saveAsRule: false,
  })
})

test.each(['LIBRE', 'NO_CUENTA'] as const)('una mención %s permite contar como flexible', ruleType => {
  const item = { ...removableItems[0], origin: ItemOrigin.MENTION, ruleType, foodGroupId: null, portions: null }
  render(<ItemRow item={item} date="2025-01-01" token="tok" groupsMap={{}} onPatched={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Corregir leche' }))
  expect(screen.getByRole('button', { name: 'Contar como comida flexible' })).toBeEnabled()
})
