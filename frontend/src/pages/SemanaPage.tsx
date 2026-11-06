import { mealStatus } from '../lib/mealStatus'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import { exportWeek, logHabit, type HabitDto, type HabitLogDto, type WeekDayDto, type WeekSummaryDto } from '../api/semana'
import './SemanaPage.css'
import { useWeek } from '../hooks/useWeek'
import { useAhora } from '../hooks/useAhora'
import { useDialogFocus } from './useDialogFocus'

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
            const estado = mealStatus(meal)
            return (
              <li key={meal.mealId} className="semana-comida">
                <span className="semana-comida__nombre">{meal.name}</span>
                <span className={`semana-comida__estado semana-comida__estado--${estado.miga}`}>{estado.label}</span>
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
                    <div role="group" aria-label={`${h.name}: ${progress}, ${fullDate(day.date)}, ${done ? 'completado' : 'pendiente'}`} className={`semana-habito${done ? ' semana-habito--ok' : ''}`}>
                      <span className="semana-habito__check" aria-hidden="true">{check}</span>
                      <span className="semana-habito__name">{h.name}</span>
                      <span className="semana-habito__val">{progress}</span>
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
                      aria-label={hasGoal(h) ? `${h.name}: ${progress}, ${fullDate(day.date)}, ${done ? 'completado' : 'pendiente'}` : `${h.name}: ${done ? 'completado' : 'pendiente'}, ${progress}, ${fullDate(day.date)}`}
                      aria-pressed={done}
                    >
                      <span className="semana-habito__check" aria-hidden="true">{check}</span>
                      <span className="semana-habito__name">{h.name}</span>
                      {h.countsFlexibleMeals && (
                        <span className="semana-habito__val">{progress}</span>
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

const DIA_CORTO = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

// Tarjeta de sellos de la semana: una fila por comida del plan y una columna por día. Cada
// comida es una miga; si el plan de ese día no tiene esa comida, la celda lleva un guion.
function WeekCard({ week, todayISO, selected, onSelect }: {
  week: WeekSummaryDto
  todayISO: string
  selected: string
  onSelect: (date: string) => void
}) {
  const nombres = [...new Set(week.days.flatMap(day => (day.meals ?? []).map(meal => meal.name)))]
  const columnas = week.days.length
  const elegido = week.days.findIndex(day => day.date === selected)
  const hayNoAplica = week.days.some(day => nombres.some(nombre => !(day.meals ?? []).some(m => m.name === nombre)))
  return (
    <>
      <section className="semana-tarjeta" aria-label="Tarjeta de la semana">
        <div className="semana-tarjeta__grid" style={{ gridTemplateColumns: `76px repeat(${columnas}, minmax(0, 1fr))` }}>
          {elegido >= 0 && <span className="semana-tarjeta__banda" aria-hidden="true"
            style={{ width: `calc((100% - 76px) / ${columnas})`, transform: `translateX(calc(76px + ${elegido} * 100%))` }} />}
          <span aria-hidden="true" />
          <div className="semana-tira" role="group" aria-label="Días de la semana">
            {week.days.map(day => {
              const futuro = day.date > todayISO
              const isToday = day.date === todayISO
              const d = new Date(day.date + 'T12:00:00')
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
                  <span className="semana-tira__letra" aria-hidden="true">{DIA_CORTO[d.getDay()]}</span>
                  <span className="semana-tira__num" aria-hidden="true">{d.getDate()}</span>
                </button>
              )
            })}
          </div>
          <span className="semana-tarjeta__sep" aria-hidden="true" />
          {nombres.map(nombre => (
            <div key={nombre} className="semana-tarjeta__fila" aria-hidden="true">
              <span className="semana-tarjeta__comida">{nombre}</span>
              {week.days.map(day => {
                const meal = (day.meals ?? []).find(m => m.name === nombre)
                const clase = !meal ? 'no-aplica' : day.date > todayISO ? 'futuro' : mealStatus(meal).miga
                return <span key={day.date} className="semana-tarjeta__celda"><i className={`semana-miga semana-miga--${clase}`} /></span>
              })}
            </div>
          ))}
        </div>
      </section>
      <ul className="semana-leyenda" aria-hidden="true">
        <li><i className="semana-miga semana-miga--full" />Como el plan</li>
        <li><i className="semana-miga semana-miga--half" />Faltó o sobró algo</li>
        <li><i className="semana-miga semana-miga--noted" />Anotada</li>
        <li><i className="semana-miga semana-miga--empty" />Sin anotar</li>
        <li><i className="semana-miga semana-miga--futuro" />Todavía no</li>
        {hayNoAplica && <li><i className="semana-miga semana-miga--no-aplica" />No toca ese día</li>}
      </ul>
    </>
  )
}

// Exportar es solo descargar: el archivo queda en el celular y la persona lo manda a su nutri.
function ExportDialog({ rango, onExcel, onPdf, onClose }: {
  rango: string; onExcel: () => void; onPdf: () => void; onClose: () => void
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
          La semana del {rango}, con lo que escribiste en cada comida, cómo quedó y tus hábitos.
          Se descarga en tu celular y lo mandás vos: Miga no lo comparte con nadie.
        </p>
        <button type="button" className="semana-dialog__principal" onClick={onExcel}>Descargar planilla de Excel</button>
        <button type="button" className="semana-dialog__secundario" onClick={onPdf}>Guardar como PDF</button>
        <p className="semana-dialog__nota">PDF abre la impresión del navegador: elegí «Guardar como PDF».</p>
      </div>
    </div>,
    document.body,
  )
}

export default function SemanaPage() {
  useTitle('Semana | Miga')
  const { token, email } = useAuth()
  const [view, setView] = useState<'day' | 'sheet'>('day')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportError, setExportError] = useState('')
  const [refDate, setRefDate] = useState(() => mondayOf(toISO(new Date())))
  const { data: week, setData: setWeek, status, retry } = useWeek(token, email, refDate)
  const loading = status === 'loading'
  const error = status === 'error' ? 'No se pudo cargar la semana.' : null
  const hoy = toISO(useAhora())
  const [seleccion, setSeleccion] = useState<{ weekStart: string; date: string } | null>(null)

  async function download() {
    if (!token || !week) return
    setExportOpen(false)
    setExportError('')
    try { await exportWeek(token, week.weekStart, 'xlsx') }
    catch { setExportError('No se pudo exportar la semana. Probá de nuevo.') }
  }

  // El PDF sale de la planilla: se muestra y se abre la impresión del navegador.
  function imprimir() {
    setExportOpen(false)
    setView('sheet')
    window.setTimeout(() => window.print(), 50)
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

            {comidasPasadas.length > 0 && (
              <p className="semana-resumen__texto">
                <span className="semana-resumen__num">{comidasEnPlan}<small> de {comidasPasadas.length}</small></span>
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
                  todayISO={hoy}
                  selected={selectedDate ?? ''}
                  onSelect={date => setSeleccion({ weekStart: week.weekStart, date })}
                />
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
            <WeeklyHabitSummary week={week} />
          </>
        )}
        {exportOpen && week && (
          <ExportDialog rango={formatRango(week.weekStart, week.weekEnd)} onExcel={() => void download()}
            onPdf={imprimir} onClose={() => setExportOpen(false)} />
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
      {week.habits.map(h => <td key={h.id} aria-label={hasGoal(h) ? `${h.name}: ${day.habitIds && !day.habitIds.includes(h.id) ? 'No corresponde' : habitProgress(h, Number(day.habitLogs.find(l => l.habitId === h.id)?.value ?? 0))}, ${fullDate(day.date)}` : undefined}>
        {day.habitIds && !day.habitIds.includes(h.id) ? '—' : habitProgress(h, Number(day.habitLogs.find(l => l.habitId === h.id)?.value ?? 0))}
      </td>)}
    </tr>)}</tbody>
  </table></div>
}
