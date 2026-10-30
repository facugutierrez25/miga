import { useState } from 'react'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import { exportWeek, logHabit, type HabitDto, type HabitLogDto, type WeekDayDto } from '../api/semana'
import './SemanaPage.css'
import { useWeek } from '../hooks/useWeek'
import { useAhora } from '../hooks/useAhora'

function fullDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-UY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addWeeks(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + delta * 7)
  return toISO(d)
}

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toISO(d)
}

function formatRango(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const startDay = s.getDate()
  const endDay = e.getDate()
  if (s.getMonth() === e.getMonth()) {
    return `${startDay}–${endDay} de ${MESES_ES[e.getMonth()]}`
  }
  return `${startDay} de ${MESES_ES[s.getMonth()]} – ${endDay} de ${MESES_ES[e.getMonth()]}`
}

function pct(recorded: number, goal: number): number {
  if (!goal || goal === 0) return 0
  return Math.min(100, Math.round((recorded / goal) * 100))
}

function fmtN(n: number): string {
  return n.toLocaleString('es-UY', { useGrouping: false, maximumFractionDigits: 20 })
}

interface DayCardProps {
  day: WeekDayDto
  habits: HabitDto[]
  token: string
  todayISO: string
  onLogUpdated: (log: HabitLogDto) => void
}

