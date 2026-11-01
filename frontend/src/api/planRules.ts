import { apiRequest, ApiError } from './client'

export interface PlanGroup {
  id: number; uid: string; name: string; abbreviation: string; displayOrder: number
  color: string | null; clave: string | null; preguntarSiFalta: boolean; opcional: boolean
}
export interface Component { groupUid: string; porciones: number }
export type RuleType = 'NORMAL' | 'COMPUESTO' | 'LIBRE' | 'FLEXIBLE' | 'NO_CUENTA'
export interface FoodInput {
  alimento: string; sinonimos: string[]; tipo: RuleType; groupUid: string | null
  cantidadPorPorcion: number | null; unidad: string | null; porcionPorDefecto: number | null
  componentes: Component[]; overridesRuleUid: string | null
}
export interface FoodRule extends FoodInput { uid: string; alcance: string; textoRegla: string }
export interface HabitInput { countsFlexibleMeals?: boolean; name: string; habitType: 'CONTADOR' | 'SI_NO' | 'CANTIDAD'; unit: string | null; goal: number | null; period: 'DIA' | 'SEMANA'; step: number }
export interface Habit extends HabitInput { uid: string; id: number; displayOrder: number }
export interface PlanRules { planId: number; planVersion: number; modoRegistro: string; grupos: PlanGroup[]; alimentos: FoodRule[]; habitos: Habit[] }
export interface GroupInput { name: string; abbreviation?: string; clave: string | null; color: string | null; preguntarSiFalta: boolean; opcional: boolean }
export interface CatalogItem { uid: string; alcance: string; alimento: string; sinonimos: string[]; tipo: RuleType; groupUid: string | null; textoRegla: string; ajustadoPorUid: string | null }
export type ErrorCode = 'VERSION_CONFLICT' | 'GROUP_IN_USE' | 'DUPLICATE' | 'VALIDATION' | 'NOT_FOUND'
export class PlanRulesError extends ApiError {
  declare readonly code: ErrorCode
  declare readonly error: string
  readonly comidas?: number
  readonly alimentos?: number
  constructor(code: ErrorCode, error: string, comidas?: number, alimentos?: number, status = 409) {
    super(status, error, { code, error, comidas, alimentos })
    this.comidas = comidas
    this.alimentos = alimentos
  }
}
async function request<T>(token: string, path: string, method = 'GET', body?: unknown): Promise<T> {
  try {
    return await apiRequest<T>(`/api/v1/my-plan${path}`, { token, method, body })
  } catch (err) {
    if (!(err instanceof ApiError)) throw err
    throw new PlanRulesError(err.code as ErrorCode, err.error ?? 'No se pudo guardar. Intentá de nuevo.',
      typeof err.details.comidas === 'number' ? err.details.comidas : undefined,
      typeof err.details.alimentos === 'number' ? err.details.alimentos : undefined, err.status)
  }
}
export const getPlanRules = (token: string) => request<PlanRules>(token, '/reglas')
export const createGroup = (token: string, body: GroupInput & { planVersion: number }) => request<PlanRules>(token, '/grupos', 'POST', body)
export const updateGroup = (token: string, uid: string, body: GroupInput & { planVersion: number }) => request<PlanRules>(token, `/grupos/${uid}`, 'PUT', body)
export const reorderGroups = (token: string, body: { planVersion: number; uids: string[] }) => request<PlanRules>(token, '/grupos/orden', 'PUT', body)
export const deleteGroup = (token: string, uid: string, planVersion: number) => request<PlanRules>(token, `/grupos/${uid}?planVersion=${planVersion}`, 'DELETE')
export const createFood = (token: string, body: FoodInput & { planVersion: number }) => request<PlanRules>(token, '/alimentos', 'POST', body)
export const updateFood = (token: string, uid: string, body: FoodInput & { planVersion: number }) => request<PlanRules>(token, `/alimentos/${uid}`, 'PUT', body)
export const deleteFood = (token: string, uid: string, planVersion: number) => request<PlanRules>(token, `/alimentos/${uid}?planVersion=${planVersion}`, 'DELETE')
export const searchCatalog = (token: string, q: string) => request<CatalogItem[]>(token, `/catalogo?q=${encodeURIComponent(q)}`)
export const adjustFromCatalog = (token: string, uid: string, planVersion: number) => request<PlanRules>(token, `/catalogo/${uid}/ajustar`, 'POST', { planVersion })
export const createHabit = (token: string, body: HabitInput & { planVersion: number }) => request<PlanRules>(token, '/habitos', 'POST', body)
export const updateHabit = (token: string, uid: string, body: HabitInput & { planVersion: number }) => request<PlanRules>(token, `/habitos/${uid}`, 'PUT', body)
export const deleteHabit = (token: string, uid: string, planVersion: number) => request<PlanRules>(token, `/habitos/${uid}?planVersion=${planVersion}`, 'DELETE')
