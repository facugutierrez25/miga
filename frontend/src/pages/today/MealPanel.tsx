import type { MealProps } from './MealDetail'
import { MealNoteSection } from './MealNoteSection'
import StatusChip from '../../components/StatusChip'
import { mealStatus } from '../../lib/mealStatus'

export function MealPanel({ next, ...props }: MealProps & { next: boolean }) {
  const { meal, mealDay } = props
  const status = mealStatus(mealDay)
  return <section className="comida" aria-label={meal.name}>
    <div className="comida__cab"><h2>{meal.name}</h2>
      {meal.suggestedTime && <span className="comida__hora">{meal.suggestedTime.slice(0, 5)}</span>}
      {mealDay?.status && mealDay.status !== 'SIN_ANOTAR' ? <StatusChip status={mealDay.status} />
        : next && <span className="comida__sigue">Sigue</span>}
    </div>
    {mealDay?.noteText && status.text !== status.label && <p className="comida__diferencias">{status.text}</p>}
    {meal.id !== undefined && <MealNoteSection {...props} />}
  </section>
}
