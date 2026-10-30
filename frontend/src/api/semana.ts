const API_URL = import.meta.env.VITE_API_URL ?? ''

export interface HabitDto {
  id: number
  name: string
  habitType: string
  unit: string | null
  dailyGoal: number | null
  step: number
  period: string
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
}

export interface WeekSummaryDto {
  weekStart: string
  weekEnd: string
  habits: HabitDto[]
  days: WeekDayDto[]
}

export async function getWeek(token: string, date?: string, signal?: AbortSignal): Promise<WeekSummaryDto> {
  const url = date
    ? `${API_URL}/api/v1/semana?date=${date}`
    : `${API_URL}/api/v1/semana`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (!res.ok) throw new Error('Error al cargar la semana.')
  return res.json()
}

export async function getHabits(token: string): Promise<HabitDto[]> {
  const res = await fetch(`${API_URL}/api/v1/habitos`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al cargar los hábitos.')
  return res.json()
}

export async function logHabit(
  token: string,
  habitId: number,
  date: string,
  value: number,
): Promise<HabitLogDto> {
  const res = await fetch(`${API_URL}/api/v1/habitos/${habitId}/log?date=${date}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error('Error al registrar el hábito.')
  return res.json()
}

export async function exportWeekCsv(token: string, weekStart: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/semana/export?date=${weekStart}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al exportar.')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `semana-${weekStart}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
