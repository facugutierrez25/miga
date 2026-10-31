import { apiRequest, ApiError } from './client'

export interface PlanFoodGroupDto {
  id: number
  name: string
  abbreviation: string
  displayOrder: number
  color: string | null
  clave?: string | null
  preguntarSiFalta?: boolean
  opcional?: boolean
  metaDiaria?: number | null
  uid?: string
}

export interface MealPortionDto {
  foodGroupId: number
  portions: number
}

export interface MealPortionInput {
  foodGroupAbbr: string
  portions: number
}

export interface MealDto {
  id?: number
  name: string
  suggestedTime?: string
  displayOrder: number
  portions: MealPortionDto[]
}

export interface MealSaveDto {
  name: string
  suggestedTime?: string
  displayOrder: number
  portions: MealPortionInput[]
}

export interface PlanDto {
  createdAt?: string
  foodGroups: PlanFoodGroupDto[]
  meals: MealDto[]
  version?: number
}

export interface PlanSaveDto {
  meals: MealSaveDto[]
  clientVersion?: number
}

export class PlanConflictError extends ApiError {
  constructor(details: Record<string, unknown> = {}) {
    super(409, 'PLAN_CONFLICT', details)
    this.name = 'PlanConflictError'
  }
}

export async function getMyPlan(token: string, signal?: AbortSignal): Promise<PlanDto> {
  return apiRequest(`/api/v1/my-plan`, { errorMessage: 'Error al cargar el plan.', token, signal, errorMessages: { 404: 'sin-plan' } })
}

export interface MealSummaryDto {
  name: string
  portions: MealPortionDto[]
}

export interface PlanSummaryDto {
  createdAt: string     // YYYY-MM-DD
  supersededAt: string  // YYYY-MM-DD
  mealCount: number
  foodGroups: PlanFoodGroupDto[]
  meals: MealSummaryDto[]
}

export async function getPlanHistory(token: string, signal?: AbortSignal): Promise<PlanSummaryDto[]> {
  return apiRequest(`/api/v1/my-plan/historial`, { errorMessage: 'Error al cargar el historial.', token, signal })
}

export async function saveMyPlan(token: string, plan: PlanSaveDto): Promise<PlanDto> {
  try {
    return await apiRequest(`/api/v1/my-plan`, { token, method: 'PUT', body: plan })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) throw new PlanConflictError(err.details)
    throw err
  }

}
