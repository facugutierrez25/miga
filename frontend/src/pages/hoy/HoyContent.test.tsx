import {
  mealRenders,
  mockGetMyPlan,
  mockGetDayRegistro,
  mockGetSugerencias,
  proteinGroups,
  planWithMeal,
  emptyDay,
  renderToday,
  openNote,
  twoMealPlan,
  removableItems,
  setupRemoval,
  openDetails,
} from './test-utils'
import { ItemOrigin } from '../../api/registro'
import { act, screen, waitFor, fireEvent, within } from '@testing-library/react'
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

test('muestra primero la comida de ahora y el resto en el orden del plan', async () => {
  mockGetMyPlan.mockResolvedValue({
    foodGroups: [
      { id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
      { id: 2, name: 'Cereales',  abbreviation: 'CER', displayOrder: 2, color: null },
    ],
    meals: [
      { id: 3, name: 'Cena', displayOrder: 3, portions: [{ foodGroupId: 1, portions: 1 }] },
      { id: 2, name: 'Almuerzo', displayOrder: 2, portions: [{ foodGroupId: 1, portions: 2 }] },
      { id: 1, name: 'Desayuno', displayOrder: 1, portions: [{ foodGroupId: 2, portions: 1 }] },
    ],
  })
  renderToday()
  // Sin horarios, la comida de ahora es la última del plan; el resto sigue el orden del plan.
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Cena', level: 2 })).toBeInTheDocument())
  const previous = screen.getByRole('region', { name: 'Antes' })
  const nombres = Array.from(previous.querySelectorAll('.hoy-fila__nombre')).map(n => n.textContent)
  expect(nombres).toEqual(['Desayuno', 'Almuerzo'])
  expect(screen.queryByRole('region', { name: 'Después' })).not.toBeInTheDocument()
})

test('muestra la hora sugerida cuando está presente', async () => {
  mockGetMyPlan.mockResolvedValue({
    foodGroups: [{ id: 4, name: 'Lácteos', abbreviation: 'LAC', displayOrder: 4, color: null }],
    meals: [{ id: 1, name: 'Desayuno', suggestedTime: '08:00:00', displayOrder: 1, portions: [{ foodGroupId: 4, portions: 1 }] }],
  })
  renderToday()
  await waitFor(() => expect(screen.getByText('08:00')).toBeInTheDocument())
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
  await waitFor(() => expect(screen.getAllByText('Proteínas').length).toBeGreaterThan(0))
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
  expect(screen.getAllByRole('img', { name: 'Proteínas: 0 de 2 porciones' }).length).toBeGreaterThan(0)
})

test('el día sin anotar explica las migas', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  renderToday()
  await waitFor(() => expect(screen.getByText(/Cada porción de tu plan es una miga/)).toBeInTheDocument())
})

test('muestra error si getDayRegistro falla', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRegistro.mockRejectedValue(new Error('red error'))
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
  mockGetDayRegistro.mockReturnValue(new Promise(() => {}))
  renderToday()
  await waitFor(() => expect(screen.getByRole('link', { name: 'Cargar mi plan' })).toBeInTheDocument())
})

test('permite reintentar un error del plan aunque el día siga pendiente', async () => {
  mockGetMyPlan.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce(planWithMeal)
  mockGetDayRegistro.mockReturnValue(new Promise(() => {}))
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
  mockGetDayRegistro.mockResolvedValue({
    ...emptyDay,
    meals: [{
      mealId: 1, noteId: 3, noteVersion: 0, noteText: 'dos huevos', items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 2, status: 'DE_MAS' }],
    }],
  })
  renderToday()
  const renderRow = await screen.findByRole('button', { name: /Desayuno/, expanded: false })
  expect(renderRow).toHaveTextContent('De más')
  expect(renderRow).toHaveAccessibleName('Desayuno: De más: 1 porción de Proteínas')
  fireEvent.click(renderRow)
  expect(renderRow).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getAllByRole('textbox', { name: '¿Qué comiste?' }).some(t => (t as HTMLTextAreaElement).value === 'dos huevos')).toBe(true)
})

test('respeta el margen del plan: dentro del margen la comida es como el plan', async () => {
  mockGetMyPlan.mockResolvedValue(twoMealPlan)
  mockGetDayRegistro.mockResolvedValue({
    ...emptyDay,
    meals: [{
      mealId: 1, noteId: 3, noteVersion: 0, noteText: 'medio huevo', items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0.5, status: 'EN_PLAN' }],
    }],
  })
  renderToday()
  expect(await screen.findByRole('button', { name: /Desayuno/, expanded: false })).toHaveTextContent('Como el plan')
})

