import { readFileSync } from 'node:fs'
import { mockGetMyPlan, mockGetDayRecord, mockGetSuggestions, mockSaveNote, mockDeleteNote, proteinGroups, emptyDay, dayWithNote } from './test-utils'
import { act, render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi, afterEach } from 'vitest'
import TodayPage from '../TodayPage'

const meals = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Extra'].map((name, index) => ({
  id: index + 1, name, displayOrder: index, suggestedTime: ['08:00', '13:00', '17:00', '23:00', undefined][index],
  portions: index === 4 ? [] : [{ foodGroupId: 1, portions: 1 }],
}))

test('reconcilia el borrador si el guardado termina con otra comida abierta', async () => {
  const saved = { status: 'REGISTRADA' as const, noteId: 1, version: 4, text: 'leche', date: '2026-11-09', mealId: 4, items: [], entries: [], comparison: [] }
  let resolveSave!: (value: typeof saved) => void
  mockSaveNote.mockReturnValueOnce(new Promise(resolve => { resolveSave = resolve }))
  setup()
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'leche' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(mockSaveNote).toHaveBeenLastCalledWith('tok', saved.date, 4, 'leche', null)
  fireEvent.click(screen.getByRole('button', { name: 'Desayuno, 08:00: sin anotar' }))
  await act(async () => { resolveSave(saved) })
  fireEvent.click(screen.getByRole('button', { name: /^Cena, 23:00:/ }))
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByText('leche')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  expect(screen.getByRole('textbox')).toHaveValue('leche')
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'leche y pan' } })
  mockSaveNote.mockResolvedValueOnce({ ...saved, version: 5, text: 'leche y pan' })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(mockSaveNote).toHaveBeenLastCalledWith('tok', saved.date, 4, 'leche y pan', 4)
  await screen.findByRole('button', { name: 'Editar' })
})
test('limpia el borrador al volver sin editar antes de que termine el guardado', async () => {
  const saved = { status: 'REGISTRADA' as const, noteId: 1, version: 4, text: 'A', date: '2026-11-09', mealId: 4, items: [], entries: [], comparison: [] }
  let resolveSave!: (value: typeof saved) => void
  mockSaveNote.mockReturnValueOnce(new Promise(resolve => { resolveSave = resolve }))
  setup()
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Desayuno, 08:00: sin anotar' }))
  fireEvent.click(screen.getByRole('button', { name: /^Cena, 23:00:/ }))
  expect(screen.getByRole('textbox')).toHaveValue('A')
  await act(async () => { resolveSave(saved) })
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument()
  expect(screen.getByText('A')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Editar' })).toBeVisible()

  // Al remontar, el borrador compartido también debe seguir limpio.
  fireEvent.click(screen.getByRole('button', { name: 'Desayuno, 08:00: sin anotar' }))
  fireEvent.click(screen.getByRole('button', { name: /^Cena, 23:00:/ }))
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByText('A')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Editar' })).toBeVisible()
})

test.each([false, true])('conserva las ediciones al volver a una comida con un guardado pendiente (remontar: %s)', async remount => {
  const saved = { status: 'REGISTRADA' as const, noteId: 1, version: 4, text: 'A', date: '2026-11-09', mealId: 4, items: [], entries: [], comparison: [] }
  let resolveSave!: (value: typeof saved) => void
  mockSaveNote.mockReturnValueOnce(new Promise(resolve => { resolveSave = resolve }))
  setup()
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(mockSaveNote).toHaveBeenLastCalledWith('tok', saved.date, 4, 'A', null)
  fireEvent.click(screen.getByRole('button', { name: 'Desayuno, 08:00: sin anotar' }))
  fireEvent.click(screen.getByRole('button', { name: /^Cena, 23:00:/ }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'AB' } })
  await act(async () => { resolveSave(saved) })
  expect(screen.getByRole('textbox')).toHaveValue('AB')
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  if (remount) {
    // El borrador compartido también debe seguir sucio al volver a montar.
    fireEvent.click(screen.getByRole('button', { name: 'Desayuno, 08:00: sin anotar' }))
    fireEvent.click(screen.getByRole('button', { name: /^Cena, 23:00:/ }))
    expect(screen.getByRole('textbox')).toHaveValue('AB')
  }
  mockSaveNote.mockResolvedValueOnce({ ...saved, version: 5, text: 'AB' })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(mockSaveNote).toHaveBeenLastCalledWith('tok', saved.date, 4, 'AB', 4)
  await screen.findByRole('button', { name: 'Editar' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

function setup(path = '/hoy', time = '19:04') {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`2026-11-09T${time}:00`))
  mockGetMyPlan.mockResolvedValue({ foodGroups: proteinGroups, meals })
  render(<MemoryRouter initialEntries={[path]}><TodayPage /></MemoryRouter>)
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

test('tira ordenada, banda, punto Sigue y Extra con más; resumen cerrado dentro de la tarjeta', async () => {
  setup()
  const strip = await screen.findByRole('group', { name: 'Comidas del día' })
  const buttons = within(strip).getAllByRole('button')
  expect(buttons.map(button => button.textContent?.replace('+', ''))).toEqual(['Desayuno08:00', 'Almuerzo13:00', 'Merienda17:00', 'Cena23:00', 'Extra'])
  expect(buttons[3]).toHaveAttribute('aria-pressed', 'true')
  expect(buttons[3]).toHaveAttribute('data-sigue')
  expect(buttons[3]).toHaveAccessibleName('Cena, 23:00: sin anotar')
  expect(buttons[4]).not.toHaveAttribute('data-sigue')
  expect(within(buttons[4]).getByText('+')).toBeInTheDocument()
  expect(strip.querySelector('.banda')).toHaveStyle({ transform: 'translateX(300%)' })
  const summary = screen.getByRole('button', { name: /Tu día por grupo/ })
  expect(summary).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(summary)
  expect(summary).toHaveAttribute('aria-expanded', 'true')
  expect(document.getElementById('hoy-grupos')?.parentElement).toBe(strip.parentElement)
  expect(screen.queryByText(/^(Ahora|Antes|Después)$/)).not.toBeInTheDocument()
  expect(document.querySelector('.meal-card')).not.toBeInTheDocument()
})

test('escribir y guardar sin toque previo, sugerencias y dictado; conserva el borrador al cambiar de miga', async () => {
  vi.stubGlobal('SpeechRecognition', class { start() {} abort() {} })
  mockGetSuggestions.mockResolvedValue(['leche con pan'])
  mockSaveNote.mockResolvedValue({ status: 'REGISTRADA', noteId: 1, version: 1, text: 'leche', date: emptyDay.date, mealId: 4, items: [], entries: [], comparison: [] })
  setup()
  const input = await screen.findByRole('textbox', { name: '¿Qué comiste?' })
  expect(screen.getByLabelText('Te toca')).toHaveTextContent('1 Proteínas')
  expect(await screen.findByRole('heading', { name: 'Lo de siempre' })).toBeVisible()
  expect(screen.getByRole('button', { name: /Dictar/ })).toBeInTheDocument()
  fireEvent.change(input, { target: { value: 'leche' } })
  fireEvent.click(screen.getByRole('button', { name: 'Desayuno, 08:00: sin anotar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cena, 23:00: sin anotar' }))
  expect(screen.getByRole('textbox')).toHaveValue('leche')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(mockSaveNote).toHaveBeenCalledWith('tok', expect.any(String), 4, 'leche', null)
})

test('nota guardada con estado y diferencias; editar, cancelar y confirmar borrado', async () => {
  mockGetDayRecord.mockResolvedValue({ ...dayWithNote, meals: [{ ...dayWithNote.meals[0], mealId: 4, status: 'CASI', comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded: 1, status: 'CASI' }] }] })
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Cena, 23:00: faltó algo' }))
  expect(screen.getByText('leche y pan')).toBeVisible()
  expect(screen.getByText('Faltó algo')).toBeVisible()
  expect(screen.getByText('Faltó 1 porción de Proteínas')).toBeVisible()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'otra cosa' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  expect(screen.getByRole('textbox')).toHaveValue('leche y pan')
  fireEvent.click(screen.getByRole('button', { name: 'Borrar lo anotado' }))
  expect(mockDeleteNote).not.toHaveBeenCalled()
  mockDeleteNote.mockResolvedValue(4)
  fireEvent.click(screen.getByRole('button', { name: /^Borrar$/ }))
  expect(mockDeleteNote).toHaveBeenCalledWith('tok', expect.any(String), 4, 3)
})

test.each(['2026-11-10', '2026-02-30', 'invalida'])('fecha %s abre hoy y deshabilita siguiente', async value => {
  setup(`/hoy?fecha=${value}`)
  await screen.findByRole('group', { name: 'Comidas del día' })
  expect(mockGetDayRecord).toHaveBeenCalledWith('tok', '2026-11-09', expect.anything())
  expect(screen.getAllByRole('button', { name: 'Día siguiente' }).every(button => button.hasAttribute('disabled'))).toBe(true)
})

test('fecha pasada desde URL, título largo y navegación', async () => {
  setup('/hoy?fecha=2026-11-06')
  await screen.findByRole('group', { name: 'Comidas del día' })
  expect(mockGetDayRecord).toHaveBeenCalledWith('tok', '2026-11-06', expect.anything())
  expect(screen.getAllByRole('heading', { level: 1 })[0]).toHaveTextContent('viernes, 6 de noviembre')
  expect(screen.getByRole('button', { name: 'Desayuno, 08:00: sin anotar' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText('Sigue')).not.toBeInTheDocument()
  fireEvent.click(screen.getAllByRole('button', { name: 'Día siguiente' })[0])
  expect((await screen.findAllByRole('heading', { name: /sábado, 7 de noviembre/ }))[0]).toBeInTheDocument()
})

test('guardar mantiene el panel abierto y el reloj luego sigue la nueva comida pendiente', async () => {
  mockSaveNote.mockResolvedValue({ status: 'REGISTRADA', noteId: 1, version: 1, text: 'leche', date: '2026-11-09', mealId: 1, items: [], entries: [], comparison: [] })
  setup('/hoy', '08:00')
  const breakfast = await screen.findByRole('button', { name: 'Desayuno, 08:00: sin anotar' })
  expect(breakfast).toHaveAttribute('aria-pressed', 'true')
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'leche' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByRole('button', { name: 'Editar' })).toBeVisible()
  expect(screen.getByText('leche')).toBeVisible()
  expect(breakfast).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Almuerzo, 13:00: sin anotar' })).toHaveAttribute('data-sigue')

  vi.setSystemTime(new Date('2026-11-09T16:00:00'))
  fireEvent.focus(window)
  const snack = screen.getByRole('button', { name: 'Merienda, 17:00: sin anotar' })
  expect(snack).toHaveAttribute('data-sigue')
  expect(snack).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('heading', { name: 'Merienda', level: 2 })).toBeVisible()
})

test('el reloj no cambia el panel mientras existe un borrador sin guardar', async () => {
  setup('/hoy', '09:00')
  const breakfast = await screen.findByRole('button', { name: 'Desayuno, 08:00: sin anotar' })
  expect(breakfast).toHaveAttribute('aria-pressed', 'true')
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'borrador pendiente' } })
  vi.setSystemTime(new Date('2026-11-09T10:00:00'))
  fireEvent.focus(window)
  expect(screen.getByRole('button', { name: 'Almuerzo, 13:00: sin anotar' })).toHaveAttribute('data-sigue')
  expect(breakfast).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('textbox')).toHaveValue('borrador pendiente')
})

test('la tira mantiene blancos de 44 px y la pantalla una columna de hasta 480 px', async () => {
  const style = document.createElement('style')
  style.textContent = readFileSync('src/pages/TodayPage.css', 'utf8') + readFileSync('src/pages/today/DayStrip.css', 'utf8')
  document.head.append(style)
  try {
    setup()
    const meal = await screen.findByRole('button', { name: 'Cena, 23:00: sin anotar' })
    expect(Number.parseFloat(getComputedStyle(meal).minWidth)).toBeGreaterThanOrEqual(44)
    expect(Number.parseFloat(getComputedStyle(meal).minHeight)).toBeGreaterThanOrEqual(44)
    expect(getComputedStyle(document.querySelector('.hoy-page')!).maxWidth).toBe('480px')
  } finally {
    style.remove()
  }
})
