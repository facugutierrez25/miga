import {
  mockGetMyPlan,
  mockGetDayRecord,
  planWithMeal,
  emptyDay,
  renderToday,
  twoMealPlan,
  openDetails,
  openNote,
} from './test-utils'
import { screen, fireEvent, within } from '@testing-library/react'
import { test, expect } from 'vitest'
test.each([
  { names: ['Proteínas'], amounts: [1], expected: 'Faltó 1 porción de Proteínas' },
  { names: ['Proteínas', 'Cereales'], amounts: [1, 2], expected: 'Faltó 1 porción de Proteínas y 2 de Cereales' },
  { names: ['Proteínas', 'Cereales', 'Verduras'], amounts: [2, 1, 0.5], expected: 'Faltó 2 porciones de Proteínas, 1 de Cereales y 0,5 de Verduras' },
  { names: [''], amounts: [2], expected: 'Faltó 2 porciones de un grupo del plan' },
])('describe las faltas: $expected', async ({ names, amounts, expected }) => {
  mockGetMyPlan.mockResolvedValue(twoMealPlan)
  mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [{ mealId: 1, noteId: 1, noteVersion: 0, noteText: 'comida', items: [], comparison: [
    ...names.map((name, i) => ({ foodGroupId: 9876 + i, name, expected: amounts[i], recorded: 0, status: 'CASI' })),
    { foodGroupId: 9999, name: 'Grasas', expected: 0, recorded: 1, status: 'DE_MAS' },
  ] }] })
  renderToday()
  const row = await screen.findByRole('button', { name: /Desayuno/ })
  expect(row).toHaveTextContent('Faltó y de más')
  expect(row).not.toHaveTextContent(expected)
  expect(row).toHaveAccessibleName(`Desayuno: ${expected} · De más: 1 porción de Grasas`)
  expect(row).not.toHaveTextContent(/9876|9999/)
  fireEvent.click(row)
  await openDetails()
  expect(await screen.findByText(new RegExp(`Entendí:.*${expected}`))).toBeVisible()
})

test.each([
  { status: 'CASI', recorded: 1, difference: 'falta 1', label: 'Proteínas: 1 de 2, falta 1' },
  { status: 'EN_PLAN', recorded: 2, difference: '', label: 'Proteínas: 2 de 2' },
  { status: 'DE_MAS', recorded: 3, difference: '1 de más', label: 'Proteínas: 3 de 2, 1 de más' },
  { status: 'CASI', recorded: 1.5, difference: 'falta 0,5', label: 'Proteínas: 1,5 de 2, falta 0,5' },
])('la ficha de la comida de ahora dice cada grupo con su diferencia: $label', async ({ status, recorded, label }) => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [{
    mealId: 1, noteId: 1, noteVersion: 1, noteText: 'leche', items: [],
    comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded, status }],
  }] })
  renderToday()
  const meal = await screen.findByRole('article', { name: 'Desayuno' })
  expect(within(meal).getByRole('img', { name: label })).toHaveTextContent(`Proteínas ${String(recorded).replace('.', ',')} de 2`)
  expect(within(meal).getByRole('img', { name: `Desayuno: el plan pide 2 porciones, anotaste ${String(recorded).replace('.', ',')}` })).toBeInTheDocument()
})

test.each([
  { status: 'EN_PLAN', recorded: 1.5, difference: '' },
  { status: 'PREGUNTAR', recorded: 0, difference: '' },
  { status: 'CASI', recorded: 1, difference: 'falta 1' },
  { status: 'SIN_ANOTAR', recorded: 0, difference: 'falta 2' },
  { status: 'DE_MAS', recorded: 3, difference: '1 de más' },
])('meal migas respect $status', async ({ status, recorded, difference }) => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue({
    date: '2025-01-01', summary: [],
    meals: [{
      mealId: 1, noteId: 1, noteVersion: 0, noteText: 'leche', items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded, status }],
    }],
  })
  renderToday()
  await openNote()
  const count = String(recorded).replace('.', ',')
  expect(screen.getByRole('img', {
    name: `Proteínas: ${count} de 2${status === 'PREGUNTAR' ? ', por confirmar' : ''}${difference ? `, ${difference}` : ''}`,
  })).toBeInTheDocument()
})
