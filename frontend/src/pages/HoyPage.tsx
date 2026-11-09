import './HoyPage.css'
import { MealRow } from './hoy/MealRow'
import { MealAhora } from './hoy/MealAhora'
import { type DraftStore } from './hoy/NotaMealSection'
import {
  buildGroupsMap,
  toISO,
  addDays,
  formatLongDate,
  dateLabel,
  greeting,
  formatName,
  findCurrentMealIndex,
  fmt,
  calculateDaySummary,
  adjustSummary,
} from './hoy/helpers'
import Skeleton, { LoadingSkeleton } from '../components/Skeleton'
import { useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import Migas from '../components/Migas'
import { useTitle } from '../hooks/useTitle'
import { useAhora } from '../hooks/useAhora'
import { type MealDayDto, type NoteInterpretationDto, type PatchItemResultDto } from '../api/registro'
import TodayHabits from '../components/TodayHabits'
import { usePlan } from '../hooks/usePlan'
import { useDayRegistro } from '../hooks/useDayRegistro'

export default function HoyPage() {
  const { token, email } = useAuth()
  return <HoyContent key={JSON.stringify([email, token])} />
}

function HoyContent() {
  useTitle('Hoy | Miga')
  const now = useAhora()
  const TODAY = toISO(now)
  const { token, email, firstName } = useAuth()
  const [date, setDate] = useState(TODAY)
  const planLoad = usePlan(token, email, date)
  const plan = planLoad.data
  const withoutPlan = planLoad.status === 'empty' && !plan
  const { data: dayRecord, setData: setDayRecord, status: dayStatus, retry: retryDay, reload: reloadDay } = useDayRegistro(token, email, date)
  const loading = planLoad.status === 'loading' || (!!plan && dayStatus === 'loading' && !dayRecord)
  const dayError = dayStatus === 'error'
  const [dayOpen, setDayOpen] = useState<boolean | null>(null)
  const [drafts] = useState<DraftStore>(() => new Map())
  const groupsMap = useMemo(() => plan ? buildGroupsMap(plan.foodGroups ?? []) : {}, [plan])

  const [previousToday, setPreviousToday] = useState(TODAY)
  if (previousToday !== TODAY) {
    setPreviousToday(TODAY)
    if (date === previousToday) setDate(TODAY)
  }

  function changeDay(delta: number) {
    setDate(f => addDays(f, delta))
  }

  const handleNoteSaved = useCallback((interp: NoteInterpretationDto, mealId: number) => {
    setDayRecord(prev => {
      if (!prev) return prev
      const updatedMeal: MealDayDto = {
        mealId,
        noteId: interp.noteId,
        noteVersion: interp.version,
        noteText: interp.text,
        items: interp.entries,
        comparison: interp.comparison,
      }
      const previous = prev.meals.find(m => m.mealId === mealId)
      const meals = previous
        ? prev.meals.map(m => m.mealId === mealId ? updatedMeal : m)
        : [...prev.meals, updatedMeal]
      return { ...prev, meals, summary: adjustSummary(prev.summary, previous?.items ?? [], interp.entries, groupsMap) }
    })
  }, [setDayRecord, groupsMap])

  const handleNoteDeleted = useCallback((mealId: number, version: number | null) => {
    setDayRecord(prev => {
      if (!prev) return prev
      const previous = prev.meals.find(m => m.mealId === mealId)
      return {
        ...prev,
        meals: prev.meals.map(m => m.mealId === mealId ? { ...m, noteText: '', noteVersion: version, items: [], comparison: [] } : m),
        summary: adjustSummary(prev.summary, previous?.items ?? [], [], groupsMap),
      }
    })
  }, [setDayRecord, groupsMap])

  const handleItemPatched = useCallback((mealId: number, result: PatchItemResultDto) => {
    setDayRecord(prev => {
      if (!prev) return prev
      const meals = prev.meals.map(m => {
        if (m.mealId !== mealId) return m
        const at = m.items.findIndex(it => result.replacedItemIds.includes(it.id))
        const kept = m.items.filter(it => !result.replacedItemIds.includes(it.id))
        const items = at < 0 ? [...kept, ...result.items]
          : [...kept.slice(0, at), ...result.items, ...kept.slice(at)]
        return { ...m, items }
      })
      return { ...prev, meals }
    })
    if (token) {
      reloadDay().catch(() => {})
    }
  }, [token, reloadDay, setDayRecord])

  const handleAnswerSaved = useCallback(async (_mealId: number) => {
    if (!token) return
    await reloadDay()
  }, [token, reloadDay])

  const isToday = date === TODAY
  const name = firstName ?? formatName(email ?? undefined)
  const meals = plan?.meals.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? []
  const calculatedCurrentMeal = isToday && plan ? meals[findCurrentMealIndex(meals, now)]?.id ?? null : null
  const [fixedCurrentMeal, setFixedCurrentMeal] = useState<{ date: string; id: number | null }>({ date, id: calculatedCurrentMeal })
  const currentMealId = fixedCurrentMeal.date === date ? fixedCurrentMeal.id : calculatedCurrentMeal
  // Al cambiar de día se actualiza siempre; dentro del día, la comida de ahora solo cambia
  // si no hay un borrador sin guardar, para no mover el editor mientras se escribe.
  if (fixedCurrentMeal.date !== date || (fixedCurrentMeal.id !== calculatedCurrentMeal && (fixedCurrentMeal.id === null
    || ![...drafts.entries()].some(([key, d]) => key.startsWith(`${date}-`) && d.dirty)))) {
    setFixedCurrentMeal({ date, id: calculatedCurrentMeal })
  }
  const currentMealIndex = currentMealId === null ? -1 : meals.findIndex(m => m.id === currentMealId)
  const { total, done, byGroup } = calculateDaySummary(dayRecord, meals, groupsMap)
  const withoutNotes = !dayRecord?.meals.some(m => m.noteText)
  const currentMeal = currentMealIndex >= 0 ? meals[currentMealIndex] : null
  // Con la comida de ahora en el medio, lo anterior queda en "Antes" y lo que falta en "Después".
  const earlierMeals = currentMealIndex >= 0 ? meals.slice(0, currentMealIndex) : []
  const laterMeals = currentMealIndex >= 0 ? meals.slice(currentMealIndex + 1) : meals

  const title = isToday ? (
    <>{name ? `${greeting(now)}, ${name}` : greeting(now)}<span className="punto-miga">.</span></>
  ) : formatLongDate(date)

  const dateNavigation = (
    <nav className="hoy-fecha-nav" aria-label="Navegación por fecha">
      <button
        className="hoy-fecha-nav__btn"
        onClick={() => changeDay(-1)}
        aria-label="Día anterior"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <span className="hoy-fecha-nav__label">{dateLabel(date, TODAY)}</span>
      <button
        className="hoy-fecha-nav__btn"
        onClick={() => changeDay(1)}
        disabled={isToday}
        aria-label="Día siguiente"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </nav>
  )

  const reloadPlan = planLoad.reload
  const handleReload = useCallback(async () => {
    const [, day] = await Promise.all([reloadPlan(), reloadDay()])
    return day
  }, [reloadPlan, reloadDay])

  const mealProps = {
    drafts,
    date,
    token: token!,
    groupsMap,
    onNoteSaved: handleNoteSaved,
    onItemPatched: handleItemPatched,
    onNoteDeleted: handleNoteDeleted,
    // Un conflicto puede venir de un plan desactualizado: se recargan el plan y el día.
    onReload: handleReload,
    onAnswerSaved: handleAnswerSaved,
  }

  return (
    <div className="hoy-page">
      <header className="hoy-header">
        <div className="hoy-header__top">
          <Brand size={20} />
          {dateNavigation}
        </div>
        <h1 className="hoy-header__titulo">{title}</h1>
      </header>

      <div className="hoy-body">
        <div className="hoy-desktop-saludo">
          {dateNavigation}
          <h1 className="hoy-desktop-saludo__titulo">{title}</h1>
        </div>
        {loading ? (
          <LoadingSkeleton label="Cargando tu día…">
            <Skeleton />
            <div className="loading-skeleton__card"><Skeleton /><Skeleton shape="block" /><Skeleton /></div>
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="loading-skeleton__row"><Skeleton /><Skeleton shape="block" /></div>)}
          </LoadingSkeleton>
        ) : planLoad.status === 'error' ? (
          <p role="alert">No se pudo cargar el plan. <button onClick={planLoad.retry}>Reintentar</button></p>
        ) : withoutPlan ? (
          <div className="hoy-sin-plan">
            <p className="hoy-sin-plan__titulo">Todavía no tenés un plan</p>
            <p className="hoy-sin-plan__texto">
              Cargá el plan que te dio tu nutricionista y organizá tu día.
            </p>
            <Link to="/onboarding" className="btn-cargar-plan">Cargar mi plan</Link>
            <Link to="/mi-plan" className="btn-cargar-plan-manual">Cargar yo solo</Link>
          </div>
        ) : (
          <>
            {dayError && (
              <p className="hoy-intake-error" role="alert">
                No se pudo cargar el registro del día.{' '}
                <button
                  className="hoy-intake-error__retry"
                  onClick={retryDay}
                  type="button"
                >
                  Reintentar
                </button>
              </p>
            )}

            {currentMeal && (
              <MealAhora
                key={`${date}-${currentMeal.id}`}
                meal={currentMeal}
                mealDay={dayRecord?.meals.find(m => m.mealId === currentMeal.id)}
                {...mealProps}
              />
            )}

            <TodayHabits key={date} date={date} revision={dayRecord} />

            {total > 0 && (
              <details
                className="hoy-dia"
                open={dayOpen ?? (withoutNotes || !currentMeal)}
                onToggle={e => setDayOpen(e.currentTarget.open)}
              >
                <summary className="hoy-dia__summary">
                  <span className="hoy-dia__titulo">Tu día por grupo</span>
                  <span className="hoy-dia__total">{fmt(done)} de {fmt(total)} porciones</span>
                  <svg className="hoy-dia__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                {withoutNotes && isToday && (
                  <p className="hoy-dia__explicacion">
                    Todavía no anotaste nada hoy. Cada porción de tu plan es una miga: se rellena
                    cuando la comés, y la media miga es media porción.
                  </p>
                )}
                <Migas rows={byGroup} />
              </details>
            )}

            {[
              { key: 'despues', title: currentMeal ? 'Después' : 'Comidas', list: laterMeals },
              { key: 'antes', title: 'Antes', list: earlierMeals },
            ].filter(section => section.list.length > 0).map(section => (
              <section key={section.key} className="hoy-resto" aria-labelledby={`hoy-${section.key}-titulo`}>
                <h2 id={`hoy-${section.key}-titulo`} className="hoy-resto__titulo">{section.title}</h2>
                <ul className="hoy-filas">
                  {section.list.map(meal => (
                    <MealRow
                      key={`${date}-${meal.id ?? meal.name}`}
                      meal={meal}
                      mealDay={dayRecord?.meals.find(m => m.mealId === meal.id)}
                      {...mealProps}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
