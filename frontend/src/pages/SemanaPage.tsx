import { useState } from 'react'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import { exportWeek, logHabit, type HabitDto, type HabitLogDto, type WeekDayDto, type WeekSummaryDto } from '../api/semana'
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
    return `${startDay} al ${endDay} de ${MESES_ES[e.getMonth()]}`
  }
  return `${startDay} de ${MESES_ES[s.getMonth()]} al ${endDay} de ${MESES_ES[e.getMonth()]}`
}

function fmtN(n: number): string {
  return n.toLocaleString('es-UY', { useGrouping: false, maximumFractionDigits: 20 })
}

// Estado de cada comida: texto concreto y la miga que la representa en la tira de la semana.
const MEAL_STATUS: Record<string, { text: string; miga: 'full' | 'half' | 'noted' | 'empty' }> = {
  EN_PLAN: { text: 'Como el plan', miga: 'full' },
  CASI: { text: 'Faltó algo', miga: 'half' },
  DE_MAS: { text: 'De más', miga: 'half' },
  PREGUNTAR: { text: 'Por confirmar', miga: 'half' },
  REGISTRADA: { text: 'Registrada', miga: 'noted' },
  SIN_ANOTAR: { text: 'Sin anotar', miga: 'empty' },
}

function mealStatus(status: string) {
  return MEAL_STATUS[status] ?? { text: status, miga: 'empty' as const }
}

function resumenDia(day: WeekDayDto, futuro: boolean): string {
  if (futuro) return 'todavía no'
  const meals = day.meals ?? []
  if (meals.length === 0) return 'sin comidas en el plan'
  const enPlan = meals.filter(m => m.status === 'EN_PLAN').length
  const anotadas = meals.filter(m => m.status !== 'SIN_ANOTAR').length
  return `${enPlan} de ${meals.length} comidas como el plan, ${anotadas} anotadas`
}

interface DayDetailProps {
  day: WeekDayDto
  habits: HabitDto[]
  token: string
  todayISO: string
  onLogUpdated: (log: HabitLogDto) => void
}

