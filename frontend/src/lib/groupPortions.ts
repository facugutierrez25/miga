export interface GroupPortionRow {
  foodGroupId: string
  portions: string
}

// Cada editor conserva sus etiquetas y sus límites originales.
export function validGroupPortions(rows: GroupPortionRow[], groups?: Record<number, { name: string }>): boolean {
  const distinct = new Set(rows.map(row => row.foodGroupId)).size === rows.length
  if (!groups) return rows.length >= 2 && distinct
    && rows.every(row => row.foodGroupId && Number(row.portions) > 0)
  return rows.length >= 1 && rows.length <= 10 && distinct
    && rows.every(row => groups[Number(row.foodGroupId)] && Number(row.portions) >= 0.5
      && Number.isFinite(Number(row.portions)) && Number(row.portions) % 0.5 === 0)
}

