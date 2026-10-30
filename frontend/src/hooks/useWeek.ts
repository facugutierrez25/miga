import { useCallback } from 'react'
import { getWeek, type WeekSummaryDto } from '../api/semana'
import { useResource } from './useResource'

const isEmpty = (week: WeekSummaryDto) => week.habits.length === 0 && week.days.every(day => !day.hasData)
export function useWeek(token: string | null, user: string | null, date: string) {
  const load = useCallback((signal: AbortSignal) => getWeek(token!, date, signal), [token, date])
  return useResource(JSON.stringify([user, token, date]), !!token, load, isEmpty)
}
