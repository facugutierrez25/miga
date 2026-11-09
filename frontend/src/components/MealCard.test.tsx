import { test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MealCard from './MealCard'

const row = (id: number, name: string, done: number, total: number, status?: string) => ({ id, name, color: '#000', done, total, status })

test('la ficha resume el plan y lo anotado y nombra cada grupo con su diferencia', () => {
  render(<MealCard name="Almuerzo" rows={[row(1, 'Proteínas', 1, 1, 'EN_PLAN'), row(2, 'Verduras', 1, 2, 'CASI')]} />)
  expect(screen.getByRole('img', { name: 'Almuerzo: el plan pide 3 porciones, anotaste 2' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Verduras: 1 de 2, falta 1' })).toBeInTheDocument()
  expect(document.querySelectorAll('.ficha__pips')[0].children).toHaveLength(9)
})

test('de 10 a 12 porciones la ficha pasa a una grilla de 4 × 3', () => {
  render(<MealCard name="Almuerzo" rows={[row(1, 'Proteínas', 0, 6), row(2, 'Cereales', 0, 4)]} />)
  const grid = document.querySelector('.ficha__pips')!
  expect(grid).toHaveClass('ficha__pips--grande')
  expect(grid.children).toHaveLength(12)
})

test('con más de 12 porciones muestra las filas por grupo en vez de la ficha', () => {
  render(<MealCard name="Almuerzo" rows={[row(1, 'Proteínas', 0, 7), row(2, 'Cereales', 0, 6)]} />)
  expect(screen.queryByRole('img', { name: /el plan pide/ })).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: /^Proteínas: 0 de 7/ })).toBeInTheDocument()
})
