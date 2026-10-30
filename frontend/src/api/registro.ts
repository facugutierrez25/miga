const API_URL = import.meta.env.VITE_API_URL ?? ''

// ── Legacy endpoints (mantenidos por compatibilidad) ──────────────────────

export async function getLog(token: string, date: string): Promise<number[]> {
  const res = await fetch(`${API_URL}/api/v1/meal-log/${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al cargar el registro.')
  return res.json()
}

export async function markMealEaten(token: string, mealId: number, date: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/meal-log/${date}/${mealId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al marcar la comida.')
}

export async function unmarkMealEaten(token: string, mealId: number, date: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/meal-log/${date}/${mealId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al desmarcar la comida.')
}

// ── Tipos del registro nuevo ──────────────────────────────────────────────

export interface InterpretedItemDto {
  originalText: string
  foodName: string
  quantity: number | null
  unit: string | null
  foodGroupId: number | null
  standardGroupKey: string | null
  portions: number | null
  appliedRule: string | null
  uncertain: boolean
  recognized: boolean
  tipo: string
}

export interface GroupStatusDto {
  foodGroupId: number
  name: string
  expected: number
  recorded: number
  status: string
  dailyGoal: number | null
}

export interface NoteInterpretationDto {
  noteId: number
  text: string
  date: string
  mealId: number
  items: InterpretedItemDto[]
  comparison: GroupStatusDto[]
}

export interface EntryItemDto {
  id: number
  food: string
  quantity: number | null
  unit: string | null
  foodGroupId: number | null
  portions: number | null
  origin: string
  uncertain: boolean
}

export interface DailySummaryDto {
  foodGroupId: number
  name: string
  clave: string
  totalRecorded: number
  dailyGoal: number | null
}

export interface MealDayDto {
  mealId: number
  noteId: number | null
  noteText: string | null
  items: EntryItemDto[]
  comparison: GroupStatusDto[]
}

export interface DayRegistroDto {
  date: string
  meals: MealDayDto[]
  summary: DailySummaryDto[]
}

export interface PatchItemRequest {
  quantity: number | null
  unit: string | null
  foodGroupId: number | null
  portions: number | null
  saveAsRule: boolean
}

export interface RespuestaRequest {
  foodGroupId: number
  consumed: boolean
}

// ── Funciones de API ──────────────────────────────────────────────────────

export async function getDayRegistro(
  token: string,
  date: string,
  signal?: AbortSignal,
): Promise<DayRegistroDto> {
  const res = await fetch(`${API_URL}/api/v1/registro/${date}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (!res.ok) throw new Error('Error al cargar el registro del día.')
  return res.json()
}

export async function saveNota(
  token: string,
  date: string,
  mealId: number,
  text: string,
): Promise<NoteInterpretationDto> {
  const res = await fetch(`${API_URL}/api/v1/registro/${date}/comidas/${mealId}/nota`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('Error al guardar la nota.')
  return res.json()
}

export async function patchItem(
  token: string,
  date: string,
  itemId: number,
  req: PatchItemRequest,
): Promise<EntryItemDto> {
  const res = await fetch(`${API_URL}/api/v1/registro/${date}/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error('Error al actualizar el ítem.')
  return res.json()
}

export async function saveRespuesta(
  token: string,
  date: string,
  mealId: number,
  req: RespuestaRequest,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/registro/${date}/comidas/${mealId}/respuestas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error('Error al guardar la respuesta.')
}

export async function getSugerencias(
  token: string,
  mealId: number,
  signal?: AbortSignal,
): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/v1/registro/sugerencias?mealId=${mealId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (!res.ok) return []
  return res.json()
}
