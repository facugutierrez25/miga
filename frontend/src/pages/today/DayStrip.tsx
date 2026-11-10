import './DayStrip.css'
import { useState } from 'react'
import type { MealDto } from '../../api/plans'
import type { MealDayDto } from '../../api/records'
import type { CrumbRow } from '../../components/crumbSlots'
import Miga from '../../components/Miga'
import Crumbs from '../../components/Crumbs'
import { mealAspect, mealStatus } from '../../lib/mealStatus'
import { fmt } from './helpers'

interface Props {
  meals: MealDto[]
  records: MealDayDto[]
  selectedId: number | undefined
  nextId: number | undefined
  onSelect: (id: number | undefined) => void
  total: number
  done: number
  rows: CrumbRow[]
}

export function DayStrip({ meals, records, selectedId, nextId, onSelect, total, done, rows }: Props) {
  const [expanded, setExpanded] = useState(false)
  const index = meals.findIndex(meal => meal.id === selectedId)
  return <section className="tira" aria-label="Tu día">
    <div className="tira__grid" role="group" aria-label="Comidas del día">
      {meals.length > 0 && <span className="banda" style={{ width: `${100 / meals.length}%`, transform: `translateX(${index * 100}%)` }} />}
      {meals.map((meal, index) => {
        const record = records.find(record => record.mealId === meal.id)
        const status = mealStatus(record)
        const time = meal.suggestedTime?.slice(0, 5)
        return <button type="button" key={meal.id ?? index} className="tira__dia"
          data-sigue={meal.id === nextId || undefined} aria-pressed={meal.id === selectedId}
          aria-label={`${meal.name}${time ? `, ${time}` : ''}: ${status.label.toLocaleLowerCase('es')}`}
          onClick={() => onSelect(meal.id)}>
          <Miga aspect={mealAspect(record?.status, { planned: meal.portions.some(p => p.portions > 0) })} />
          <span className="tira__nom">{meal.name}</span><span className="tira__hora">{time}</span><span className="tira__sigue" />
        </button>
      })}
    </div>
    <button type="button" className="tira__pie" aria-expanded={expanded} aria-controls="hoy-grupos" onClick={() => setExpanded(!expanded)}>
      Tu día por grupo<span>{fmt(done)} de {fmt(total)} porciones</span>
    </button>
    {expanded && <div id="hoy-grupos" className="grupos"><Crumbs rows={rows} /></div>}
  </section>
}
