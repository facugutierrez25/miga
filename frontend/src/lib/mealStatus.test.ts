import { expect, test } from 'vitest'
import { mealStatus } from './mealStatus'
import type { GroupStatusDto } from '../api/records'

const missing: GroupStatusDto = { foodGroupId: 1, name: 'Cereales', expected: 2, recorded: 1, status: 'CASI' }
const extra: GroupStatusDto = { foodGroupId: 2, name: 'Proteínas', expected: 1, recorded: 3, status: 'DE_MAS' }

test.each([
  ['EN_PLAN', 'Como el plan'], ['CASI', 'Faltó algo'], ['DE_MAS', 'De más'],
  ['PREGUNTAR', 'Por confirmar'], ['SIN_ANOTAR', 'Sin anotar'], ['REGISTRADA', 'Anotada'],
])('comparte la etiqueta de %s', (status, label) => {
  expect(mealStatus({ noteText: status === 'SIN_ANOTAR' ? null : 'pan', status }).label).toBe(label)
})
test('describe faltas y excesos con una etiqueta corta', () => {
  const status = mealStatus({ noteText: 'pan', comparison: [missing, extra] })
  expect(status.label).toBe('Faltó y de más')
  expect(status.text).toBe('Faltó 1 porción de Cereales · De más: 2 porciones de Proteínas')
  expect(status.kind).toBe('warn')
})
test('respeta el margen del backend y prioriza lo pendiente', () => {
  expect(mealStatus({ noteText: 'pan', comparison: [{ ...missing, status: 'EN_PLAN' }] }).label).toBe('Como el plan')
  expect(mealStatus({ noteText: 'pan', comparison: [missing, { ...extra, status: 'PREGUNTAR' }] }).label).toBe('Por confirmar')
  expect(mealStatus(undefined).label).toBe('Sin anotar')
  expect(mealStatus({ noteText: 'pan', comparison: [] }).label).toBe('Anotada')
})
test('nombra grupos sin nombre y cantidades fraccionarias', () => {
  expect(mealStatus({ noteText: 'pan', comparison: [{ ...missing, name: '', recorded: 1.5 }] }).text)
    .toBe('Faltó 0,5 porciones de un grupo del plan')
})

test.each([
  [[missing], 'Faltó algo', 'Faltó 1 porción de Cereales', 'warn', 'half'],
  [[extra], 'De más', 'De más: 2 porciones de Proteínas', 'warn', 'half'],
  [[{ ...missing, status: 'EN_PLAN' }], 'Como el plan', 'Como el plan', 'ok', 'full'],
  [[{ ...missing, status: 'PREGUNTAR' }], 'Por confirmar', 'Por confirmar', 'ask', 'half'],
  [[], 'Anotada', 'Anotada', 'noted', 'noted'],
] as const)('comparte estado, detalle e indicador de %s', (comparison, label, text, kind, crumb) => {
  expect(mealStatus({ noteText: 'pan', comparison: [...comparison] })).toEqual({ label, text, kind, crumb })
})

test('una nota vacía prevalece sobre la comparación y los códigos antiguos tienen respaldo', () => {
  expect(mealStatus({ noteText: '', comparison: [extra], status: 'DE_MAS' })).toEqual({
    label: 'Sin anotar', text: 'Sin anotar', kind: 'none', crumb: 'empty',
  })
  expect(mealStatus({ noteText: 'pan', status: 'DESCONOCIDO' }).label).toBe('Anotada')
})

test('respeta el estado calculado por el backend aunque la comida no tenga nota', () => {
  expect(mealStatus({ noteText: null, status: 'EN_PLAN' }).label).toBe('Como el plan')
  expect(mealStatus({ noteText: null, status: 'CASI' }).label).toBe('Faltó algo')
  expect(mealStatus({ noteText: null }).label).toBe('Sin anotar')
})
