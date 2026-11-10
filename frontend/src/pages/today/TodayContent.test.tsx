import {
  mealRenders,
  mockGetMyPlan,
  mockGetDayRecord,
  mockGetSuggestions,
  proteinGroups,
  planWithMeal,
  emptyDay,
  renderToday,
  openNote,
  twoMealPlan,
} from './test-utils'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { test, expect } from 'vitest'
test('muestra cargando mientras carga el plan', () => {
  mockGetMyPlan.mockReturnValue(new Promise(() => {}))
  renderToday()
  expect(screen.getByText('Cargando tu día…')).toBeInTheDocument()
})

test('muestra link a mi plan cuando no hay plan cargado', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  renderToday()
  await waitFor(() => expect(screen.getByText('Cargar mi plan')).toBeInTheDocument())
  expect(screen.getByRole('link', { name: 'Cargar mi plan' })).toHaveAttribute('href', '/onboarding')
})

test('muestra la tira en el orden del plan y abre la primera sin horarios', async () => {
  mockGetMyPlan.mockResolvedValue({ foodGroups: proteinGroups, meals: [3, 1, 2].map(id => ({
    id, name: ['Desayuno', 'Almuerzo', 'Cena'][id - 1], displayOrder: id, portions: [],
  })) })
  renderToday()
  expect(await screen.findByRole('heading', { name: 'Desayuno', level: 2 })).toBeInTheDocument()
  const strip = screen.getByRole('group', { name: /Comidas del d.a/ })
  expect(within(strip).getAllByRole('button').map(button => button.textContent?.replace('+', ''))).toEqual(['Desayuno', 'Almuerzo', 'Cena'])
})

test('muestra la hora sugerida cuando está presente', async () => {
  mockGetMyPlan.mockResolvedValue({
    foodGroups: [{ id: 4, name: 'Lácteos', abbreviation: 'LAC', displayOrder: 4, color: null }],
    meals: [{ id: 1, name: 'Desayuno', suggestedTime: '08:00:00', displayOrder: 1, portions: [{ foodGroupId: 4, portions: 1 }] }],
  })
  renderToday()
  await waitFor(() => expect(screen.getAllByText('08:00')[0]).toBeInTheDocument())
})

test('muestra solo los grupos con porciones mayores a cero', async () => {
  mockGetMyPlan.mockResolvedValue({
    foodGroups: [
      { id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
      { id: 2, name: 'Cereales',  abbreviation: 'CER', displayOrder: 2, color: null },
    ],
    meals: [{
      id: 1, name: 'Desayuno', displayOrder: 1,
      portions: [
        { foodGroupId: 1, portions: 1 },
        { foodGroupId: 2, portions: 0 },
      ],
    }],
  })
  renderToday()
  await waitFor(() => expect(screen.getByLabelText('Te toca')).toHaveTextContent('Proteínas'))
  expect(screen.queryByText('Cereales')).not.toBeInTheDocument()
})

test('muestra el nombre del usuario en el saludo', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  renderToday()
  await waitFor(() => expect(screen.getAllByText(/facu/i).length).toBeGreaterThan(0))
})

test('muestra el resumen de porciones cuando hay un plan', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  renderToday()
  await waitFor(() => expect(screen.getByText('0 de 2 porciones')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /Tu d.a por grupo/ }))
  expect(screen.getAllByRole('img', { name: 'Proteínas: 0 de 2 porciones' }).length).toBeGreaterThan(0)
})

test('el resumen del día abre cerrado', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  renderToday()
  expect(await screen.findByRole('button', { name: /Tu d.a por grupo/ })).toHaveAttribute('aria-expanded', 'false')
})

test('muestra error si getDayRegistro falla', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockRejectedValue(new Error('red error'))
  renderToday()
  await waitFor(() => expect(screen.getByText(/No se pudo cargar/)).toBeInTheDocument())
})

test('muestra "Hoy" en la barra de navegación por defecto', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  renderToday()
  await waitFor(() => expect(screen.getAllByText('Hoy').length).toBeGreaterThan(0))
})

test('muestra el inicio del plan aunque el registro del día siga pendiente', async () => {
  mockGetMyPlan.mockRejectedValue(new Error('sin-plan'))
  mockGetDayRecord.mockReturnValue(new Promise(() => {}))
  renderToday()
  await waitFor(() => expect(screen.getByRole('link', { name: 'Cargar mi plan' })).toBeInTheDocument())
})

test('permite reintentar un error del plan aunque el día siga pendiente', async () => {
  mockGetMyPlan.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce(planWithMeal)
  mockGetDayRecord.mockReturnValue(new Promise(() => {}))
  renderToday()
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el plan.'))
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(mockGetMyPlan).toHaveBeenCalledTimes(2))
})

