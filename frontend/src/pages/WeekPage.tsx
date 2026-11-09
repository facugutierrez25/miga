import Skeleton, { LoadingSkeleton } from '../components/Skeleton'
import { mealStatus } from '../lib/mealStatus'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import { exportWeek, type HabitDto, type WeekDayDto, type WeekSummaryDto } from '../api/week'
import './WeekPage.css'
import { useWeek } from '../hooks/useWeek'
import { useNow } from '../hooks/useNow'
import { useDialogFocus } from './useDialogFocus'

function fullDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-UY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
const SPANISH_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
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

function formatRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const startDay = s.getDate()
  const endDay = e.getDate()
  if (s.getMonth() === e.getMonth()) {
    return `${startDay} al ${endDay} de ${SPANISH_MONTHS[e.getMonth()]}`
  }
  return `${startDay} de ${SPANISH_MONTHS[s.getMonth()]} al ${endDay} de ${SPANISH_MONTHS[e.getMonth()]}`
}

function fmtN(n: number): string {
  return n.toLocaleString('es-UY', { useGrouping: false, maximumFractionDigits: 2 })
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

function hasGoal(habit: HabitDto): boolean {
  return habit.habitType !== 'SI_NO' && habit.dailyGoal != null
}

function WeeklyHabitSummary({ week }: { week: WeekSummaryDto }) {
  // Una versión nueva del plan copia el hábito con otro id y el mismo uid: se suman todas sus
  // versiones de la semana y se usa la meta de la más reciente.
  const versions = new Map<string, HabitDto[]>()
  for (const h of week.habits) {
    const key = h.uid ?? String(h.id)
    versions.set(key, [...(versions.get(key) ?? []), h])
  }
  const habits = [...versions.values()]
    .map(vs => ({ latest: vs[vs.length - 1], ids: vs.map(v => v.id) }))
    .filter(({ latest }) => hasGoal(latest) && latest.period === 'SEMANA')
    .map(({ latest, ids }) => ({ ...latest, ids }))
  if (habits.length === 0) return null
  return <section className="semana-habitos" aria-label="Metas semanales">
    <h2 className="semana-habitos__titulo">Metas semanales</h2>
    <ul className="semana-habitos__lista">{habits.map(h => {
      const total = round(week.days.reduce((sum, day) => sum + day.habitLogs
        .filter(log => h.ids.includes(log.habitId) && (!day.habitIds || day.habitIds.includes(log.habitId)))
        .reduce((daySum, log) => daySum + Number(log.value), 0), 0))
      const done = total >= h.dailyGoal!
      const progress = `${fmtN(total)} de ${fmtN(h.dailyGoal!)}${h.unit ? ` ${h.unit}` : ''} esta semana`
      return <li key={h.id} className={`semana-habito${done ? ' semana-habito--ok' : ''}`}
        aria-label={`${h.name}: ${progress}, ${done ? 'completado' : 'pendiente'}`}>
        <span className="semana-habito__check" aria-hidden="true">{done && (
          <svg viewBox="0 0 14 14"><path d="M3.5 7.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}</span>
        <span className="semana-habito__name">{h.name}</span>
        <span className="semana-habito__val">{progress}</span>
      </li>
    })}</ul>
  </section>
}



function daySummary(day: WeekDayDto, future: boolean): string {
  if (future) return 'todavía no'
  const meals = day.meals ?? []
  if (meals.length === 0) return 'sin comidas en el plan'
  const inPlan = meals.filter(m => m.status === 'EN_PLAN').length
  const loggedMeals = meals.filter(m => m.status !== 'SIN_ANOTAR').length
  return `${inPlan} de ${meals.length} comidas como el plan, ${loggedMeals} anotadas`
}

function hasFlexibleHabit(week: WeekSummaryDto, day: WeekDayDto): boolean {
  return week.habits.some(habit => habit.countsFlexibleMeals
    && (!day.habitIds || day.habitIds.includes(habit.id)))
}

interface DayDetailProps {
  day: WeekDayDto
  todayISO: string
  flexibleEnabled: boolean
}

function DayDetail({ day, todayISO, flexibleEnabled }: DayDetailProps) {
  const d = new Date(day.date + 'T12:00:00')
  const isToday = day.date === todayISO
  const recorded = Number(day.totalRecorded)
  const goal = Number(day.totalGoal)
  const meals = day.meals ?? []

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
            const status = flexibleEnabled && (meal.flexibleCount ?? 0) > 0 ? { label: 'Flexible', crumb: 'flexible' } : mealStatus(meal)
            return (
              <li key={meal.mealId} className="semana-comida">
                <span className="semana-comida__nombre">{meal.name}</span>
                <span className={`semana-comida__estado semana-comida__estado--${status.crumb}`}>{status.label}</span>
                {meal.noteText && <p className="semana-comida__nota">{meal.noteText}</p>}
              </li>
            )
          })}
        </ul>
      )}

      {meals.length === 0 && (
        <p className="semana-dia__vacio">Nada para mostrar este día.</p>
      )}
    </article>
  )
}

