import { expect, test } from 'vitest'
import { mealStatus } from './mealStatus'
import type { GroupStatusDto } from '../api/records'

const missing: GroupStatusDto = { foodGroupId: 1, name: 'Cereales', expected: 2, recorded: 1, status: 'CASI' }
const extra: GroupStatusDto = { foodGroupId: 2, name: 'Proteínas', expected: 1, recorded: 3, status: 'DE_MAS' }

test.each([
  ['EN_PLAN', 'Como el plan'], ['CASI', 'Faltó algo'], ['DE_MAS', 'De más'],
  ['MIXED', 'Faltó y de más'], ['FLEXIBLE', 'Flexible'], ['PREGUNTAR', 'Por confirmar'], ['SIN_ANOTAR', 'Sin anotar'], ['REGISTRADA', 'Anotada'],
])('comparte la etiqueta de %s', (status, label) => {
  expect(mealStatus({ noteText: status === 'SIN_ANOTAR' ? null : 'pan', status }).label).toBe(label)
})
test('describe faltas y excesos con una etiqueta corta', () => {
  const status = mealStatus({ status: 'MIXED', noteText: 'pan', comparison: [missing, extra] })
  expect(status.label).toBe('Faltó y de más')
  expect(status.text).toBe('Faltó 1 porción de Cereales · De más: 2 porciones de Proteínas')
  expect(status.kind).toBe('warn')
})
test('respeta el margen del backend y prioriza lo pendiente', () => {
  expect(mealStatus({ status: 'EN_PLAN', noteText: 'pan', comparison: [{ ...missing, status: 'EN_PLAN' }] }).label).toBe('Como el plan')
  expect(mealStatus({ status: 'PREGUNTAR', noteText: 'pan', comparison: [missing, { ...extra, status: 'PREGUNTAR' }] }).label).toBe('Por confirmar')
  expect(mealStatus(undefined).label).toBe('Sin anotar')
  expect(mealStatus({ status: 'REGISTRADA', noteText: 'pan', comparison: [] }).label).toBe('Anotada')
})
test('nombra grupos sin nombre y cantidades fraccionarias', () => {
  expect(mealStatus({ status: 'CASI', noteText: 'pan', comparison: [{ ...missing, name: '', recorded: 1.5 }] }).text)
    .toBe('Faltó 0,5 porciones de un grupo del plan')
})

test.each([
  ['CASI', [missing], 'Faltó algo', 'Faltó 1 porción de Cereales', 'warn', 'half'],
  ['DE_MAS', [extra], 'De más', 'De más: 2 porciones de Proteínas', 'warn', 'half'],
  ['EN_PLAN', [{ ...missing, status: 'EN_PLAN' }], 'Como el plan', 'Como el plan', 'ok', 'full'],
  ['PREGUNTAR', [{ ...missing, status: 'PREGUNTAR' }], 'Por confirmar', 'Por confirmar', 'ask', 'half'],
  ['REGISTRADA', [], 'Anotada', 'Anotada', 'noted', 'noted'],
] as const)('comparte estado, detalle e indicador de %s', (status, comparison, label, text, kind, crumb) => {
  expect(mealStatus({ status, noteText: 'pan', comparison: [...comparison] })).toEqual({ label, text, kind, crumb })
})

test('el estado del backend prevalece sobre la nota y la comparación y los códigos antiguos tienen respaldo', () => {
  expect(mealStatus({ noteText: '', comparison: [extra], status: 'DE_MAS' })).toEqual({
    label: 'De más', text: 'De más: 2 porciones de Proteínas', kind: 'warn', crumb: 'half',
  })
  expect(mealStatus({ noteText: 'pan', status: 'DESCONOCIDO' }).label).toBe('Anotada')
})

test('respeta el estado calculado por el backend aunque la comida no tenga nota', () => {
  expect(mealStatus({ noteText: null, status: 'EN_PLAN' }).label).toBe('Como el plan')
  expect(mealStatus({ noteText: null, status: 'CASI' }).label).toBe('Faltó algo')
  expect(mealStatus({ noteText: null }).label).toBe('Sin anotar')
})

test('el backend decide el estado aunque contradiga la comparación', () => {
  expect(mealStatus({ noteText: 'pan', status: 'FLEXIBLE', comparison: [missing, extra] }).label).toBe('Flexible')
  expect(mealStatus({ noteText: 'pan', status: 'EN_PLAN', comparison: [missing, extra] }).label).toBe('Como el plan')
})


test.each([0, 1])('flexible conserva su estado y describe grupos con porciones: %s', recorded => {
  const result = mealStatus({ status: 'FLEXIBLE', noteText: 'pizza', comparison: [
    { foodGroupId: 1, name: 'Proteínas', expected: 2, recorded, status: 'CASI' },
  ] })
  expect(result.label).toBe('Flexible')
  expect(result.crumb).toBe('flexible')
  expect(result.text).toBe(recorded ? 'Faltó 1 porción de Proteínas' : 'Flexible')
})
