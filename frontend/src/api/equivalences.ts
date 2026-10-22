import type { FoodGroup } from './plans'

export type Unit = 'G' | 'ML' | 'UNIDAD' | 'TAZA'

export interface EquivalenceDto {
  id: number
  foodGroup: FoodGroup
  food: string
  quantity: number
  unit: Unit
}

const API_URL = import.meta.env.VITE_API_URL ?? ''
const BASE = `${API_URL}/api/v1/equivalences`

export async function getEquivalences(token: string): Promise<EquivalenceDto[]> {
  const res = await fetch(BASE, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('equivalences-fetch-error')
  return res.json()
}

export async function addEquivalence(
  token: string,
  foodGroup: FoodGroup,
  food: string,
  quantity: number,
  unit: Unit,
): Promise<EquivalenceDto> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ foodGroup, food, quantity, unit }),
  })
  if (!res.ok) throw new Error('equivalences-add-error')
  return res.json()
}

export async function deleteEquivalence(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('equivalences-delete-error')
}
