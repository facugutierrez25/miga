import {
  mockGetMyPlan,
  mockGetDayRecord,
  planWithMeal,
  emptyDay,
  renderToday,
  dayWithNote,
  removableItems,
  setupRemoval,
  openDetails,
} from './test-utils'
import { ItemOrigin } from '../../api/records'
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { readableRule } from '../readableRule'
import { useRef, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { UnderstoodSheet } from './UnderstoodSheet'

test('una hoja posterior cerrada no bloquea Tab ni Escape de la primera comida', () => {
  function Meals() {
    const [firstOpen, setFirstOpen] = useState(false)
    const [secondOpen, setSecondOpen] = useState(true)
    const firstHeading = useRef<HTMLHeadingElement>(null)
    const secondHeading = useRef<HTMLHeadingElement>(null)
    const props = { items: removableItems, token: 'tok', date: '2025-01-01', groups: {}, selected: null, onSelect: vi.fn(), onPatched: vi.fn() }
    return <>
      <button onClick={event => { event.currentTarget.focus(); setFirstOpen(true) }}>Abrir Desayuno</button>
      <UnderstoodSheet {...props} mealId={1} headingRef={firstHeading} open={firstOpen} onClose={() => setFirstOpen(false)}>Nota del desayuno</UnderstoodSheet>
      <UnderstoodSheet {...props} mealId={2} headingRef={secondHeading} open={secondOpen} onClose={() => setSecondOpen(false)}>Nota del almuerzo</UnderstoodSheet>
    </>
  }
  render(<MemoryRouter><Meals /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Desayuno' }))
  expect(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).toHaveLength(2)
  const dialog = screen.getByRole('dialog', { name: 'Así lo entendí' })
  expect(dialog).toHaveTextContent('Nota del desayuno')
  const close = within(dialog).getByRole('button', { name: 'Cerrar' })
  expect(close).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
  expect(within(dialog).getByRole('link')).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Tab' })
  expect(close).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Abrir Desayuno' })).toHaveFocus()
})
test('la regla se muestra con números y acentos legibles', () => {
  expect(readableRule('90.000 g de pollo = 1 porcion')).toBe('90 g de pollo = 1 porción')
  expect(readableRule('arroz = 0.500 porcion (supuesto)')).toBe('arroz = 0,5 porción (supuesto)')
  expect(readableRule('1 tostada = 1 panificado')).toBe('1 tostada = 1 panificado')
})

test('el popup empieza cerrado y conserva la corrección al cerrarlo y volver a abrirlo', async () => {
  setupRemoval([{ ...removableItems[0], countsFlexible: false, uncertain: true }])
  renderToday()
  const toggle = await screen.findByRole('button', { name: 'Así lo entendí' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'Corregir leche' })).not.toBeInTheDocument()
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const correct = screen.getByRole('button', { name: 'Corregir leche' })
  expect(correct).toHaveTextContent('Corregir')
  fireEvent.click(correct)
  expect(screen.getByRole('button', { name: 'Listo' })).toBeVisible()
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cambiar la cantidad' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Repartir en varios grupos' })).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'Más porciones de leche' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  fireEvent.click(toggle)
  expect(screen.getByLabelText('Porciones de leche')).toHaveTextContent('1,5')
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
  expect(screen.getByText(/¿Comiste/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Sí' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Más opciones de manzana' })).not.toBeInTheDocument()
  expect(screen.getAllByText('«algo raro»')[0]).toBeVisible()
  await openDetails()
  expect(screen.getByText('manzana')).toBeVisible()
  expect(screen.getAllByText('«algo raro»')[0]).toBeVisible()
  expect(screen.getByRole('button', { name: 'Corregir leche' })).toBeVisible()
})

test('editar ofrece borrar y la confirmación se puede cancelar', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue(dayWithNote)
  renderToday()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
  const trigger = screen.getByRole('button', { name: 'Borrar lo anotado' })
  fireEvent.click(trigger)
  expect(screen.getByRole('button', { name: 'Borrar' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.getByRole('button', { name: 'Borrar lo anotado' })).toHaveFocus()
})

test('el detalle se envuelve sin recortes y conserva acciones de 44 px', () => {
  const css = readFileSync('src/pages/TodayPage.css', 'utf8')
  expect(css).not.toContain('text-overflow: ellipsis')
  expect(css).not.toContain('-webkit-line-clamp')
  expect(css).toContain('overflow-wrap: anywhere')
  expect(css).toMatch(/\.nota-item__edit \{[\s\S]*min-width: 44px;[\s\S]*min-height: 44px/)
  expect(css).toMatch(/\.nota-menu__trigger, \.nota-revisar[\s\S]*min-width: 44px;[\s\S]*min-height: 44px/)
})

test('el popup contiene el foco, cierra con Escape y lo devuelve al botón', async () => {
  setupRemoval([removableItems[0]])
  renderToday()
  const trigger = await screen.findByRole('button', { name: /^Así lo entendí/ })
  expect(screen.queryByRole('dialog', { name: 'Así lo entendí' })).not.toBeInTheDocument()
  fireEvent.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Así lo entendí' })
  const close = within(dialog).getByRole('button', { name: 'Cerrar' })
  expect(close).toHaveFocus()
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
  expect(within(dialog).getByRole('link')).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Tab' })
  expect(close).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Así lo entendí' })).not.toBeInTheDocument()
  expect(document.body.style.overflow).not.toBe('hidden')
  expect(trigger).toHaveFocus()
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

test('la confirmación de eliminación queda por encima del sheet abierto', () => {
  const style = document.createElement('style')
  style.textContent = readFileSync('src/pages/TodayPage.css', 'utf8') + readFileSync('src/components/BottomSheet.css', 'utf8')
  const toast = document.createElement('div')
  toast.className = 'toast'
  const overlay = document.createElement('div')
  overlay.className = 'bottom-sheet-overlay'
  document.head.append(style)
  document.body.append(toast, overlay)
  try {
    expect(Number(getComputedStyle(toast).zIndex)).toBeGreaterThan(Number(getComputedStyle(overlay).zIndex))
  } finally {
    style.remove()
    toast.remove()
    overlay.remove()
  }
})
