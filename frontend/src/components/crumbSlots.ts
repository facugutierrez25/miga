export interface CrumbRow {
  id: number | string
  name: string
  color: string
  done: number
  total: number
  status?: string
}

// Un plan admite hasta 12 porciones por comida: es lo que entra en la ficha de dominó.
export const MAX_CARD_PORTIONS = 12

export function formatPortions(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace('.', ',')
}

// Una miga por porción del plan; la última puede ser media si el plan tiene media porción.
export function crumbSlots(done: number, total: number): { capacity: number; filled: number }[] {
  const slots = Math.ceil(total)
  const effectiveDone = Math.min(done, total)
  return Array.from({ length: slots }, (_, i) => {
    const capacity = Math.min(1, total - i)
    return { capacity, filled: Math.max(0, Math.min(capacity, effectiveDone - i)) }
  })
}

export function crumbsLabel(row: CrumbRow): string {
  const extra = row.done > row.total ? `, ${formatPortions(row.done - row.total)} de más` : ''
  return `${row.name}: ${formatPortions(row.done)} de ${formatPortions(row.total)} porciones${extra}`
}

// Lo que falta o sobra en una comida, según el estado que calcula el backend con el margen del plan.
export function crumbDifference(row: CrumbRow): string {
  return (row.status === 'CASI' || row.status === 'SIN_ANOTAR') ? `falta ${formatPortions(row.total - row.done)}`
    : row.status === 'DE_MAS' ? `${formatPortions(row.done - row.total)} de más` : ''
}

export function crumbDifferenceLabel(row: CrumbRow): string {
  const difference = crumbDifference(row)
  return `${row.name}: ${formatPortions(row.done)} de ${formatPortions(row.total)}${row.status === 'PREGUNTAR' ? ', por confirmar' : ''}${difference ? `, ${difference}` : ''}`
}
