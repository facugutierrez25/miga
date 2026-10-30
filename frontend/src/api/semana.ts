import { apiRequest } from './client'

export interface HabitDto {
  id: number
  name: string
  habitType: string
  unit: string | null
  dailyGoal: number | null
  step: number
  period: string
  countsFlexibleMeals?: boolean
  displayOrder: number
}

export interface HabitLogDto {
  habitId: number
  date: string
  value: number
}

export interface WeekDayDto {
  date: string
  hasData: boolean
  totalRecorded: number
  totalGoal: number
  habitLogs: HabitLogDto[]
  habitIds?: number[]
  meals?: { mealId: number; name: string; noteText: string | null; status: string }[]
}

export interface WeekSummaryDto {
  weekStart: string
  weekEnd: string
  habits: HabitDto[]
  days: WeekDayDto[]
}

export async function getWeek(token: string, date?: string, signal?: AbortSignal): Promise<WeekSummaryDto> {
  const url = date
    ? `/api/v1/semana?date=${date}`
    : `/api/v1/semana`
  return apiRequest(url, { errorMessage: 'Error al cargar la semana.', token, signal })
}

export async function getHabits(token: string): Promise<HabitDto[]> {
  return apiRequest(`/api/v1/habitos`, { errorMessage: 'Error al cargar los hábitos.', token })
}

export async function logHabit(
  token: string,
  habitId: number,
  date: string,
  value: number,
): Promise<HabitLogDto> {
  return apiRequest(`/api/v1/habitos/${habitId}/log?date=${date}`, { errorMessage: 'Error al registrar el hábito.', token, method: 'PUT', body: { value } })
}

export async function exportWeek(token: string, weekStart: string, format: 'csv' | 'xlsx' = 'csv'): Promise<void> {
  const blob = await apiRequest<Blob>(`/api/v1/semana/export?date=${weekStart}&format=${format}`, { errorMessage: 'Error al exportar.', token, responseType: 'blob' })
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `semana-${weekStart}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportWeekCsv(token: string, weekStart: string): Promise<void> {
  return exportWeek(token, weekStart, 'csv')
}
