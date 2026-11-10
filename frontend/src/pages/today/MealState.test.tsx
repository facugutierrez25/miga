import {
  mockGetMyPlan,
  mockGetDayRecord,
  planWithMeal,
  emptyDay,
  renderToday,
  twoMealPlan,
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
  mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [{ mealId: 1, status: 'MIXED' as const, noteId: 1, noteVersion: 0, noteText: 'comida', items: [], comparison: [
    ...names.map((name, i) => ({ foodGroupId: 9876 + i, name, expected: amounts[i], recorded: 0, status: 'CASI' })),
    { foodGroupId: 9999, name: 'Grasas', expected: 0, recorded: 1, status: 'DE_MAS' },
  ] }] })
  renderToday()
  const row = await screen.findByRole('button', { name: /Desayuno/ })
  expect(row).toHaveAccessibleName('Desayuno: faltó y de más')
  expect(row).not.toHaveTextContent(expected)

  expect(row).not.toHaveTextContent(/9876|9999/)
  fireEvent.click(row)
  const differences = screen.getByRole('region', { name: 'Desayuno' }).querySelectorAll('.dif li')
  expect(differences).toHaveLength(names.length + 1)
  names.forEach((name, index) => {
    expect(differences[index]).toHaveTextContent(`Faltó ${String(amounts[index]).replace('.', ',')} ${amounts[index] === 1 ? 'porción' : 'porciones'} de ${name || 'un grupo del plan'}`)
    expect(differences[index].querySelector('.nota-item__dot')).toHaveAttribute('aria-hidden', 'true')
  })
})

test.each(['EN_PLAN', 'CASI', 'DE_MAS', 'PREGUNTAR', 'FLEXIBLE', 'REGISTRADA'] as const)('el panel lee el estado %s de la API sin ficha', async status => {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [{
    mealId: 1, status, noteId: 1, noteVersion: 1, noteText: 'leche', items: [], comparison: [],
  }] })
  renderToday()
  const meal = await screen.findByRole('region', { name: 'Desayuno' })
  expect(within(meal).getByText('leche')).toBeVisible()
  expect(meal.querySelector('.status-chip')).toBeInTheDocument()
  expect(meal.querySelector('.meal-card')).not.toBeInTheDocument()
})
