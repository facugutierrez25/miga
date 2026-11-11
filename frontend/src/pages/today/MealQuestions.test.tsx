import { mockGetMyPlan, mockGetDayRecord, planWithMeal, renderToday, openNote } from './test-utils'
import { act, screen, fireEvent } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import * as recordsApi from '../../api/records'

test.each([true, false])('responde si el catálogo cuenta como flexible desde Hoy (%s)', async flexible => {
  const item: recordsApi.EntryItemDto = { id: 7, food: 'jamón', quantity: 60, unit: 'g',
    foodGroupId: 1, portions: 1, origin: 'REGLA', countsFlexible: false, uncertain: false, ruleType: 'PREGUNTAR', ruleSource: 'CATALOGO' }
  const updated = { ...item, ruleType: flexible ? 'FLEXIBLE' as const : 'NORMAL' as const, ruleSource: 'USUARIO' as const }
  vi.mocked(recordsApi.answerFlexible).mockResolvedValue({ replacedItemIds: [7], items: [updated],
    status: flexible ? 'FLEXIBLE' : 'REGISTRADA' })
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  mockGetDayRecord.mockResolvedValue({ date: '2025-01-01', summary: [], meals: [{ mealId: 1,
    status: 'PREGUNTAR', noteId: 1, noteText: '60 g jamón', noteVersion: 1, items: [item], comparison: [] }] })
  renderToday()
  await openNote()
  expect(screen.getByText('¿Tu plan cuenta «jamón» como comida flexible?')).toBeInTheDocument()
  mockGetDayRecord.mockResolvedValue({ date: '2025-01-01', summary: [], meals: [{ mealId: 1,
    status: flexible ? 'FLEXIBLE' : 'REGISTRADA', noteId: 1, noteText: '60 g jamón', noteVersion: 1,
    items: [updated], comparison: [] }] })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: flexible ? 'Sí' : 'No' })) })
  expect(recordsApi.answerFlexible).toHaveBeenCalledWith('tok', expect.any(String), 7, flexible)
  expect(screen.queryByText('¿Tu plan cuenta «jamón» como comida flexible?')).not.toBeInTheDocument()
})
test.each([true, false])('responde antes de guardar y reconcilia o revierte la pregunta: %s', async success => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const request = vi.mocked(recordsApi.saveAnswer).mockReturnValue(new Promise<void>((res, rej) => { resolve = res; reject = rej }))
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const day = {
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, status: 'PREGUNTAR' as const, noteId: 1, noteText: 'leche', noteVersion: 1, items: [],
      comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 1, recorded: 0, status: 'PREGUNTAR' }] }],
  }
  mockGetDayRecord.mockResolvedValue(day)
  renderToday()
  await openNote()
  fireEvent.click(screen.getByRole('button', { name: 'Sí' }))
  expect(screen.queryByRole('button', { name: 'Sí' })).not.toBeInTheDocument()
  expect(request).toHaveBeenCalledTimes(1)
  if (success) mockGetDayRecord.mockResolvedValue({ ...day, meals: [{ ...day.meals[0], comparison: [] }] })
  await act(async () => { if (success) resolve(); else reject(new Error('offline')) })
  if (success) {
    expect(screen.queryByRole('button', { name: 'Sí' })).not.toBeInTheDocument()
    expect(mockGetDayRecord).toHaveBeenCalledTimes(2)
  } else {
    expect(screen.getByRole('button', { name: 'Sí' })).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar la respuesta')
  }
})