test('usa el color del grupo propio en sus migas', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, foodGroups: [
    { id: 1, name: 'Grupo propio', abbreviation: 'CUS', displayOrder: 1, color: '#368C91' },
  ] })
  const { container } = renderToday()
  await screen.findAllByText('Grupo propio')
  await waitFor(() => expect(container.querySelector('path[stroke="var(--g-turq)"]')).toBeInTheDocument())
  expect(container.querySelector('path[stroke="var(--g-prot)"]')).not.toBeInTheDocument()
})

test('a saved note with an empty comparison has no missing portions', async () => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRegistro.mockResolvedValue({
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, noteId: 1, noteVersion: 0, noteText: 'leche', items: [], comparison: [] }],
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
  mockGetDayRegistro.mockImplementation(async (_token, date) => ({
    date, summary: [], meals: [{
      mealId: 289, noteId: 1, noteVersion: 0, noteText: 'Historical note', items: [], comparison: [],
    }],
  }))
  renderToday()
  await screen.findByRole('heading', { name: 'Desayuno' })
  fireEvent.click(screen.getAllByRole('button', { name: /a anterior$/ })[0])
  fireEvent.click(await screen.findByRole('button', { name: /Desayuno/ }))
  expect(await screen.findByDisplayValue('Historical note')).toBeInTheDocument()
  expect(mockGetMyPlan.mock.calls.some(([, , date]) => date !== today)).toBe(true)
})

test('cómo lo calculé muestra cada cosa escrita con su tipo de regla y aclara que corregir no cambia el plan', async () => {
  setupRemoval([
    { ...removableItems[0], appliedRule: '1.000 u de leche = 1 porcion' },
    { id: 104, food: 'pizza', quantity: 1, unit: 'u', foodGroupId: null, portions: 0, origin: ItemOrigin.REGLA, uncertain: false, occurrenceId: 'pizza', appliedRule: 'pizza = flexible (sin porción fija)' },
    { id: 105, food: 'algo raro', quantity: null, unit: null, foodGroupId: null, portions: null, origin: ItemOrigin.UNKNOWN, uncertain: false, occurrenceId: 'raro' },
  ])
  renderToday()
  await openDetails()
  fireEvent.click(await screen.findByRole('button', { name: 'Cómo lo calculé' }))
  const dialog = screen.getByRole('dialog', { name: 'Cómo lo calculé' })
  expect(dialog).toHaveTextContent('no cambia el plan de tu nutri')
  expect(within(dialog).getByText('Por porción · 1 porción de Proteínas')).toBeInTheDocument()
  expect(within(dialog).getByText('1 u de leche = 1 porción')).toBeInTheDocument()
  expect(within(dialog).getByText('Comida flexible')).toBeInTheDocument()
  expect(within(dialog).getByText('Sin regla')).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
  expect(screen.queryByRole('dialog', { name: 'Cómo lo calculé' })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Así lo entendí' })).toBeInTheDocument()
})

test('meal renders stay isolated while typing and toggling the daily summary', async () => {
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, meals: ['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((name, index) => ({
    ...planWithMeal.meals[0], id: index + 1, name, suggestedTime: undefined, displayOrder: index,
  })) })
  renderToday()
  await screen.findByRole('heading', { name: 'Snack', level: 2 })
  fireEvent.click(screen.getByRole('button', { name: /Breakfast/ }))
  fireEvent.click(screen.getByRole('button', { name: /Lunch/ }))
  await waitFor(() => expect(mockGetSugerencias).toHaveBeenCalledTimes(3))
  await act(async () => {})
  mealRenders.clear()
  const editor = screen.getAllByRole('textbox', { name: /comiste/ })[1]
  for (const value of ['a', 'ab', 'abc']) fireEvent.change(editor, { target: { value } })
  expect(Object.fromEntries(mealRenders)).toEqual({ 'NotaMealSection-1': 3 })
  mealRenders.clear()
  const summary = screen.getByText(/Tu d.a por grupo/).closest('details')!
  summary.open = false
  fireEvent(summary, new Event('toggle'))
  expect(Object.fromEntries(mealRenders)).toEqual({})
})