function DayCard({ day, habits, token, todayISO, onLogUpdated }: DayCardProps) {
  const d = new Date(day.date + 'T12:00:00')
  const [habitError, setHabitError] = useState('')
  const [savingHabit, setSavingHabit] = useState<number | null>(null)
  const isToday = day.date === todayISO
  const recorded = Number(day.totalRecorded)
  const goal = Number(day.totalGoal)
  const barPct = pct(recorded, goal)
  const logMap = new Map(day.habitLogs.map(l => [l.habitId, l]))

  async function toggleHabit(habit: HabitDto) {
    if (savingHabit !== null) return
    setHabitError('')
    setSavingHabit(habit.id)
    const current = logMap.get(habit.id)
    const newVal = habit.habitType === 'SI_NO'
      ? (current && current.value > 0 ? 0 : 1)
      : (current ? current.value + habit.step : habit.step)
    try {
      const updated = await logHabit(token, habit.id, day.date, newVal)
      onLogUpdated(updated)
    } catch {
      setHabitError('No se pudo registrar el hábito. Probá de nuevo.')
    } finally {
      setSavingHabit(null)
    }
  }

  return (
    <article aria-current={isToday ? 'date' : undefined} className={[
      'semana-day',
      isToday ? 'semana-day--hoy' : '',
      day.hasData ? 'semana-day--datos' : '',
    ].filter(Boolean).join(' ')}>
      <h2 className="semana-day__head" aria-label={fullDate(day.date)}>
        <time dateTime={day.date}>{d.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })}</time>
        {isToday && <span className="semana-day__today">Hoy</span>}
      </h2>

      {goal > 0 && (
        <div className="semana-day__porciones">
          <div className="semana-bar">
            <div
              className={`semana-bar__fill${barPct >= 100 ? ' semana-bar__fill--ok' : ''}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <span className="semana-day__frac">
            {fmtN(recorded)}<span className="semana-day__frac-sep">/</span>{fmtN(goal)}
          </span>
        </div>
      )}

      <ul className="semana-meals">
        {(day.meals ?? []).map(meal => <li key={meal.mealId}>
          <strong>{meal.name}</strong>: {mealStatus(meal.status)}
          {meal.noteText && <p className="semana-note">{meal.noteText}</p>}
        </li>)}
      </ul>
      {habits.length > 0 && (
        <div className="semana-day__habitos">
          {habits.map(h => {
            const log = logMap.get(h.id)
            const done = Boolean(log && log.value > 0)
            return (
              <button
                disabled={h.countsFlexibleMeals || savingHabit !== null}
                key={h.id}
                className={`semana-habito${done ? ' semana-habito--ok' : ''}`}
                onClick={() => void toggleHabit(h)}
                aria-label={`${h.name}: ${done ? 'completado' : 'pendiente'}, ${fmtN(log?.value ?? 0)}${h.unit ? ` ${h.unit}` : ''}, ${fullDate(day.date)}`}
                aria-pressed={done}
              >
                <span className="semana-habito__check">{done ? '✓' : ''}</span>
                <span className="semana-habito__name">{h.name}</span>
                {(h.habitType !== 'SI_NO' || h.countsFlexibleMeals) && log && (
                  <span className="semana-habito__val">
                    {fmtN(log.value)}{h.unit ? ` ${h.unit}` : ''}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {habitError && <p className="semana-habit-error" role="alert">{habitError}</p>}

      {!day.hasData && habits.length === 0 && (
        <span className="semana-day__vacio">—</span>
      )}
    </article>
  )
}

export default function SemanaPage() {
  useTitle('Semana | Miga')
  const { token, email } = useAuth()
  const [view, setView] = useState<'day' | 'sheet'>('day')
  const [exportError, setExportError] = useState('')
  const [refDate, setRefDate] = useState(() => mondayOf(toISO(new Date())))
  const { data: week, setData: setWeek, status, retry } = useWeek(token, email, refDate)
  const loading = status === 'loading'
  const error = status === 'error' ? 'No se pudo cargar la semana.' : null

  async function download(format: 'csv' | 'xlsx') {
    if (!token || !week) return
    setExportError('')
    try { await exportWeek(token, week.weekStart, format) }
    catch { setExportError('No se pudo exportar la semana. Probá de nuevo.') }
  }

  function handleLogUpdated(log: HabitLogDto) {
    setWeek(prev => {
      if (!prev) return prev
      return {
        ...prev,
        days: prev.days.map(d => {
          if (d.date !== log.date) return d
          const exists = d.habitLogs.some(l => l.habitId === log.habitId)
          const habitLogs = exists
            ? d.habitLogs.map(l => l.habitId === log.habitId ? log : l)
            : [...d.habitLogs, log]
          return { ...d, habitLogs }
        }),
      }
    })
  }

  const hoy = toISO(useAhora())
  const isCurrentWeek = week ? week.weekStart <= hoy && hoy <= week.weekEnd : false

  return (
    <div className="semana-page">
      <div className="semana-header">
        <Brand size={22} />
        <h1 className="semana-title" tabIndex={-1}>Semana</h1>
        <div className="semana-nav">
          <button
            className="semana-nav__btn"
            onClick={() => setRefDate(r => addWeeks(r, -1))}
            aria-label="Semana anterior"
          >
            ‹
          </button>
          <span className="semana-nav__title">
            {week ? formatRango(week.weekStart, week.weekEnd) : '…'}
          </span>
          <button
            className="semana-nav__btn"
            onClick={() => { if (!isCurrentWeek) setRefDate(r => addWeeks(r, 1)) }}
            aria-label="Semana siguiente"
            aria-disabled={isCurrentWeek}
            style={{ opacity: isCurrentWeek ? 0.3 : 1 }}
          >
            ›
          </button>
        </div>
        {week && token && (
          <div className="semana-exports"><button
            className="semana-export-btn"
            onClick={() => void download('csv')}
          >
            CSV
          </button><button className="semana-export-btn" onClick={() => void download('xlsx')}>XLSX</button></div>
        )}
      </div>

      <div className="semana-views" role="group" aria-label="Vista de la semana">
        <button aria-pressed={view === 'day'} onClick={() => setView('day')}>Por día</button>
        <button aria-pressed={view === 'sheet'} onClick={() => setView('sheet')}>Planilla</button>
      </div>
      {exportError && <p role="alert">{exportError}</p>}
      {loading && <p className="semana-estado">Cargando…</p>}

      {error && (
        <div className="semana-estado semana-estado--error">
          <span>{error}</span>
          <button onClick={retry} className="semana-retry">Reintentar</button>
        </div>
      )}

      {week && !loading && (
        <>
          {week.habits.length === 0 && week.days.every(d => !d.hasData) && (
            <p className="semana-vacia">
              Aún no hay datos para esta semana.
            </p>
          )}
          {view === 'sheet' ? <WeekSheet week={week} todayISO={hoy} /> : <div className="semana-grid">
            {week.days.map(day => (
              <DayCard
                key={day.date}
                day={day}
                habits={week.habits.filter(h => !day.habitIds || day.habitIds.includes(h.id))}
                token={token ?? ''}
                todayISO={hoy}
                onLogUpdated={handleLogUpdated}
              />
            ))}
          </div>}
        </>
      )}
    </div>
  )
}

function mealStatus(status: string) {
  return ({ SIN_ANOTAR: 'Sin anotar', REGISTRADA: 'Registrada', EN_PLAN: 'En plan', CASI: 'Casi', DE_MAS: 'De más', PREGUNTAR: 'Por confirmar' } as Record<string, string>)[status] ?? status
}

function WeekSheet({ week, todayISO }: { week: import('../api/semana').WeekSummaryDto; todayISO: string }) {
  const meals = [...new Set(week.days.flatMap(day => (day.meals ?? []).map(meal => meal.name)))]
  return <div className="semana-sheet"><table>
    <caption>Comidas y hábitos de la semana</caption>
    <thead><tr><th scope="col">Fecha</th>{meals.map(name => <th scope="col" key={name}>{name}</th>)}
      {week.habits.map(h => <th scope="col" key={h.id}>{h.name}</th>)}</tr></thead>
    <tbody>{week.days.map(day => <tr key={day.date}>
      <th scope="row" aria-current={day.date === todayISO ? 'date' : undefined}>
        <time dateTime={day.date}>{fullDate(day.date)}</time>
        {day.date === todayISO && <span> · Hoy</span>}
      </th>
      {meals.map(name => <td className="semana-note" key={name}>{(day.meals ?? []).filter(m => m.name === name).map(m => m.noteText).filter(Boolean).join('\n') || '—'}</td>)}
      {week.habits.map(h => <td key={h.id}>{day.habitIds && !day.habitIds.includes(h.id) ? '—' : fmtN(Number(day.habitLogs.find(l => l.habitId === h.id)?.value ?? 0))}</td>)}
    </tr>)}</tbody>
  </table></div>
}
