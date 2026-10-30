import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import { exportWeekCsv, getWeek, logHabit, type HabitDto, type HabitLogDto, type WeekDayDto, type WeekSummaryDto } from '../api/semana'
import './SemanaPage.css'

const DIAS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
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
  return n === Math.floor(n) ? String(n) : n.toFixed(1).replace('.', ',')
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
  const weekdayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1
  const isToday = day.date === todayISO
  const recorded = Number(day.totalRecorded)
  const goal = Number(day.totalGoal)
  const barPct = pct(recorded, goal)
  const logMap = new Map(day.habitLogs.map(l => [l.habitId, l]))

  async function toggleHabit(habit: HabitDto) {
    const current = logMap.get(habit.id)
    const newVal = habit.habitType === 'SI_NO'
      ? (current && current.value > 0 ? 0 : 1)
      : (current ? current.value + habit.step : habit.step)
    try {
      const updated = await logHabit(token, habit.id, day.date, newVal)
      onLogUpdated(updated)
    } catch {
      // ignore
    }
  }

  return (
    <div className={[
      'semana-day',
      isToday ? 'semana-day--hoy' : '',
      day.hasData ? 'semana-day--datos' : '',
    ].filter(Boolean).join(' ')}>
      <div className="semana-day__head">
        <span className="semana-day__dow">{DIAS_ES[weekdayIdx]}</span>
        <span className="semana-day__num">{d.getDate()}</span>
      </div>

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

      {habits.length > 0 && (
        <div className="semana-day__habitos">
          {habits.map(h => {
            const log = logMap.get(h.id)
            const done = Boolean(log && log.value > 0)
            return (
              <button
                key={h.id}
                className={`semana-habito${done ? ' semana-habito--ok' : ''}`}
                onClick={() => void toggleHabit(h)}
                aria-label={`${h.name}: ${done ? 'completado' : 'pendiente'}`}
                aria-pressed={done}
              >
                <span className="semana-habito__check">{done ? '✓' : ''}</span>
                <span className="semana-habito__name">{h.name}</span>
                {h.habitType !== 'SI_NO' && log && (
                  <span className="semana-habito__val">
                    {fmtN(log.value)}{h.unit ? ` ${h.unit}` : ''}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {!day.hasData && habits.length === 0 && (
        <span className="semana-day__vacio">—</span>
      )}
    </div>
  )
}

export default function SemanaPage() {
  useTitle('Semana | Miga')
  const { token } = useAuth()
  const [refDate, setRefDate] = useState(() => mondayOf(toISO(new Date())))
  const [week, setWeek] = useState<WeekSummaryDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    getWeek(token, refDate, controller.signal)
      .then(w => { setWeek(w); setLoading(false) })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') {
          setError('No se pudo cargar la semana.')
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [token, refDate])

  const load = useCallback(
    (date: string) => { setRefDate(date) },
    [],
  )

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

  const hoy = useMemo(() => toISO(new Date()), [])
  const isCurrentWeek = week ? week.weekStart <= hoy && hoy <= week.weekEnd : false

  return (
    <div className="semana-page">
      <div className="semana-header">
        <Brand size={22} />
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
          <button
            className="semana-export-btn"
            onClick={() => void exportWeekCsv(token, week.weekStart)}
          >
            CSV
          </button>
        )}
      </div>

      {loading && <p className="semana-estado">Cargando…</p>}

      {error && (
        <div className="semana-estado semana-estado--error">
          <span>{error}</span>
          <button onClick={() => load(refDate)} className="semana-retry">Reintentar</button>
        </div>
      )}

      {week && !loading && (
        <>
          {week.habits.length === 0 && week.days.every(d => !d.hasData) && (
            <p className="semana-vacia">
              Aún no hay datos para esta semana.
            </p>
          )}
          <div className="semana-grid">
            {week.days.map(day => (
              <DayCard
                key={day.date}
                day={day}
                habits={week.habits}
                token={token ?? ''}
                todayISO={hoy}
                onLogUpdated={handleLogUpdated}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
