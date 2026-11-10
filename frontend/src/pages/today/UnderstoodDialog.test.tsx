import {
  mockGetMyPlan,
  mockGetDayRecord,
  mockSaveNote,
  planWithMeal,
  emptyDay,
  renderToday,
  openNote,
  dayWithNote,
  removableItems,
  setupRemoval,
  openDetails,
} from './test-utils'
import { ItemOrigin } from '../../api/records'
import { readFileSync } from 'node:fs'
import { screen, fireEvent, within } from '@testing-library/react'
import { test, expect } from 'vitest'
import { readableRule } from '../readableRule'
test('"Cómo lo calculé" abre un pop-up con la regla legible, también en Safari', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockSaveNote.mockResolvedValue({
    status: 'REGISTRADA' as const, noteId: 1, version: 0, text: 'mate', date: '2025-01-01', mealId: 1, comparison: [], entries: [{ id: 98, food: 'mate', quantity: 1, unit: 'u', foodGroupId: null, portions: null, origin: ItemOrigin.MENTION, uncertain: false, appliedRule: 'mate = libre (sin porcion asignada)', occurrenceId: 'mate-1' }],
    items: [{
      originalText: 'mate', foodName: 'mate', quantity: 1, unit: 'u', foodGroupId: null,
      standardGroupKey: null, portions: 0, appliedRule: 'mate = libre (sin porcion asignada)',
      uncertain: false, recognized: true, tipo: 'LIBRE',
    }],
  })
  renderToday()
  await openNote()
  fireEvent.change(screen.getByRole('textbox', { name: '¿Qué comiste?' }), { target: { value: 'mate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  await openDetails()
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de mate' }))
  const option = screen.getByRole('menuitem', { name: 'Cómo lo calculé' })
  // Safari no enfoca el botón tocado: el mousedown no debe mover el foco fuera del menú.
  expect(fireEvent.mouseDown(option)).toBe(false)
  fireEvent.click(option)
  const dialog = screen.getByRole('dialog', { name: 'Cómo lo calculé' })
  expect(dialog).toHaveTextContent('mate = libre (sin porción asignada)')
  expect(screen.getByRole('link', { name: 'Ajustar en Mi plan' })).toHaveAttribute('href', '/mi-plan')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Cómo lo calculé' })).not.toBeInTheDocument()
})

test('la regla se muestra con números y acentos legibles', () => {
  expect(readableRule('90.000 g de pollo = 1 porcion')).toBe('90 g de pollo = 1 porción')
  expect(readableRule('arroz = 0.500 porcion (supuesto)')).toBe('arroz = 0,5 porción (supuesto)')
  expect(readableRule('1 tostada = 1 panificado')).toBe('1 tostada = 1 panificado')
})

test('el popup empieza cerrado y conserva la corrección al cerrarlo y volver a abrirlo', async () => {
  setupRemoval([{ ...removableItems[0], uncertain: true }])
  renderToday()
  const toggle = await screen.findByRole('button', { name: 'Así lo entendí · 1 estimados' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'Corregir leche' })).not.toBeInTheDocument()
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const correct = screen.getByRole('button', { name: 'Corregir leche' })
  expect(correct).toHaveTextContent('Corregir')
  fireEvent.click(correct)
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad de leche' }), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar Así lo entendí' }))
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  fireEvent.click(toggle)
  expect(screen.getByRole('spinbutton', { name: 'Cantidad de leche' })).toHaveValue(3)
})

test('las preguntas quedan en Hoy y los alimentos sin grupo se muestran en el popup', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [{
    mealId: 1, status: 'PREGUNTAR' as const, noteId: 1, noteVersion: 1, noteText: 'leche, manzana, algo raro',
    items: [...removableItems, { ...removableItems[1], id: 103, food: 'algo raro', origin: ItemOrigin.UNKNOWN }],
    comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded: 1, status: 'PREGUNTAR' }],
  }] })
  renderToday()
  expect(await screen.findByRole('button', { name: /^Así lo entendí/ })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText(/¿Consumiste/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Sí' })).toBeVisible()
  expect(screen.getByText('manzana')).not.toBeVisible()
  expect(screen.getByText('«algo raro»')).not.toBeVisible()
  await openDetails()
  expect(screen.getByText('manzana')).toBeVisible()
  expect(screen.getByText('«algo raro»')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Corregir leche' })).toBeVisible()
})

test('el menú se abre, se cierra con Escape y devuelve el foco al botón', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue(dayWithNote)
  renderToday()
  const trigger = await screen.findByRole('button', { name: 'Más opciones de Desayuno' })
  expect(trigger).toHaveTextContent('⋯')
  expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(trigger)
  const action = screen.getByRole('menuitem', { name: 'Borrar lo anotado' })
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(action).toHaveFocus()
  fireEvent.keyDown(action, { key: 'Escape' })
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(trigger).toHaveFocus()
})

test('el detalle se envuelve sin recortes y conserva acciones de 44 px', () => {
  const css = readFileSync('src/pages/TodayPage.css', 'utf8')
  expect(css).not.toContain('text-overflow: ellipsis')
  expect(css).not.toContain('-webkit-line-clamp')
  expect(css).toContain('overflow-wrap: anywhere')
  expect(css).toMatch(/\.nota-item__edit,[\s\S]*min-width: 44px;[\s\S]*min-height: 44px/)
  expect(css).toMatch(/\.nota-menu__trigger, \.nota-revisar[\s\S]*min-width: 44px;[\s\S]*min-height: 44px/)
})

test('el popup contiene el foco, cierra con Escape y lo devuelve al botón', async () => {
  setupRemoval([removableItems[0]])
  renderToday()
  const trigger = await screen.findByRole('button', { name: /^Así lo entendí/ })
  expect(screen.queryByRole('dialog', { name: 'Así lo entendí' })).not.toBeInTheDocument()
  fireEvent.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Así lo entendí' })
  const close = within(dialog).getByRole('button', { name: 'Cerrar Así lo entendí' })
  expect(close).toHaveFocus()
  expect(document.body.style.overflow).toBe('hidden')
  const buttons = within(dialog).getAllByRole('button')
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
  expect(buttons[buttons.length - 1]).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Tab' })
  expect(close).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Así lo entendí' })).not.toBeInTheDocument()
  expect(document.body.style.overflow).not.toBe('hidden')
  expect(trigger).toHaveFocus()
})

test('Escape cierra solo la regla superpuesta y mantiene abierto Así lo entendí', async () => {
  setupRemoval([{ ...removableItems[0], appliedRule: '1 u de leche = 1 porcion' }])
  renderToday()
  await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Cómo lo calculé' }))
  expect(screen.getByRole('dialog', { name: 'Cómo lo calculé' })).toBeInTheDocument()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Cómo lo calculé' })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Así lo entendí' })).toBeInTheDocument()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Así lo entendí' })).not.toBeInTheDocument()
})

test('el popup cierra al tocar el fondo pero no al tocar su contenido', async () => {
  setupRemoval([removableItems[0]])
  renderToday()
  await openDetails()
  const dialog = screen.getByRole('dialog', { name: 'Así lo entendí' })
  fireEvent.click(within(dialog).getByText('leche', { exact: true }))
  expect(dialog).toBeVisible()
  fireEvent.click(dialog.parentElement!)
  expect(dialog).not.toBeVisible()
})

