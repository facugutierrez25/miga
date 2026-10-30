const API_URL = import.meta.env.VITE_API_URL ?? ''

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

export async function getIntake(token: string, date: string): Promise<FoodEntryDto[]> {
  const res = await fetch(`${API_URL}/api/v1/intake/${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al cargar el registro de ingesta.')
  return res.json()
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
  const res = await fetch(`${API_URL}/api/v1/intake/${date}/${mealId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ food, quantity, unit, foodGroupId }),
  })
  if (!res.ok) throw new Error('Error al registrar.')
  return res.json()
}

export async function deleteFoodEntry(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/intake/entries/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al eliminar.')
}

export async function markMealConsumed(token: string, date: string, mealId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/intake/${date}/${mealId}/consumed`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al marcar como comido.')
}

export async function unmarkMealConsumed(token: string, date: string, mealId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/intake/${date}/${mealId}/consumed`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al desmarcar.')
}
