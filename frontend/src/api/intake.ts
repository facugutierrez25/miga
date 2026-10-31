import { apiRequest } from './client'

export interface FoodEntryDto {
  id: number
  mealId: number
  food: string
  quantity: number
  unit: string
  foodGroupId: number
  consumed: boolean
  portions: number | null
}

export async function getIntake(token: string, date: string, signal?: AbortSignal): Promise<FoodEntryDto[]> {
  return apiRequest(`/api/v1/intake/${date}`, { errorMessage: 'Error al cargar el registro de ingesta.', token, signal })
}

export async function addFoodEntry(
  token: string,
  date: string,
  mealId: number,
  food: string,
  quantity: number,
  unit: string,
  foodGroupId: number,
): Promise<FoodEntryDto> {
  return apiRequest(`/api/v1/intake/${date}/${mealId}`, { errorMessage: 'Error al registrar.', token, method: 'POST', body: { food, quantity, unit, foodGroupId } })
}

export async function deleteFoodEntry(token: string, id: number): Promise<void> {
  return apiRequest(`/api/v1/intake/entries/${id}`, { errorMessage: 'Error al eliminar.', token, method: 'DELETE' })
}

export async function markMealConsumed(token: string, date: string, mealId: number): Promise<void> {
  return apiRequest(`/api/v1/intake/${date}/${mealId}/consumed`, { errorMessage: 'Error al marcar como comido.', token, method: 'PUT' })
}

export async function unmarkMealConsumed(token: string, date: string, mealId: number): Promise<void> {
  return apiRequest(`/api/v1/intake/${date}/${mealId}/consumed`, { errorMessage: 'Error al desmarcar.', token, method: 'DELETE' })
}
