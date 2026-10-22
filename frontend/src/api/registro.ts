const API_URL = import.meta.env.VITE_API_URL ?? ''

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
