import { mealStatus, type MealStateKind } from '../../lib/mealStatus'
import { type MealDayDto } from '../../api/records'

export function MealStateIcon({ kind }: { kind: MealStateKind }) {
  if (kind === 'ok') {
    return (
      <svg viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6" fill="currentColor" />
        <path d="M4.2 7.2l1.9 1.9 3.7-4.1" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'warn' || kind === 'ask') {
    return (
      <svg viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7 1.6a5.4 5.4 0 0 1 0 10.8z" fill="currentColor" />
      </svg>
    )
  }
  if (kind === 'noted') {
    return (
      <svg viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function MealState({ mealDay }: { mealDay: MealDayDto | undefined }) {
  const { kind, label } = mealStatus(mealDay)
  return (
    <span className={`hoy-estado hoy-estado--${kind}`}>
      <MealStateIcon kind={kind} />
      {label}
    </span>
  )
}
