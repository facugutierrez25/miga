import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/authTypes'
import { useWeek } from '../hooks/useWeek'
import { logHabit, type HabitDto } from '../api/week'
import Miga from './Miga'
import './TodayHabits.css'

function fullDate(date: string) { return new Date(date + 'T12:00:00').toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
function fmtN(n: number): string {
  return n.toLocaleString('es-UY', { useGrouping: false, maximumFractionDigits: 2 })
}

// Las metas admiten decimales: sin redondear, 0,1 + 0,7 no llega a 0,8.
function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

function hasGoal(habit: HabitDto): boolean {
  return habit.habitType !== 'SI_NO' && habit.dailyGoal != null
}

function habitProgress(habit: HabitDto, value: number): string {
  const unit = habit.unit ? ` ${habit.unit}` : ''
  return hasGoal(habit) && habit.period === 'DIA'
    ? `${fmtN(value)} de ${fmtN(habit.dailyGoal!)}${unit}`
    : `${fmtN(value)}${unit}`
}

function habitDone(habit: HabitDto, value: number): boolean {
  if (!hasGoal(habit)) return value > 0
  // La meta semanal se marca en el resumen, no en cada día.
  return habit.period === 'DIA' && round(value) >= habit.dailyGoal!
}


export function HabitCrumbs({ habit, value = 0, disabled = false, date, onChange }: {
  habit: HabitDto; value?: number; disabled?: boolean; date?: string; onChange?: (value: number) => void
}) {
  const yesNo = habit.habitType === 'SI_NO'
  const slots = yesNo ? 1 : habit.dailyGoal != null && habit.step > 0 ? Math.round(habit.dailyGoal / habit.step) : 0
  const filled = yesNo ? Number(value > 0) : Math.round(value / habit.step)
  const done = habitDone(habit, value)
  const progress = habitProgress(habit, value)
  const unit = habit.unit ? ` ${habit.unit}` : ''
  const suffix = date ? `, ${fullDate(date)}` : ''
  const unavailable = disabled || !onChange
  const update = (next: number) => onChange?.(round(next))
  return <div role="group" aria-label={`${habit.name}: ${progress}${suffix}, ${done ? 'completado' : 'pendiente'}`}
    className={`hoy-habito${done ? ' hoy-habito--ok' : ''}`}>
    <span className="hoy-habito__name">{habit.name}</span>
    <span className="hoy-habito__val">{yesNo ? value > 0 ? 'Hecho' : '' : progress}</span>
    <span className="hoy-habito__migas">
      {slots > 0 && slots <= 6 ? <>
        {Array.from({ length: slots }, (_, index) => {
          const step = yesNo ? 1 : habit.step
          const next = round((filled === index + 1 ? index : index + 1) * step)
          return <button type="button" key={index} disabled={unavailable} aria-pressed={index < filled}
            aria-label={`${habit.name}: ${yesNo ? next ? 'Hecho' : 'Sin hacer' : `${fmtN(next)}${unit}`}${suffix}`}
            onClick={() => update(next)}><Miga aspect={index < filled ? 'full' : 'empty'} /></button>
        })}
        {!yesNo && <button type="button" disabled={unavailable}
          aria-label={`Sumar ${fmtN(habit.step)}${unit} a ${habit.name}${suffix}`}
          onClick={() => update(Math.max(value, habit.dailyGoal!) + habit.step)}>
          <span className={`hoy-habito__extra${filled > slots ? ' hoy-habito__extra--on' : ''}`}>+{filled > slots ? filled - slots : ''}</span>
        </button>}
      </> : <>
        <button type="button" className="hoy-habito__paso" disabled={unavailable || value <= 0}
          aria-label={`Restar ${fmtN(habit.step)}${unit} de ${habit.name}${suffix}`}
          onClick={() => update(Math.max(0, value - habit.step))}>−</button>
        <button type="button" className="hoy-habito__paso" disabled={unavailable}
          aria-label={`Sumar ${fmtN(habit.step)}${unit} a ${habit.name}${suffix}`}
          onClick={() => update(value + habit.step)}>+</button>
      </>}
    </span>
  </div>
}


export default function TodayHabits({ date, revision }: { date: string; revision?: unknown }) {
  const { token, email } = useAuth()
  const { data: week, setData, status, retry } = useWeek(token, email, date)
  const previousRevision = useRef(revision)
  useEffect(() => {
    if (previousRevision.current !== revision) {
      previousRevision.current = revision
      retry()
    }
  }, [revision, retry])
  const day = week?.days.find(d => d.date === date)
  const habits = week?.habits.filter(h => !h.countsFlexibleMeals && (!day?.habitIds || day.habitIds.includes(h.id))) ?? []
  function onLogUpdated(log: Awaited<ReturnType<typeof logHabit>>) {
    setData(prev => prev && ({ ...prev, days: prev.days.map(d => d.date !== date ? d : ({ ...d, habitLogs: [...d.habitLogs.filter(l => l.habitId !== log.habitId), log] })) }))
  }
  const [habitError, setHabitError] = useState('')
  const [savingHabit, setSavingHabit] = useState<number | null>(null)
  const habitPending = useRef(false)
  const logMap = new Map((day?.habitLogs ?? []).map(l => [l.habitId, l]))

  async function setHabit(habit: HabitDto, newVal: number) {
    if (habitPending.current) return
    habitPending.current = true
    const previous = day?.habitLogs ?? []
    onLogUpdated({ habitId: habit.id, date, value: newVal })
    setHabitError('')
    setSavingHabit(habit.id)
    try {
      const updated = await logHabit(token!, habit.id, date, newVal)
      onLogUpdated(updated)
    } catch {
      setData(prev => prev && ({ ...prev, days: prev.days.map(d => d.date !== date ? d : { ...d, habitLogs: previous }) }))
      setHabitError('No se pudo registrar el hábito. Probá de nuevo.')
    } finally {
      habitPending.current = false
      setSavingHabit(null)
    }
  }


  if (status === 'error') return <section className="hoy-habitos-dia"><h2>Hábitos de hoy</h2><p role="alert">No se pudieron cargar los hábitos. <button onClick={retry}>Reintentar</button></p></section>
  if (!day || !habits.length) return null
  return <section className="hoy-habitos-dia" aria-label="Hábitos de hoy"><h2>Hábitos de hoy</h2>
      {habits.length > 0 && (
        <div className="hoy-habitos">

          <ul className="hoy-habitos__lista">
            {habits.map(h => <li key={h.id}>
              <HabitCrumbs habit={h} value={logMap.get(h.id)?.value ?? 0} date={date}
                disabled={savingHabit !== null} onChange={value => void setHabit(h, value)} />
            </li>)}
          </ul>
        </div>
      )}

      {habitError && <p className="hoy-habit-error" role="alert">{habitError}</p>}

  </section>
}
