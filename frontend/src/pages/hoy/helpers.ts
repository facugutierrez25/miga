import { groupColor } from '../../groupColors'
import { type MigaRow } from '../../components/migaSlots'
import { type PlanFoodGroupDto, type MealDto } from '../../api/plans'
import { type DayRegistroDto, type DailySummaryDto, type MealDayDto, type EntryItemDto } from '../../api/registro'

export interface GroupInfo {
  name: string
  token: string
}

export function buildGroupsMap(foodGroups: PlanFoodGroupDto[]): Record<number, GroupInfo> {
  return Object.fromEntries(
    foodGroups.map((g, index) => [g.id, {
      name: g.name,
      token: groupColor(g, index),
    }])
  )
}

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  return toISO(d)
}

export function formatLongDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-UY', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export function dateLabel(iso: string, today: string): string {
  if (iso === today) return 'Hoy'
  if (iso === addDays(today, -1)) return 'Ayer'
  const d = new Date(iso + 'T12:00:00')
  const wd = d.toLocaleDateString('es-UY', { weekday: 'short' }).replace(/\./g, '')
  const day = d.getDate()
  const mo = d.toLocaleDateString('es-UY', { month: 'short' }).replace(/\./g, '')
  return `${wd} ${day} ${mo}`
}

export function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

export function formatName(email: string | undefined): string {
  if (!email) return ''
  const local = email.split('@')[0]
  return local
    .replace(/[._+]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

export function findCurrentMealIndex(meals: MealDto[], now: Date): number {
  if (meals.length === 0) return -1
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const byTime = meals
    .map((m, i) => ({ m, i }))
    .find(({ m }) => {
      if (!m.suggestedTime) return false
      const [h, min] = m.suggestedTime.split(':').map(Number)
      const mealMin = h * 60 + min
      return mealMin >= nowMin - 90 && mealMin <= nowMin + 180
    })

  if (byTime) return byTime.i

  const firstWithoutNote = meals.map((m, i) => ({ m, i })).find(({ m }) =>
    m.id === undefined
  )
  return firstWithoutNote ? firstWithoutNote.i : meals.length - 1
}

export function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ',')
}

// Agrupa los ítems de una misma mención (p. ej. los grupos de un alimento compuesto).
export function groupByMention(items: EntryItemDto[]): EntryItemDto[][] {
  const mentions: EntryItemDto[][] = []
  const byMention = new Map<string, EntryItemDto[]>()
  for (const item of items) {
    const key = item.occurrenceId
    if (!key) {
      mentions.push([item])
      continue
    }
    const existing = byMention.get(key)
    if (existing) {
      existing.push(item)
      continue
    }
    const next = [item]
    byMention.set(key, next)
    mentions.push(next)
  }
  return mentions
}

// Migas de una comida: lo comido según la comparación, o el plan vacío si todavía no se anotó.
export function mealCrumbs(meal: MealDto, mealDay: MealDayDto | undefined, groupsMap: Record<number, GroupInfo>): MigaRow[] {
  const comparison = (mealDay?.noteText ? mealDay.comparison : []).filter(s => s.expected > 0)
  if (mealDay?.noteText) {
    return comparison.map(s => ({
      id: s.foodGroupId,
      name: s.name,
      color: groupsMap[s.foodGroupId]?.token ?? 'var(--muted)',
      done: Number(s.recorded),
      total: Number(s.expected),
      status: s.status,
    }))
  }
  return meal.portions
    .filter(p => p.portions > 0 && groupsMap[p.foodGroupId])
    .map(p => ({
      id: p.foodGroupId,
      name: groupsMap[p.foodGroupId].name,
      color: groupsMap[p.foodGroupId].token,
      done: 0,
      total: Number(p.portions),
    }))
}

export function calculateDaySummary(
  dayRecord: DayRegistroDto | null,
  meals: MealDto[],
  groupsMap: Record<number, GroupInfo>,
) {
  const totalById: Record<number, number> = {}
  const doneById: Record<number, number> = {}

  for (const meal of meals) {
    for (const p of meal.portions) {
      if (p.portions <= 0) continue
      totalById[p.foodGroupId] = (totalById[p.foodGroupId] ?? 0) + Number(p.portions)
    }
  }

  for (const s of dayRecord?.summary ?? []) {
    doneById[s.foodGroupId] = Number(s.totalRecorded)
  }

  const total = Object.values(totalById).reduce((s, v) => s + v, 0)
  const done = Object.values(doneById).reduce((s, v) => s + v, 0)

  const byGroup: MigaRow[] = []
  for (const [idStr, t] of Object.entries(totalById)) {
    const id = Number(idStr)
    const info = groupsMap[id]
    if (info) byGroup.push({ id, name: info.name, color: info.token, done: doneById[id] ?? 0, total: t })
  }

  return { total, done, byGroup }
}

// Al guardar una nota, el resumen del día suma la diferencia de porciones entre los ítems
// anteriores y los nuevos de esa comida, también de mentions que esa comida no tenía previstos.
export function portionsByGroup(items: EntryItemDto[]): Map<number, number> {
  const total = new Map<number, number>()
  for (const item of items) {
    if (item.foodGroupId === null || item.portions === null) continue
    total.set(item.foodGroupId, (total.get(item.foodGroupId) ?? 0) + Number(item.portions))
  }
  return total
}

export function adjustSummary(
  summary: DailySummaryDto[],
  previous: EntryItemDto[],
  next: EntryItemDto[],
  groupsMap: Record<number, GroupInfo>,
): DailySummaryDto[] {
  const delta = portionsByGroup(next)
  for (const [id, value] of portionsByGroup(previous)) delta.set(id, (delta.get(id) ?? 0) - value)
  const adjusted = summary.map(s => {
    const d = delta.get(s.foodGroupId)
    return d ? { ...s, totalRecorded: Number(s.totalRecorded) + d } : s
  })
  for (const [foodGroupId, value] of delta) {
    if (value !== 0 && !summary.some(s => s.foodGroupId === foodGroupId)) {
      adjusted.push({ foodGroupId, name: groupsMap[foodGroupId]?.name ?? '', clave: '', totalRecorded: value })
    }
  }
  return adjusted
}