function DayDetail({ day, habits, token, todayISO, onLogUpdated }: DayDetailProps) {
  const d = new Date(day.date + 'T12:00:00')
  const [habitError, setHabitError] = useState('')
  const [savingHabit, setSavingHabit] = useState<number | null>(null)
  const isToday = day.date === todayISO
  const recorded = Number(day.totalRecorded)
  const goal = Number(day.totalGoal)
  const logMap = new Map(day.habitLogs.map(l => [l.habitId, l]))
  const meals = day.meals ?? []

  async function setHabit(habit: HabitDto, newVal: number) {
    if (savingHabit !== null) return
    setHabitError('')
    setSavingHabit(habit.id)
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
    <article aria-current={isToday ? 'date' : undefined} className="semana-dia">
      <div className="semana-dia__head">
        <h2 className="semana-dia__titulo" aria-label={fullDate(day.date)}>
          <time dateTime={day.date}>{d.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })}</time>
        </h2>
        {isToday && <span className="semana-dia__hoy">Hoy</span>}
        {goal > 0 && (
          <span className="semana-dia__porciones">{fmtN(recorded)} de {fmtN(goal)} porciones</span>
        )}
      </div>

      {meals.length > 0 && (
        <ul className="semana-comidas">
          {meals.map(meal => {
            const estado = mealStatus(meal.status)
            return (
              <li key={meal.mealId} className="semana-comida">
                <span className="semana-comida__nombre">{meal.name}</span>
                <span className={`semana-comida__estado semana-comida__estado--${estado.miga}`}>{estado.text}</span>
                {meal.noteText && <p className="semana-comida__nota">{meal.noteText}</p>}
              </li>
            )
          })}
        </ul>
      )}

      {habits.length > 0 && (
        <div className="semana-habitos">
          <h3 className="semana-habitos__titulo">Hábitos</h3>
          <ul className="semana-habitos__lista">
            {habits.map(h => {
              const log = logMap.get(h.id)
              const valor = log?.value ?? 0
              const done = valor > 0
              const unidad = h.unit ? ` ${h.unit}` : ''
              // Contadores y cantidades se corrigen con − y +; los de sí/no y los flexibles, con la casilla.
              const esContador = h.habitType !== 'SI_NO' && !h.countsFlexibleMeals
              const check = done && (
                <svg viewBox="0 0 14 14"><path d="M3.5 7.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )
              return (
                <li key={h.id}>
                  {esContador ? (
                    <div className={`semana-habito${done ? ' semana-habito--ok' : ''}`}>
                      <span className="semana-habito__check" aria-hidden="true">{check}</span>
                      <span className="semana-habito__name">{h.name}</span>
                      <span className="semana-habito__val">{fmtN(valor)}{unidad}</span>
                      <span className="semana-habito__ajuste">
                        <button type="button" className="semana-habito__paso"
                          disabled={valor <= 0 || savingHabit !== null}
                          aria-label={`Restar ${fmtN(h.step)}${unidad} de ${h.name}, ${fullDate(day.date)}`}
                          onClick={() => void setHabit(h, Math.max(0, valor - h.step))}>
                          −
                        </button>
                        <button type="button" className="semana-habito__paso"
                          disabled={savingHabit !== null}
                          aria-label={`Sumar ${fmtN(h.step)}${unidad} a ${h.name}, ${fullDate(day.date)}`}
                          onClick={() => void setHabit(h, valor + h.step)}>
                          +
                        </button>
                      </span>
                    </div>
                  ) : (
                    <button
                      disabled={h.countsFlexibleMeals || savingHabit !== null}
                      className={`semana-habito${done ? ' semana-habito--ok' : ''}`}
                      onClick={() => void setHabit(h, done ? 0 : 1)}
                      aria-label={`${h.name}: ${done ? 'completado' : 'pendiente'}, ${fmtN(valor)}${unidad}, ${fullDate(day.date)}`}
                      aria-pressed={done}
                    >
                      <span className="semana-habito__check" aria-hidden="true">{check}</span>
                      <span className="semana-habito__name">{h.name}</span>
                      {h.countsFlexibleMeals && log && (
                        <span className="semana-habito__val">{fmtN(log.value)}{unidad}</span>
                      )}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {habitError && <p className="semana-habit-error" role="alert">{habitError}</p>}

      {meals.length === 0 && habits.length === 0 && (
        <p className="semana-dia__vacio">Nada para mostrar este día.</p>
      )}
    </article>
  )
}

function WeekStrip({ week, todayISO, selected, onSelect }: {
  week: WeekSummaryDto
  todayISO: string
  selected: string
  onSelect: (date: string) => void
}) {
  return (
    <div className="semana-tira" role="group" aria-label="Días de la semana">
      {week.days.map(day => {
        const d = new Date(day.date + 'T12:00:00')
        const futuro = day.date > todayISO
        const isToday = day.date === todayISO
        const letra = d.toLocaleDateString('es-UY', { weekday: 'narrow' }).toUpperCase()
        return (
          <button
            key={day.date}
            type="button"
            className={['semana-tira__dia', isToday ? 'semana-tira__dia--hoy' : '', futuro ? 'semana-tira__dia--futuro' : ''].filter(Boolean).join(' ')}
            aria-pressed={day.date === selected}
            aria-current={isToday ? 'date' : undefined}
            aria-label={`${fullDate(day.date)}${isToday ? ', hoy' : ''}: ${resumenDia(day, futuro)}`}
            onClick={() => onSelect(day.date)}
          >
            <span className="semana-tira__letra" aria-hidden="true">{letra}</span>
            <span className="semana-tira__num" aria-hidden="true">{d.getDate()}</span>
            <span className="semana-tira__migas" aria-hidden="true">
              {(day.meals ?? []).map(meal => (
                <i key={meal.mealId} className={`semana-miga semana-miga--${futuro ? 'futuro' : mealStatus(meal.status).miga}`} />
              ))}
            </span>
          </button>
        )
      })}
    </div>
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
  const hoy = toISO(useAhora())
  const [seleccion, setSeleccion] = useState<{ weekStart: string; date: string } | null>(null)

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

  const isCurrentWeek = week ? week.weekStart <= hoy && hoy <= week.weekEnd : false
  const selectedDate = week
    ? (seleccion?.weekStart === week.weekStart ? seleccion.date
      : isCurrentWeek ? hoy : week.days[0]?.date ?? week.weekStart)
    : null
  const selectedDay = week?.days.find(d => d.date === selectedDate)
  const pasados = week?.days.filter(d => d.date <= hoy) ?? []
  const comidasPasadas = pasados.flatMap(d => d.meals ?? [])
  const comidasEnPlan = comidasPasadas.filter(m => m.status === 'EN_PLAN').length

  return (
    <div className="semana-page">
      <div className="semana-header">
        <div className="semana-header__top">
          <Brand size={20} />
          {week && token && (
            <details className="semana-descargar">
              <summary className="semana-descargar__btn">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 3v10M6 9l4 4 4-4M4 16h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Descargar
              </summary>
              <div className="semana-descargar__menu">
                <button type="button" onClick={() => void download('csv')}>CSV</button>
                <button type="button" onClick={() => void download('xlsx')}>Excel (XLSX)</button>
              </div>
            </details>
          )}
        </div>
        <h1 className="semana-title" tabIndex={-1}>Semana</h1>
        <div className="semana-nav">
          <button
            className="semana-nav__btn"
            onClick={() => setRefDate(r => addWeeks(r, -1))}
            aria-label="Semana anterior"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="semana-nav__title">
            {week ? formatRango(week.weekStart, week.weekEnd) : '…'}
          </span>
          <button
            className="semana-nav__btn"
            onClick={() => { if (!isCurrentWeek) setRefDate(r => addWeeks(r, 1)) }}
            aria-label="Semana siguiente"
            aria-disabled={isCurrentWeek}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      <div className="semana-body">
        <div className="semana-views" role="group" aria-label="Vista de la semana">
          <button aria-pressed={view === 'day'} onClick={() => setView('day')}>Por día</button>
          <button aria-pressed={view === 'sheet'} onClick={() => setView('sheet')}>Planilla</button>
        </div>
        {exportError && <p className="semana-error" role="alert">{exportError}</p>}
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
              <p className="semana-vacia">Todavía no hay migas esta semana: lo que anotes en Hoy aparece acá.</p>
            )}

            {view === 'day' ? (
              <>
                <div className="semana-resumen">
                  <WeekStrip
                    week={week}
                    todayISO={hoy}
                    selected={selectedDate ?? ''}
                    onSelect={date => setSeleccion({ weekStart: week.weekStart, date })}
                  />
                  {comidasPasadas.length > 0 && (
                    <p className="semana-resumen__texto">
                      Esta semana: {comidasEnPlan} de {comidasPasadas.length} comidas como el plan
                    </p>
                  )}
                </div>
                {selectedDay && (
                  <DayDetail
                    key={selectedDay.date}
                    day={selectedDay}
                    habits={week.habits.filter(h => !selectedDay.habitIds || selectedDay.habitIds.includes(h.id))}
                    token={token ?? ''}
                    todayISO={hoy}
                    onLogUpdated={handleLogUpdated}
                  />
                )}
              </>
            ) : <WeekSheet week={week} todayISO={hoy} />}
          </>
        )}

      </div>
    </div>
  )
}

function WeekSheet({ week, todayISO }: { week: WeekSummaryDto; todayISO: string }) {
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
