const API_URL = import.meta.env.VITE_API_URL ?? ''

export type FoodGroup = 'PROTEINS' | 'GRAINS' | 'FRUITS' | 'DAIRY' | 'FATS' | 'VEGETABLES'

export interface MealPortionDto {
  foodGroup: FoodGroup
  portions: number
}

export interface MealDto {
  name: string
  suggestedTime?: string
  displayOrder: number
  portions: MealPortionDto[]
}

export interface PlanDto {
  meals: MealDto[]
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
  meals: MealSummaryDto[]
}

export async function getPlanHistory(token: string): Promise<PlanSummaryDto[]> {
  const res = await fetch(`${API_URL}/api/v1/my-plan/historial`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al cargar el historial.')
  return res.json()
}

export async function saveMyPlan(token: string, plan: PlanDto): Promise<PlanDto> {
  const res = await fetch(`${API_URL}/api/v1/my-plan`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(plan),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body}`)
  }
  return res.json()
}
