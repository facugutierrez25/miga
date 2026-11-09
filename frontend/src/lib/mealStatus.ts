import type { GroupStatusDto } from '../api/records'

export interface MealStatus {
  kind: MealStateKind
  label: string
  text: string
  crumb: 'full' | 'half' | 'noted' | 'empty'
}

const STATUS_LABELS: Record<string, { kind: MealStateKind; label: string; crumb: MealStatus['crumb'] }> = {
  FLEXIBLE: { kind: 'noted', label: 'Flexible', crumb: 'noted' },
  EN_PLAN: { kind: 'ok', label: 'Como el plan', crumb: 'full' },
  CASI: { kind: 'warn', label: 'Faltó algo', crumb: 'half' },
  DE_MAS: { kind: 'warn', label: 'De más', crumb: 'half' },
  MIXED: { kind: 'warn', label: 'Faltó y de más', crumb: 'half' },
  PREGUNTAR: { kind: 'ask', label: 'Por confirmar', crumb: 'half' },
  SIN_ANOTAR: { kind: 'none', label: 'Sin anotar', crumb: 'empty' },
  REGISTRADA: { kind: 'noted', label: 'Anotada', crumb: 'noted' },
}

function statusFromCode(code: string): MealStatus {
  const status = STATUS_LABELS[code] ?? STATUS_LABELS.REGISTRADA
  return { ...status, text: status.label }
}

function fmt(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1).replace('.', ',')
}

export type MealStateKind = 'ok' | 'warn' | 'ask' | 'noted' | 'none'

function describeGroups(groups: GroupStatusDto[], diff: (s: GroupStatusDto) => number): string {
  const parts = groups.map((s, index) => {
    const quantity = diff(s)
    const portionWord = index === 0 ? ` ${quantity === 1 ? 'porción' : 'porciones'}` : ''
    return `${fmt(quantity)}${portionWord} de ${s.name?.trim() || 'un grupo del plan'}`
  })
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : parts[0]
}

export function mealStatus(mealDay: { noteText: string | null; comparison?: GroupStatusDto[]; status?: string } | undefined): MealStatus {
  if (!mealDay) return statusFromCode('SIN_ANOTAR')
  const status = statusFromCode(mealDay.status ?? 'SIN_ANOTAR')
  const comparison = mealDay.comparison
  if (!comparison || !['CASI', 'DE_MAS', 'MIXED'].includes(mealDay.status ?? '')) return status
  const missing = comparison.filter(s => s.status === 'CASI' || s.status === 'SIN_ANOTAR')
  const extra = comparison.filter(s => s.status === 'DE_MAS')
  const parts = [
    missing.length > 0 ? `Faltó ${describeGroups(missing, s => s.expected - s.recorded)}` : '',
    extra.length > 0 ? `De más: ${describeGroups(extra, s => s.recorded - s.expected)}` : '',
  ].filter(Boolean)
  return { ...status, text: parts.length > 0 ? parts.join(' · ') : status.text }
}
