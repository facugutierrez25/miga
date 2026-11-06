import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/authTypes'
import { useWeek } from '../hooks/useWeek'
import { logHabit, type HabitDto } from '../api/semana'
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
  const habits = week?.habits.filter(h => !day?.habitIds || day.habitIds.includes(h.id)) ?? []
  function onLogUpdated(log: Awaited<ReturnType<typeof logHabit>>) {
    setData(prev => prev && ({ ...prev, days: prev.days.map(d => d.date !== date ? d : ({ ...d, habitLogs: [...d.habitLogs.filter(l => l.habitId !== log.habitId), log] })) }))
  }
  const [habitError, setHabitError] = useState('')
  const [savingHabit, setSavingHabit] = useState<number | null>(null)
  const logMap = new Map((day?.habitLogs ?? []).map(l => [l.habitId, l]))

  async function setHabit(habit: HabitDto, newVal: number) {
    if (savingHabit !== null) return
    setHabitError('')
    setSavingHabit(habit.id)
    try {
      const updated = await logHabit(token!, habit.id, date, newVal)
      onLogUpdated(updated)
    } catch {
      setHabitError('No se pudo registrar el hábito. Probá de nuevo.')
    } finally {
      setSavingHabit(null)
    }
  }


  if (status === 'error') return <section className="hoy-habitos-dia"><h2>Hábitos de hoy</h2><p role="alert">No se pudieron cargar los hábitos. <button onClick={retry}>Reintentar</button></p></section>
  if (!day || !habits.length) return null
  return <section className="hoy-habitos-dia" aria-label="Hábitos de hoy"><h2>Hábitos de hoy</h2>
      {habits.length > 0 && (
        <div className="hoy-habitos">

          <ul className="hoy-habitos__lista">
            {habits.map(h => {
              const log = logMap.get(h.id)
              const valor = log?.value ?? 0
              const done = habitDone(h, valor)
              const progress = habitProgress(h, valor)
              const unidad = h.unit ? ` ${h.unit}` : ''
              // Contadores y cantidades se corrigen con − y +; los flexibles son de solo lectura.
              const esContador = h.habitType !== 'SI_NO' && !h.countsFlexibleMeals
              const check = done && (
                <svg viewBox="0 0 14 14"><path d="M3.5 7.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )
              return (
                <li key={h.id}>
                  {esContador ? (
                    <div role="group" aria-label={`${h.name}: ${progress}, ${fullDate(date)}, ${done ? 'completado' : 'pendiente'}`} className={`hoy-habito${done ? ' hoy-habito--ok' : ''}`}>
                      <span className="hoy-habito__check" aria-hidden="true">{check}</span>
                      <span className="hoy-habito__name">{h.name}</span>
                      <span className="hoy-habito__val">{progress}</span>
                      <span className="hoy-habito__ajuste">
                        <button type="button" className="hoy-habito__paso"
                          disabled={valor <= 0 || savingHabit !== null}
                          aria-label={`Restar ${fmtN(h.step)}${unidad} de ${h.name}, ${fullDate(date)}`}
                          onClick={() => void setHabit(h, Math.max(0, valor - h.step))}>
                          −
                        </button>
                        <button type="button" className="hoy-habito__paso"
                          disabled={savingHabit !== null}
                          aria-label={`Sumar ${fmtN(h.step)}${unidad} a ${h.name}, ${fullDate(date)}`}
                          onClick={() => void setHabit(h, valor + h.step)}>
                          +
                        </button>
                      </span>
                    </div>
                  ) : (
                    <button
                      disabled={h.countsFlexibleMeals || savingHabit !== null}
                      className={`hoy-habito${done ? ' hoy-habito--ok' : ''}`}
                      onClick={() => void setHabit(h, done ? 0 : 1)}
                      aria-label={hasGoal(h) ? `${h.name}: ${progress}, ${fullDate(date)}, ${done ? 'completado' : 'pendiente'}` : `${h.name}: ${done ? 'completado' : 'pendiente'}, ${progress}, ${fullDate(date)}`}
                      aria-pressed={done}
                    >
                      <span className="hoy-habito__check" aria-hidden="true">{check}</span>
                      <span className="hoy-habito__name">{h.name}</span>
                      {h.countsFlexibleMeals && (
                        <span className="hoy-habito__val">{progress}</span>
                      )}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {habitError && <p className="hoy-habit-error" role="alert">{habitError}</p>}

  </section>
}
