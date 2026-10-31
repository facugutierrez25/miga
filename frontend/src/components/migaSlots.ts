export interface MigaRow {
  id: number | string
  name: string
  color: string
  done: number
  total: number
}

export function formatPortions(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace('.', ',')
}

// Una miga por porción del plan; la última puede ser media si el plan tiene media porción.
export function migaSlots(done: number, total: number): { capacity: number; filled: number }[] {
  const slots = Math.ceil(total)
  const effectiveDone = Math.min(done, total)
  return Array.from({ length: slots }, (_, i) => {
    const capacity = Math.min(1, total - i)
    return { capacity, filled: Math.max(0, Math.min(capacity, effectiveDone - i)) }
  })
}

export function migasLabel(row: MigaRow): string {
  const extra = row.done > row.total ? `, ${formatPortions(row.done - row.total)} de más` : ''
  return `${row.name}: ${formatPortions(row.done)} de ${formatPortions(row.total)} porciones${extra}`
}
