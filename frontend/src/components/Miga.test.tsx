import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Miga from './Miga'
import { mealAspect } from '../lib/mealStatus'

test.each([
  ['EN_PLAN', 'full'], ['CASI', 'half'], ['DE_MAS', 'half'], ['MIXED', 'half'],
  ['PREGUNTAR', 'half'], ['REGISTRADA', 'noted'], ['SIN_ANOTAR', 'empty'], ['FLEXIBLE', 'flexible'],
] as const)('representa %s desde la API', (status, aspect) => {
  expect(mealAspect(status)).toBe(aspect)
  render(<Miga aspect={mealAspect(status)} label="Comida" />)
  expect(screen.getByRole('img', { name: 'Comida' })).toHaveClass(`meal-crumb--${aspect}`)
})

test('distingue futuro, extra sin anotar y comida ausente', () => {
  expect(mealAspect('EN_PLAN', { future: true })).toBe('future')
  expect(mealAspect('SIN_ANOTAR', { planned: false })).toBe('plus')
  expect(mealAspect('SIN_ANOTAR', { planned: false, future: true, week: true })).toBe('dash')
  expect(mealAspect('REGISTRADA', { planned: false })).toBe('noted')
  const { rerender } = render(<Miga aspect="plus" />)
  expect(screen.getByText('+')).toHaveAttribute('aria-hidden', 'true')
  rerender(<Miga aspect="dash" label="No toca" />)
  expect(screen.getByRole('img')).toHaveClass('meal-crumb--dash')
  rerender(<Miga aspect="future" label="Todavía no" />)
  expect(screen.getByRole('img')).toHaveClass('meal-crumb--future')
})
