const API_URL = import.meta.env.VITE_API_URL ?? ''

export async function getTodayLog(token: string): Promise<number[]> {
  const res = await fetch(`${API_URL}/api/v1/registro/hoy`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al cargar el registro de hoy.')
  return res.json()
}

export async function markMealEaten(token: string, mealId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/registro/hoy/${mealId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al marcar la comida.')
}

export async function unmarkMealEaten(token: string, mealId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/registro/hoy/${mealId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al desmarcar la comida.')
}
