import { type MealProps, MealDetail } from './MealDetail'
import { MealState } from './MealState'
import { mealStatus } from '../../lib/mealStatus'
import { useState, memo } from 'react'

export const MealRow = memo(function MealRow(props: MealProps) {
  const { meal, mealDay } = props
  const [open, setOpen] = useState(false)
  const detailId = `comida-detalle-${meal.id ?? meal.name}`
  return (
    <li className="hoy-fila">
      <h3 className="hoy-fila__titulo">
        <button
          type="button"
          className="hoy-fila__btn"
          aria-expanded={open}
          aria-controls={detailId}
          aria-label={`${meal.name}${meal.suggestedTime ? `, ${meal.suggestedTime.slice(0, 5)}` : ''}: ${mealStatus(mealDay).text}`}
          onClick={() => setOpen(a => !a)}
        >
          <span className="hoy-fila__nombre">{meal.name}</span>
          {meal.suggestedTime && <span className="hoy-fila__hora">{meal.suggestedTime.slice(0, 5)}</span>}
          <MealState mealDay={mealDay} />
          <svg className="hoy-fila__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h3>
      {open && (
        <div id={detailId} className="hoy-fila__detalle">
          <MealDetail {...props} />
        </div>
      )}
    </li>
  )
})

// ── TodayPage ────────────────────────────────────────────────────────────────

