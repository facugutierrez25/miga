import { apiRequest, ApiError } from './client'

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
  version: number
  text: string
  date: string
  mealId: number
  items: InterpretedItemDto[]
  entries: EntryItemDto[]
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
  originalText?: string | null
  appliedRule?: string | null
  occurrenceId?: string | null
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
  noteVersion: number | null
  noteText: string | null
  items: EntryItemDto[]
  comparison: GroupStatusDto[]
}

export interface DayRegistroDto {
  date: string
  meals: MealDayDto[]
  summary: DailySummaryDto[]
}

export interface GroupPortion {
  foodGroupId: number
  porciones: number
}

export interface PatchItemRequest {
  quantity?: number | null
  unit?: string | null
  foodGroupId?: number | null
  portions?: number | null
  grupos?: GroupPortion[]
  saveAsRule?: boolean
}

export interface PatchItemResultDto {
  replacedItemIds: number[]
  items: EntryItemDto[]
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
  return apiRequest(`/api/v1/registro/${date}`, { errorMessage: 'Error al cargar el registro del día.', token, signal })
}

export class NoteConflictError extends ApiError {
  constructor(message: string, details: Record<string, unknown> = {}) { super(409, message, details) }
}

export async function saveNota(
  token: string,
  date: string,
  mealId: number,
  text: string,
  version: number | null,
): Promise<NoteInterpretationDto> {
  try {
    return await apiRequest(`/api/v1/registro/${date}/comidas/${mealId}/nota`, { errorMessage: 'Error al guardar la nota.', token, method: 'PUT', body: { text, version } })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && (err.code === 'NOTE_CONFLICT' || err.code === 'PLAN_CHANGED')) throw new NoteConflictError(err.error ?? err.message, err.details)
    throw err
  }

}

// Borra la nota de una comida y todo lo registrado en ella ese día.
export async function deleteNota(
  token: string,
  date: string,
  mealId: number,
  version: number | null,
): Promise<number | null> {
  const query = version === null ? '' : `?version=${version}`
  try {
    const result = await apiRequest<{ version: number | null }>(`/api/v1/registro/${date}/comidas/${mealId}/nota${query}`, { errorMessage: 'No se pudo borrar lo anotado.', token, method: 'DELETE' })
    return result.version
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && (err.code === 'NOTE_CONFLICT' || err.code === 'PLAN_CHANGED')) throw new NoteConflictError(err.error ?? err.message, err.details)
    throw err
  }
}

export async function patchItem(
  token: string,
  date: string,
  itemId: number,
  req: PatchItemRequest,
): Promise<PatchItemResultDto> {
  return apiRequest(`/api/v1/registro/${date}/items/${itemId}`, { errorMessage: 'Error al actualizar el ítem.', token, method: 'PATCH', body: req })
}

export async function saveRespuesta(
  token: string,
  date: string,
  mealId: number,
  req: RespuestaRequest,
): Promise<void> {
  return apiRequest(`/api/v1/registro/${date}/comidas/${mealId}/respuestas`, { errorMessage: 'Error al guardar la respuesta.', token, method: 'POST', body: req })
}

export async function getSugerencias(
  token: string,
  mealId: number,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    return await apiRequest(`/api/v1/registro/sugerencias?mealId=${mealId}`, { token, signal })
  } catch (err) {
    if (err instanceof ApiError) return []
    throw err
  }
}

export async function removeItem(
  token: string,
  date: string,
  itemId: number,
  version: number | null,
): Promise<MealDayDto> {
  const query = version === null ? '' : `?version=${version}`
  try {
    return await apiRequest(`/api/v1/registro/${date}/items/${itemId}${query}`, { errorMessage: 'No se pudo quitar el alimento.', token, method: 'DELETE' })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && (err.code === 'NOTE_CONFLICT' || err.code === 'PLAN_CHANGED')) throw new NoteConflictError(err.error ?? err.message, err.details)
    throw err
  }
}
