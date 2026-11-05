import { expect, test } from 'vitest'
import { displayUnit } from './displayUnit'

test.each(['p.', 'porcion', 'porción', 'porciones'])('muestra porciones para %s', unit => {
  expect(displayUnit(unit, 1)).toBe('porción')
  expect(displayUnit(unit, 2)).toBe('porciones')
  expect(displayUnit(unit, 0.5)).toBe('porciones')
})
test.each(['u', 'unidad', 'unidades'])('muestra unidades para %s', unit => {
  expect(displayUnit(unit, 1)).toBe('unidad')
  expect(displayUnit(unit, 2)).toBe('unidades')
})
test('conserva otras unidades', () => {
  expect(displayUnit('g', 90)).toBe('g')
  expect(displayUnit(null, null)).toBe('')
})