const SHORT_WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

// Tarjeta de sellos de la semana: una fila por comida del plan y una columna por día. Cada
// comida es una miga; si el plan de ese día no tiene esa comida, la celda lleva un guion.
function WeekCard({ week, todayISO, selected, onSelect }: {
  week: WeekSummaryDto
  todayISO: string
  selected: string
  onSelect: (date: string) => void
}) {
  const names = [...new Set(week.days.flatMap(day => (day.meals ?? []).map(meal => meal.name)))]
  const columns = week.days.length
  const selectedIndex = week.days.findIndex(day => day.date === selected)
  const hasNonApplicableMeals = week.days.some(day => names.some(name => !(day.meals ?? []).some(m => m.name === name)))
  return (
    <>
      <section className="semana-tarjeta" aria-label="Tarjeta de la semana">
        <div className="semana-tarjeta__grid" style={{ gridTemplateColumns: `76px repeat(${columns}, minmax(0, 1fr))` }}>
          {selectedIndex >= 0 && <span className="semana-tarjeta__banda" aria-hidden="true"
            style={{ width: `calc((100% - 76px) / ${columns})`, transform: `translateX(calc(76px + ${selectedIndex} * 100%))` }} />}
          <span aria-hidden="true" />
          <div className="semana-tira" role="group" aria-label="Días de la semana">
            {week.days.map(day => {
              const future = day.date > todayISO
              const isToday = day.date === todayISO
              const d = new Date(day.date + 'T12:00:00')
              return (
                <button
                  key={day.date}
                  type="button"
                  className={['semana-tira__dia', isToday ? 'semana-tira__dia--hoy' : '', future ? 'semana-tira__dia--futuro' : ''].filter(Boolean).join(' ')}
                  aria-pressed={day.date === selected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${fullDate(day.date)}${isToday ? ', hoy' : ''}: ${daySummary(day, future)}`}
                  onClick={() => onSelect(day.date)}
                >
                  <span className="semana-tira__letra" aria-hidden="true">{SHORT_WEEKDAYS[d.getDay()]}</span>
                  <span className="semana-tira__num" aria-hidden="true">{d.getDate()}</span>
                </button>
              )
            })}
          </div>
          <span className="semana-tarjeta__sep" aria-hidden="true" />
          {names.map(name => (
            <div key={name} className="semana-tarjeta__fila" aria-hidden="true">
              <span className="semana-tarjeta__comida">{name}</span>
              {week.days.map(day => {
                const meal = (day.meals ?? []).find(m => m.name === name)
                const className = !meal ? 'no-aplica' : day.date > todayISO ? 'futuro' : hasFlexibleHabit(week, day) && (meal.flexibleCount ?? 0) > 0 ? 'flexible' : mealStatus(meal).crumb
                return <span key={day.date} className="semana-tarjeta__celda"><i className={`semana-miga semana-miga--${className}`} /></span>
              })}
            </div>
          ))}
        </div>
      </section>
      <ul className="semana-leyenda" aria-hidden="true">
        <li><i className="semana-miga semana-miga--full" />Como el plan</li>
        <li><i className="semana-miga semana-miga--half" />Faltó o sobró algo</li>
        {week.days.some(day => hasFlexibleHabit(week, day)) && <li><i className="semana-miga semana-miga--flexible" />Flexible</li>}
        <li><i className="semana-miga semana-miga--empty" />Sin anotar</li>
        <li><i className="semana-miga semana-miga--futuro" />Todavía no</li>
        {hasNonApplicableMeals && <li><i className="semana-miga semana-miga--no-aplica" />No toca ese día</li>}
      </ul>
    </>
  )
}

// Exportar es solo descargar: el archivo queda en el celular y la persona lo manda a su nutri.
function ExportDialog({ range, onExcel, onPdf, onClose }: {
  range: string; onExcel: () => void; onPdf: () => void; onClose: () => void
}) {
  const ref = useDialogFocus<HTMLDivElement>(onClose)
  return createPortal(
    <div className="semana-overlay" onClick={onClose}>
      <div className="semana-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby="exportar-titulo"
        onClick={event => event.stopPropagation()}>
        <div className="semana-dialog__header">
          <h2 id="exportar-titulo">Exportar para tu nutri</h2>
          <button type="button" className="semana-dialog__cerrar" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <p className="semana-dialog__texto">
          La semana del {range}, con lo que escribiste en cada comida, cómo quedó y tus hábitos.
          Se descarga en tu celular y lo mandás vos: Miga no lo comparte con nadie.
        </p>
        <button type="button" className="semana-dialog__principal" onClick={onExcel}>Descargar planilla de Excel</button>
        <button type="button" className="semana-dialog__secundario" onClick={onPdf}>Descargar PDF</button>
        <p className="semana-dialog__nota">PDF abre la impresión del navegador: elegí «Descargar PDF».</p>
      </div>
    </div>,
    document.body,
  )
}

export default function WeekPage() {
  useTitle('Semana | Miga')
  const { token, email } = useAuth()
  const [view, setView] = useState<'day' | 'sheet'>('day')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportError, setExportError] = useState('')
  const [refDate, setRefDate] = useState(() => mondayOf(toISO(new Date())))
  const { data: week, status, retry } = useWeek(token, email, refDate)
  const loading = status === 'loading'
  const error = status === 'error' ? 'No se pudo cargar la semana.' : null
  const today = toISO(useNow())
  const [selection, setSelection] = useState<{ weekStart: string; date: string } | null>(null)

  async function download(format: 'xlsx' | 'pdf') {
    if (!token || !week) return
    setExportOpen(false)
    setExportError('')
    try { await exportWeek(token, week.weekStart, format) }
    catch { setExportError('No se pudo exportar la semana. Probá de nuevo.') }
  }

  const isCurrentWeek = week ? week.weekStart <= today && today <= week.weekEnd : false
  const selectedDate = week
    ? (selection?.weekStart === week.weekStart ? selection.date
      : isCurrentWeek ? today : week.days[0]?.date ?? week.weekStart)
    : null
  const selectedDay = week?.days.find(d => d.date === selectedDate)
  const pastDays = week?.days.filter(d => d.date <= today) ?? []
  const pastMeals = pastDays.flatMap(d => d.meals ?? [])
  const mealsInPlan = pastMeals.filter(m => m.status === 'EN_PLAN').length

  return (
    <div className="semana-page">
      <div className="semana-header">
        <div className="semana-header__top">
          <Brand size={20} />
        </div>
        <div className="semana-header__titulo">
          <h1 className="semana-title" tabIndex={-1}>Semana</h1>
          {week && token && (
            <button type="button" className="semana-exportar" onClick={() => setExportOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Exportar
            </button>
          )}
        </div>
        <div className="semana-nav">
          <button
            className="semana-nav__btn"
            onClick={() => setRefDate(r => addWeeks(r, -1))}
            aria-label="Semana anterior"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="semana-nav__title">
            {week ? formatRange(week.weekStart, week.weekEnd) : '…'}
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
        {exportError && <p className="semana-error" role="alert">{exportError}</p>}
        {loading && <LoadingSkeleton label="Cargando…">
          <Skeleton />
          <div className="loading-skeleton__strip">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} shape="block" />)}</div>
          {Array.from({ length: 7 }, (_, i) => <div key={i} className="loading-skeleton__row"><Skeleton /><Skeleton shape="block" /></div>)}
        </LoadingSkeleton>}

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

            {pastMeals.length > 0 && (
              <p className="semana-resumen__texto">
                <span className="semana-resumen__num">{mealsInPlan}<small> de {pastMeals.length}</small></span>
                <span>comidas como el plan esta semana</span>
              </p>
            )}
            <div className="semana-seg" role="group" aria-label="Vista de la semana">
              <span className="semana-seg__pastilla" aria-hidden="true" style={{ transform: view === 'day' ? 'translateX(0)' : 'translateX(100%)' }} />
              <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}>Tarjeta</button>
              <button type="button" aria-pressed={view === 'sheet'} onClick={() => setView('sheet')}>Planilla</button>
            </div>
            {view === 'day' ? (
              <>
                <WeekCard
                  week={week}
                  todayISO={today}
                  selected={selectedDate ?? ''}
                  onSelect={date => setSelection({ weekStart: week.weekStart, date })}
                />
                {selectedDay && (
                  <DayDetail
                    key={selectedDay.date}
                    day={selectedDay}
                    flexibleEnabled={hasFlexibleHabit(week, selectedDay)}
                    todayISO={today}
                  />
                )}
              </>
            ) : <WeekSheet week={week} todayISO={today} />}
            <WeeklyHabitSummary week={week} />
          </>
        )}
        {exportOpen && week && (
          <ExportDialog range={formatRange(week.weekStart, week.weekEnd)} onExcel={() => void download('xlsx')}
            onPdf={() => void download('pdf')} onClose={() => setExportOpen(false)} />
        )}

      </div>
    </div>
  )
}

// En la planilla la fecha va corta ("Lun 2") para que entren las comidas; el nombre accesible es la fecha completa.
function shortDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const day = d.toLocaleDateString('es-UY', { weekday: 'short' }).replace(/\./g, '')
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${d.getDate()}`
}

function WeekSheet({ week, todayISO }: { week: WeekSummaryDto; todayISO: string }) {
  const meals = [...new Set(week.days.flatMap(day => (day.meals ?? []).map(meal => meal.name)))]
  return <div className="semana-sheet"><table>
    <caption>Comidas de la semana</caption>
    <thead><tr><th scope="col">Fecha</th>{meals.map(name => <th scope="col" key={name}>{name}</th>)}
    </tr></thead>
    <tbody>{week.days.map(day => <tr key={day.date}>
      <th scope="row" aria-current={day.date === todayISO ? 'date' : undefined} aria-label={`${fullDate(day.date)}${day.date === todayISO ? ', hoy' : ''}`}>
        <time dateTime={day.date}>{shortDate(day.date)}</time>
        {day.date === todayISO && <span className="semana-sheet__hoy"> · Hoy</span>}
      </th>
      {meals.map(name => <td className="semana-note" key={name}>{(day.meals ?? []).filter(m => m.name === name).map(m => m.noteText).filter(Boolean).join('\n') || '—'}</td>)}
    </tr>)}</tbody>
  </table></div>
}
