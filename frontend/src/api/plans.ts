const API_URL = import.meta.env.VITE_API_URL ?? ''

export interface PlanFoodGroupDto {
  id: number
  name: string
  abbreviation: string
  displayOrder: number
  color: string | null
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
  foodGroups: PlanFoodGroupDto[]
  meals: MealDto[]
  version?: number
}

export interface PlanSaveDto {
  meals: MealSaveDto[]
  clientVersion?: number
}

export class PlanConflictError extends Error {
  constructor() {
    super('PLAN_CONFLICT')
    this.name = 'PlanConflictError'
  }
}

export async function getMyPlan(token: string): Promise<PlanDto> {
  const res = await fetch(`${API_URL}/api/v1/my-plan`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) throw new Error('sin-plan')
  if (!res.ok) throw new Error('Error al cargar el plan.')
  return res.json()
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

export async function getPlanHistory(token: string): Promise<PlanSummaryDto[]> {
  const res = await fetch(`${API_URL}/api/v1/my-plan/historial`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al cargar el historial.')
  return res.json()
}

export async function saveMyPlan(token: string, plan: PlanSaveDto): Promise<PlanDto> {
  const res = await fetch(`${API_URL}/api/v1/my-plan`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(plan),
  })
  if (res.status === 409) throw new PlanConflictError()
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body}`)
  }
  return res.json()
}
