import { type MealProps, MealDetail } from './MealDetail'
import { memo } from 'react'

export const MealAhora = memo(function MealAhora(props: MealProps) {
  const { meal } = props
  const headingId = `comida-${meal.id ?? meal.name}`
  return (
    <article className="hoy-ahora" aria-labelledby={headingId}>
      <div className="hoy-ahora__head">
        <span className="hoy-ahora__etiqueta">Ahora</span>
        <h2 id={headingId} className="hoy-ahora__nombre">{meal.name}</h2>
        {meal.suggestedTime && <span className="hoy-ahora__hora">{meal.suggestedTime.slice(0, 5)}</span>}
      </div>
      <MealDetail {...props} showCard />
    </article>
  )
})

