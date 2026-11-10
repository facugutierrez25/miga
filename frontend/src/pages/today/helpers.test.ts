import { describe, expect, test } from 'vitest'
import type { MealDto } from '../../api/plans'
import type { MealDayDto } from '../../api/records'
import { findCurrentMealIndex, findInitialMealIndex, resolveDate } from './helpers'

const meals: MealDto[] = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Extra'].map((name, index) => ({
  id: index + 1, name, displayOrder: index, suggestedTime: ['08:00', '13:00', '17:00', '23:00', undefined][index],
  portions: index === 4 ? [] : [{ foodGroupId: 1, portions: 1 }],
}))
const noted = (count: number): MealDayDto[] => meals.slice(0, count).map(meal => ({
  mealId: meal.id!, status: 'REGISTRADA', noteText: 'Anotado', noteId: 1, noteVersion: 1, items: [], comparison: [],
}))

describe('la comida que sigue y la apertura inicial', () => {
  test('a las 19:04 abre Cena a las 23:00 y excluye Extra sin horario', () => {
    expect(findCurrentMealIndex(meals, new Date('2026-11-09T19:04:00'), noted(3))).toBe(3)
  })
  test('a las 23:00 sigue Cena de las 20:00 aunque hayan pasado 90 minutos', () => {
    const plan = meals.map(meal => meal.name === 'Cena' ? { ...meal, suggestedTime: '20:00' } : meal)
    expect(findCurrentMealIndex(plan, new Date('2026-11-09T23:00:00'), noted(3))).toBe(3)
  })
  test('todo anotado: sin Sigue, abre la primera del plan', () => {
    expect(findCurrentMealIndex(meals, new Date('2026-11-09T19:04:00'), noted(4))).toBe(-1)
    expect(findInitialMealIndex(meals, noted(4))).toBe(0)
  })
  test('en otro día abre la primera con horario sin anotar', () => {
    expect(findInitialMealIndex(meals, noted(1))).toBe(1)
  })
  test('incluye el límite de 90 minutos y respeta el estado de la API', () => {
    expect(findCurrentMealIndex(meals, new Date('2026-11-09T09:30:00'))).toBe(0)
    expect(findCurrentMealIndex(meals, new Date('2026-11-09T09:31:00'))).toBe(1)
  })
  test('sin comidas devuelve -1', () => {
    expect(findCurrentMealIndex([], new Date())).toBe(-1)
    expect(findInitialMealIndex([])).toBe(-1)
  })
})

test.each(['2026-11-10', '2026-02-30', 'no-es-fecha', '', null])('fecha inválida o futura %s abre hoy', value => {
  expect(resolveDate(value, '2026-11-09')).toBe('2026-11-09')
})
test('permite una fecha pasada válida', () => {
  expect(resolveDate('2026-11-06', '2026-11-09')).toBe('2026-11-06')
})
