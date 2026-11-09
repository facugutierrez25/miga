import { useCallback } from 'react'
import { getDayRecord, type DayRecordDto } from '../api/records'
import { useResource } from './useResource'

const isEmpty = (day: DayRecordDto) => day.meals.every(meal => !meal.noteText && meal.items.length === 0)
export function useDayRecord(token: string | null, user: string | null, date: string) {
  const load = useCallback((signal: AbortSignal) => getDayRecord(token!, date, signal), [token, date])
  return useResource(JSON.stringify([user, token, date]), !!token, load, isEmpty)
}
