import './TodayPage.css'
import { DayStrip } from './today/DayStrip'
import { MealPanel } from './today/MealPanel'
import { type DraftStore } from './today/MealNoteSection'
import {
  buildGroupsMap,
  toISO,
  addDays,
  formatLongDate,
  dateLabel,
  greeting,
  formatName,
  findCurrentMealIndex,
  findInitialMealIndex,
  resolveDate,
  calculateDaySummary,
  adjustSummary,
} from './today/helpers'
import Skeleton, { LoadingSkeleton } from '../components/Skeleton'
import { useMemo, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import { useNow } from '../hooks/useNow'
import { type MealDayDto, type NoteInterpretationDto, type PatchItemResultDto } from '../api/records'
import TodayHabits from '../components/TodayHabits'
import { usePlan } from '../hooks/usePlan'
import { useDayRecord } from '../hooks/useDayRecord'

export default function TodayPage() {
  const { token, email } = useAuth()
  return <TodayContent key={JSON.stringify([email, token])} />
}

function TodayContent() {
  useTitle('Hoy | Miga')
  const now = useNow()
  const TODAY = toISO(now)
  const { token, email, firstName } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const date = resolveDate(searchParams.get('fecha'), TODAY)
  function setDate(value: string) {
    setSearchParams(value === TODAY ? {} : { fecha: value })
  }
  const planLoad = usePlan(token, email, date)
  const plan = planLoad.data
  const withoutPlan = planLoad.status === 'empty' && !plan
  const { data: dayRecord, setData: setDayRecord, status: dayStatus, retry: retryDay, reload: reloadDay } = useDayRecord(token, email, date)
  const loading = planLoad.status === 'loading' || (!!plan && dayStatus === 'loading' && !dayRecord)
  const dayError = dayStatus === 'error'
  const [drafts] = useState<DraftStore>(() => new Map())
  const groupsMap = useMemo(() => plan ? buildGroupsMap(plan.foodGroups ?? []) : {}, [plan])

  function changeDay(delta: number) {
    setDate(addDays(date, delta))
  }

  const handleNoteSaved = useCallback((interp: NoteInterpretationDto, mealId: number, submittedText?: string) => {
    // El panel puede haberse desmontado mientras se guardaba la nota.
    if (submittedText !== undefined) {
      const key = `${interp.date}-${mealId}`
      const current = drafts.get(key)
      drafts.set(key, current && current.text !== submittedText
        ? { ...current, baseVersion: interp.version, dirty: true }
        : { text: interp.text, baseVersion: interp.version, dirty: false, conflict: false })
    }
    setDayRecord(prev => {
      if (!prev) return prev
      const updatedMeal: MealDayDto = {
        mealId,
        status: interp.status,
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
  }, [setDayRecord, groupsMap, drafts])

  const handleNoteDeleted = useCallback((mealId: number, version: number | null, submittedText: string) => {
    // El panel puede haberse desmontado mientras se borraba la nota.
    const key = `${date}-${mealId}`
    const current = drafts.get(key)
    drafts.set(key, current && current.text !== submittedText
      ? { ...current, baseVersion: version, dirty: true }
      : { text: '', baseVersion: version, dirty: false, conflict: false })
    setDayRecord(prev => {
      if (!prev) return prev
      const previous = prev.meals.find(m => m.mealId === mealId)
      return {
        ...prev,
        meals: prev.meals.map(m => m.mealId === mealId ? { ...m, status: 'SIN_ANOTAR', noteText: '', noteVersion: version, items: [], comparison: [] } : m),
        summary: adjustSummary(prev.summary, previous?.items ?? [], [], groupsMap),
      }
    })
  }, [setDayRecord, groupsMap, drafts, date])

  const handleItemPatched = useCallback((mealId: number, result: PatchItemResultDto) => {
    setDayRecord(prev => {
      if (!prev) return prev
      const meals = prev.meals.map(m => {
        if (m.mealId !== mealId) return m
        const at = m.items.findIndex(it => result.replacedItemIds.includes(it.id))
        const kept = m.items.filter(it => !result.replacedItemIds.includes(it.id))
        const items = at < 0 ? [...kept, ...result.items]
          : [...kept.slice(0, at), ...result.items, ...kept.slice(at)]
        return { ...m, items, status: result.status }
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
  const nextIndex = isToday ? findCurrentMealIndex(meals, now, dayRecord?.meals) : -1
  const initialIndex = nextIndex >= 0 ? nextIndex : findInitialMealIndex(meals, dayRecord?.meals)
  const [selection, setSelection] = useState<{ date: string; id: number | undefined; nextId: number | undefined } | null>(null)
  const nextId = meals[nextIndex]?.id
  const hasDraft = [...drafts.entries()].some(([key, draft]) => key.startsWith(`${date}-`) && draft.dirty)
  const selectedId = selection?.date === date ? selection.id : meals[initialIndex]?.id
  const currentMeal = meals.find(meal => meal.id === selectedId)
  if (!loading && meals.length && (selection?.date !== date || !currentMeal)) {
    setSelection({ date, id: meals[initialIndex]?.id, nextId })
  } else if (!loading && meals.length && selection?.nextId !== nextId) {
    const keepSavedPanel = dayRecord?.meals.some(meal => meal.mealId === selection?.nextId && meal.status !== 'SIN_ANOTAR')
    if (keepSavedPanel || !hasDraft) {
      setSelection({ date, id: keepSavedPanel ? selectedId : meals[initialIndex]?.id, nextId })
    }
  }
  const { total, done, byGroup } = calculateDaySummary(dayRecord, meals, groupsMap)

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

            <DayStrip key={`strip-${date}`} meals={meals} records={dayRecord?.meals ?? []} selectedId={selectedId}
              nextId={nextId} total={total} done={done} rows={byGroup}
              onSelect={id => setSelection({ date, id, nextId })} />
            {currentMeal && (
              <MealPanel key={`${date}-${currentMeal.id}`} meal={currentMeal}
                mealDay={dayRecord?.meals.find(m => m.mealId === currentMeal.id)}
                next={currentMeal.id === nextId} {...mealProps} />
            )}
            <TodayHabits key={date} date={date} revision={dayRecord} />
          </>
        )}
      </div>
    </div>
  )
}