test('las otras comidas muestran su estado en texto y se abren para anotar', async () => {
  mockGetMyPlan.mockResolvedValue({
    foodGroups: proteinGroups,
    meals: [
      { id: 1, name: 'Desayuno', displayOrder: 1, portions: [{ foodGroupId: 1, portions: 1 }] },
      { id: 2, name: 'Cena', displayOrder: 2, portions: [{ foodGroupId: 1, portions: 2 }] },
    ],
  })
  mockGetDayRecord.mockResolvedValue({
    ...emptyDay,
    meals: [{
      mealId: 1, status: 'DE_MAS' as const, noteId: 3, noteVersion: 0, noteText: 'dos huevos', items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 2, status: 'DE_MAS' }],
    }],
  })
  renderToday()
  const row = await screen.findByRole('button', { name: /Desayuno: de m.s/ })
  fireEvent.click(row)
  expect(row).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('dos huevos')).toBeVisible()
  expect(screen.getAllByText(/De m.s: 1 porci.n de Prote.nas/)[0]).toBeVisible()
})

test('respeta el margen del plan: dentro del margen la comida es como el plan', async () => {
  mockGetMyPlan.mockResolvedValue(twoMealPlan)
  mockGetDayRecord.mockResolvedValue({
    ...emptyDay,
    meals: [{
      mealId: 1, status: 'EN_PLAN' as const, noteId: 3, noteVersion: 0, noteText: 'medio huevo', items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0.5, status: 'EN_PLAN' }],
    }],
  })
  renderToday()
  expect(await screen.findByRole('button', { name: /Desayuno: como el plan/ })).toBeInTheDocument()
})

test('usa el color del grupo propio en sus migas', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, foodGroups: [
    { id: 1, name: 'Grupo propio', abbreviation: 'CUS', displayOrder: 1, color: '#368C91' },
  ] })
  const { container } = renderToday()
  await screen.findByLabelText('Te toca')
  fireEvent.click(screen.getByRole('button', { name: /Tu d.a por grupo/ }))
  await waitFor(() => expect(container.querySelector('path[stroke="var(--g-turq)"]')).toBeInTheDocument())
  expect(container.querySelector('path[stroke="var(--g-prot)"]')).not.toBeInTheDocument()
})

test('a saved note with an empty comparison has no missing portions', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue({
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, status: 'REGISTRADA' as const, noteId: 1, noteVersion: 0, noteText: 'leche', items: [], comparison: [] }],
  })
  renderToday()
  await openNote()
  expect(screen.queryByText(/falta/)).not.toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'Proteínas: 0 de 2' })).not.toBeInTheDocument()
})

test('past dates load their plan and show its meal note', async () => {
  const historical = { ...planWithMeal, meals: [{ ...planWithMeal.meals[0], id: 289 }] }
  let today: string | undefined
  mockGetMyPlan.mockImplementation(async (_token, _signal, date) => {
    today ??= date
    return date === today ? planWithMeal : historical
  })
  mockGetDayRecord.mockImplementation(async (_token, date) => ({
    date, summary: [], meals: [{
      mealId: 289, status: 'REGISTRADA' as const, noteId: 1, noteVersion: 0, noteText: 'Historical note', items: [], comparison: [],
    }],
  }))
  renderToday()
  await screen.findByRole('heading', { name: 'Desayuno' })
  fireEvent.click(screen.getAllByRole('button', { name: /a anterior$/ })[0])
  fireEvent.click(await screen.findByRole('button', { name: /Desayuno/ }))
  expect(await screen.findByText('Historical note')).toBeInTheDocument()
  expect(mockGetMyPlan.mock.calls.some(([, , date]) => date !== today)).toBe(true)
})

test('meal renders stay isolated while typing and toggling the daily summary', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, meals: ['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((name, index) => ({
    ...planWithMeal.meals[0], id: index + 1, name, suggestedTime: undefined, displayOrder: index,
  })) })
  renderToday()
  await screen.findByRole('heading', { name: 'Breakfast', level: 2 })
  fireEvent.click(screen.getByRole('button', { name: /Breakfast/ }))
  fireEvent.click(screen.getByRole('button', { name: /Lunch/ }))
  await waitFor(() => expect(mockGetSuggestions).toHaveBeenCalledTimes(2))
  mealRenders.clear()
  const editor = screen.getByRole('textbox', { name: /comiste/ })
  for (const value of ['a', 'ab', 'abc']) fireEvent.change(editor, { target: { value } })
  expect(Object.fromEntries(mealRenders)).toEqual({ 'MealNoteSection-2': 3 })
  mealRenders.clear()
  fireEvent.click(screen.getByRole('button', { name: /Tu d.a por grupo/ }))
  expect(Object.fromEntries(mealRenders)).toEqual({})
})

