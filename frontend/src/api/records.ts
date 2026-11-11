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
}

export interface NoteInterpretationDto {
  status: MealStatusCode
  noteId: number
  version: number
  text: string
  date: string
  mealId: number
  items: InterpretedItemDto[]
  entries: EntryItemDto[]
  comparison: GroupStatusDto[]
}

// Tipo de la regla que se aplicó a un ítem.
export type RuleType = 'NORMAL' | 'COMPUESTO' | 'LIBRE' | 'FLEXIBLE' | 'NO_CUENTA' | 'PREGUNTAR'

// De dónde salió esa regla: el plan, el catálogo base o una corrección guardada por la persona.
export type RuleSource = 'PLAN' | 'CATALOGO' | 'USUARIO'

export const ItemOrigin = {
  UNKNOWN: 'UNKNOWN',
  MENTION: 'MENTION',
  ANSWER: 'RESPUESTA',
  USER: 'USUARIO',
  RULE: 'REGLA',
} as const

export type ItemOrigin = typeof ItemOrigin[keyof typeof ItemOrigin]

export interface EntryItemDto {
  id: number
  food: string
  quantity: number | null
  unit: string | null
  foodGroupId: number | null
  portions: number | null
  origin: ItemOrigin | (string & {})
  uncertain: boolean
  originalText?: string | null
  appliedRule?: string | null
  occurrenceId?: string | null
  ruleType?: RuleType | null
  ruleSource?: RuleSource | null
}

export interface DailySummaryDto {
  foodGroupId: number
  name: string
  clave: string
  totalRecorded: number
}

export type MealStatusCode = 'EN_PLAN' | 'CASI' | 'DE_MAS' | 'MIXED' | 'PREGUNTAR' | 'REGISTRADA' | 'SIN_ANOTAR' | 'FLEXIBLE'

export interface MealDayDto {
  status: MealStatusCode
  mealId: number
  noteId: number | null
  noteVersion: number | null
  noteText: string | null
  items: EntryItemDto[]
  comparison: GroupStatusDto[]
}

export interface DayRecordDto {
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
  status: MealStatusCode
  replacedItemIds: number[]
  items: EntryItemDto[]
}

// Lo que la persona escribió y no se reconoció.
export interface UnmatchedFoodDto {
  texto: string
  fecha: string
  comida: string
}

export interface AnswerRequest {
  foodGroupId: number
  consumed: boolean
}

// ── Funciones de API ──────────────────────────────────────────────────────

export async function getDayRecord(
  token: string,
  date: string,
  signal?: AbortSignal,
): Promise<DayRecordDto> {
  return apiRequest(`/api/v1/registro/${date}`, { errorMessage: 'Error al cargar el registro del día.', token, signal })
}

export class NoteConflictError extends ApiError {
  constructor(message: string, details: Record<string, unknown> = {}) { super(409, message, details) }
}

export async function saveNote(
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
export async function deleteNote(
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

export async function saveAnswer(
  token: string,
  date: string,
  mealId: number,
  req: AnswerRequest,
): Promise<void> {
  return apiRequest(`/api/v1/registro/${date}/comidas/${mealId}/respuestas`, { errorMessage: 'Error al guardar la respuesta.', token, method: 'POST', body: req })
}

export function answerFlexible(token: string, date: string, itemId: number, flexible: boolean): Promise<PatchItemResultDto> {
  return apiRequest(`/api/v1/registro/${date}/items/${itemId}/flexible`, {
    token, method: 'POST', body: { flexible }, errorMessage: 'No se pudo guardar la respuesta.',
  })
}

export async function getSuggestions(
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

// Lo anotado entre dos fechas (YYYY-MM-DD, inclusive) que ninguna regla reconoció.
export async function getUnmatchedFoods(
  token: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<UnmatchedFoodDto[]> {
  const query = `desde=${encodeURIComponent(from)}&hasta=${encodeURIComponent(to)}`
  return apiRequest(`/api/v1/registro/sin-regla?${query}`, { errorMessage: 'Error al cargar lo que no se reconoció.', token, signal })
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

export interface ResolveItemRequest {
  kind: 'SAME_AS' | 'GROUPS' | 'FLEXIBLE' | 'NOT_COUNTED'
  ruleUid?: string
  groups?: { foodGroupId: number; portions: number }[]
  remember: boolean
}

export interface ResolveUndoDto { occurrenceId: string; ruleUid: string | null }
export interface ResolveItemResultDto extends PatchItemResultDto { undo: ResolveUndoDto }

export function resolveItem(token: string, date: string, itemId: number, body: ResolveItemRequest): Promise<ResolveItemResultDto> {
  return apiRequest(`/api/v1/registro/${date}/items/${itemId}/resolve`, { token, method: 'POST', body, errorMessage: 'No se pudo guardar.' })
}

export function undoResolveItem(token: string, date: string, body: ResolveUndoDto): Promise<PatchItemResultDto> {
  return apiRequest(`/api/v1/registro/${date}/items/resolve/undo`, { token, method: 'POST', body, errorMessage: 'No se pudo deshacer.' })
}
