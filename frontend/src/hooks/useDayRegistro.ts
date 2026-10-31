import { useCallback } from 'react'
import { getDayRegistro, type DayRegistroDto } from '../api/registro'
import { useResource } from './useResource'

const isEmpty = (day: DayRegistroDto) => day.meals.every(meal => !meal.noteText && meal.items.length === 0)
export function useDayRegistro(token: string | null, user: string | null, date: string) {
  const load = useCallback((signal: AbortSignal) => getDayRegistro(token!, date, signal), [token, date])
  return useResource(JSON.stringify([user, token, date]), !!token, load, isEmpty)
}
