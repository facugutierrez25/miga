import { useState, type ReactNode } from 'react'
import BottomSheet from '../../components/BottomSheet'
import type { PlanFoodGroupDto } from '../../api/plans'
import { MAX_CARD_PORTIONS } from '../../components/crumbSlots'
import { groupColor } from '../../groupColors'
import { useDraftGuard } from './useDraftGuard'
import './MealSheet.css'

export interface MealDraft {
  name: string
  time: string
  weekdays?: number[] | null
  portions: Record<number, number>
}
export default function MealSheet({ meal, groups, isNew, busy, error, conflict, onReload, onClose, onSave, onDelete, onDirtyChange, children }: {
  children?: ReactNode
  meal: MealDraft; groups: PlanFoodGroupDto[]; isNew: boolean; busy: boolean
  error: string | null; conflict: boolean; onReload: () => void; onClose: () => void
  onSave: (meal: MealDraft) => void; onDelete: () => void; onDirtyChange: (dirty: boolean) => void
}) {
  const [draft, setDraft] = useState(meal)
  const [deleting, setDeleting] = useState(false)
  const guard = useDraftGuard(draft, onDirtyChange, busy)
  const count = Object.values(draft.portions).reduce((sum, value) => sum + Math.ceil(value), 0)
  const close = () => { if (!busy) guard.cancel(onClose) }
  const days = draft.weekdays?.length ? draft.weekdays : [1, 2, 3, 4, 5, 6, 7]
  function toggleDay(day: number) {
    const next = days.includes(day) ? days.filter(value => value !== day) : [...days, day].sort()
    if (next.length) setDraft({ ...draft, weekdays: next })
  }
  return <BottomSheet title={isNew ? 'Agregar comida' : 'Editar comida'} onClose={close}>
    <div className="meal-sheet">
      {children}
      {guard.notice(onClose)}
      <fieldset disabled={busy} className="meal-sheet__fields">
        <label>Nombre de la comida<input placeholder="Nombre de la comida" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>Hora sugerida<input type="time" value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} /></label>
        <div role="group" aria-label="Días de la semana" className="meal-sheet__days">
          {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day, index) =>
            <button key={day} type="button" aria-label={day} aria-pressed={days.includes(index + 1)} onClick={() => toggleDay(index + 1)}>{day.slice(0, 2)}</button>)}
        </div>
        <p aria-live="polite">{count} de {MAX_CARD_PORTIONS}</p>
        {groups.map((group, index) => {
          const value = draft.portions[group.id] ?? 0
          const update = (delta: number) => setDraft({ ...draft, portions: { ...draft.portions, [group.id]: value + delta } })
          return <div className="meal-sheet__portion" key={group.id}>
            <span className="meal-sheet__dot" style={{ background: groupColor(group, index) }} />
            <span>{group.name}</span>
            <button type="button" aria-label={'Reducir ' + group.name} disabled={value <= 0} onClick={() => update(-0.5)}>−</button>
            <output aria-label={'Porciones de ' + group.name}>{String(value).replace('.', ',')}</output>
            <button type="button" aria-label={'Aumentar ' + group.name}
              disabled={value >= 10 || count - Math.ceil(value) + Math.ceil(value + 0.5) > MAX_CARD_PORTIONS} onClick={() => update(0.5)}>+</button>
          </div>
        })}
        <button className="meal-sheet__save" disabled={!draft.name.trim() || conflict || count > MAX_CARD_PORTIONS} onClick={() => onSave(draft)}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        {!isNew && <button className="meal-sheet__delete" onClick={() => setDeleting(true)}>Eliminar comida</button>}
        {deleting && <div role="alert"><p>¿Eliminar {draft.name}?</p>
          <button onClick={() => setDeleting(false)}>Cancelar</button><button onClick={onDelete}>Eliminar</button></div>}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {conflict && <div role="alert"><p>El plan fue modificado en otro dispositivo. Recargá para ver la versión actual.</p>
        <button disabled={busy} onClick={onReload}>Recargar plan</button></div>}
    </div>
  </BottomSheet>
}
