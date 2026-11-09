import { mockGetMyPlan, mockGetDayRecord, planWithMeal, renderToday, openNote } from './test-utils'
import { act, screen, fireEvent } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import * as recordsApi from '../../api/records'
test.each([true, false])('responde antes de guardar y reconcilia o revierte la pregunta: %s', async success => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const request = vi.mocked(recordsApi.saveAnswer).mockReturnValue(new Promise<void>((res, rej) => { resolve = res; reject = rej }))
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const day = {
    date: '2025-01-01', summary: [],
    meals: [{ mealId: 1, noteId: 1, noteText: 'leche', noteVersion: 1, items: [],
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
