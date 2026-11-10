import MealSheet from './plan/MealSheet'
import Miga from '../components/Miga'
import Skeleton, { LoadingSkeleton } from '../components/Skeleton'
import { groupColor } from '../groupColors'
import { useContext, useCallback, useEffect, useRef, useState } from 'react'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { UNSAFE_DataRouterContext, useBlocker, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import {
  getMyPlan, getPlanHistory, saveMyPlan, PlanConflictError,
  type PlanFoodGroupDto, type PlanDto, type PlanSummaryDto,
} from '../api/plans'
import { getPlanRules, type PlanRules } from '../api/planRules'
import PlanRulesSection from './plan/PlanRulesSection'
import './MyPlanPage.css'
import { usePlan } from '../hooks/usePlan'

const DEFAULT_GROUPS: PlanFoodGroupDto[] = [
  { id: -1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
  { id: -2, name: 'Cereales',  abbreviation: 'CER', displayOrder: 2, color: null },
  { id: -3, name: 'Frutas',    abbreviation: 'FRU', displayOrder: 3, color: null },
  { id: -4, name: 'Lácteos',   abbreviation: 'LAC', displayOrder: 4, color: null },
  { id: -5, name: 'Grasas',    abbreviation: 'GRA', displayOrder: 5, color: null },
  { id: -6, name: 'Verduras',  abbreviation: 'VER', displayOrder: 6, color: null },
]

type Portions = Record<number, number>

interface LocalMeal {
  name: string
  time: string
  portions: Portions
  weekdays?: number[] | null
}

function emptyPortions(groups: PlanFoodGroupDto[]): Portions {
  return Object.fromEntries(groups.map(g => [g.id, 0]))
}

function planToLocal(dto: PlanDto): LocalMeal[] {
  return dto.meals
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(meal => {
      const portions: Portions = {}
      meal.portions.forEach(p => { portions[p.foodGroupId] = p.portions })
      const time = meal.suggestedTime ? meal.suggestedTime.slice(0, 5) : ''
      return { name: meal.name, time, portions, weekdays: meal.weekdays }
    })
}

function localToPlan(meals: LocalMeal[], groups: PlanFoodGroupDto[]) {
  return {
    meals: meals.map((c, i) => ({
      name: c.name,
      weekdays: c.weekdays,
      suggestedTime: c.time ? c.time + ':00' : undefined,
      displayOrder: i + 1,
      portions: groups.map(g => ({ foodGroupAbbr: g.abbreviation, portions: c.portions[g.id] ?? 0 })),
    })),
  }
}

// Porciones con coma decimal (es-UY).
function formatPortion(value: number) {
  return String(value).replace('.', ',')
}

function formatDate(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })
}

function PlanDetailModal({ plan, onClose }: { plan: PlanSummaryDto; onClose: () => void }) {
  const groupsById = Object.fromEntries((plan.foodGroups ?? []).map(g => [g.id, g]))
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Detalle del plan"
        onClick={e => e.stopPropagation()}>
        <div className="modal-card__header">
          <div>
            <p className="modal-card__eyebrow">Plan anterior</p>
            <p className="modal-card__rango">
              <span>Desde {formatDate(plan.createdAt)}</span>
              <span className="modal-card__rango-sep">→</span>
              <span>Hasta {formatDate(plan.supersededAt)}</span>
            </p>
          </div>
          <button className="modal-card__close" onClick={onClose} aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-card__meals">
          {plan.meals.map((meal, i) => (
            <div key={i} className="modal-meal">
              <p className="modal-meal__nombre">{meal.name}</p>
              <div className="modal-meal__chips">
                {meal.portions.filter(p => p.portions > 0).map(p => {
                  const g = groupsById[p.foodGroupId]
                  if (!g) return null
                  const color = groupColor(g, plan.foodGroups.indexOf(g))
                  return (
                    <span key={p.foodGroupId} className="porcion-chip" style={{ '--chip-dot': color } as React.CSSProperties}>
                      <span className="porcion-chip__num">{formatPortion(Number(p.portions))}</span>
                      {g.name}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

type Tab = 'resumen' | 'rules'

export default function MyPlanPage() {
  const { token, email } = useAuth()
  return <PlanLoader key={JSON.stringify([email, token])} />
}

function PlanLoader() {
  useTitle('Mi plan | Miga')
  const { token, email } = useAuth()
  const { data, status, retry } = usePlan(token, email)
  // "Ajustar en Mi plan" desde Hoy abre directo la pestaña de reglas.
  const location = useLocation()
  const [tab, setTab] = useState<Tab>(() => (location.state as { tab?: Tab } | null)?.tab === 'rules' ? 'rules' : 'resumen')
  return <PlanEditor initialPlan={data} loading={status === 'loading'} loadError={status === 'error'} retry={retry} tab={tab} setTab={setTab} />
}

function NavigationGuard({ dirty, busy }: { dirty: boolean; busy: boolean }) {
  const blocker = useBlocker(dirty || busy)
  // Si los cambios se guardaron o se revirtieron mientras la navegación esperaba, sigue su curso.
  useEffect(() => {
    if (blocker.state === 'blocked' && !dirty && !busy) blocker.proceed()
  }, [blocker, dirty, busy])
  return blocker.state === 'blocked' && <div role="alert" aria-label="Cambios sin guardar">
    <p>Tenés cambios sin guardar. ¿Querés descartarlos?</p>
    <button disabled={busy} onClick={() => blocker.proceed()}>Descartar cambios</button>
    <button onClick={() => blocker.reset()}>Seguir editando</button>
  </div>
}

function PlanEditor({ initialPlan, loading, loadError, retry, tab, setTab }: {
  initialPlan: PlanDto | null; loading: boolean; loadError: boolean; retry: () => void
  tab: Tab; setTab: (tab: Tab) => void
}) {
  useTitle('Mi plan | Miga')
  const { token } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const fromWizard = !!(location.state as { meals?: unknown } | null)?.meals

  const [rulesSection, setRulesSection] = useState('groups')
  const [counts, setCounts] = useState<{ foods: number; habits: number } | null>(null)
  const [savedPlan, setSavedPlan] = useState(initialPlan)
  const dataRouter = useContext(UNSAFE_DataRouterContext)
  const [rulesDirty, setRulesDirty] = useState(false)
  const [rulesBusy, setRulesBusy] = useState(false)
  const [discard, setDiscard] = useState(false)
  const summaryTrigger = useRef('groups')
  useEffect(() => {
    if (!token) return
    let active = true
    getPlanRules(token).then(rules => {
      if (active) setCounts({ foods: rules.alimentos.length, habits: rules.habitos.length })
    }).catch(() => {})
    return () => { active = false }
  }, [token])
  function returnToSummary() {
    setRulesDirty(false)
    setTab('resumen')
    setDiscard(false)
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-summary-target="${summaryTrigger.current}"]`)?.focus()
    })
  }

  function cancelEditing() {
    if (confirming || rulesBusy) return
    if (hasChanges || rulesDirty) {
      setDiscard(true)
    } else returnToSummary()
  }
  const [sheetDirty, setSheetDirty] = useState(false)
  const [groups, setGroups] = useState<PlanFoodGroupDto[]>(initialPlan?.foodGroups ?? DEFAULT_GROUPS)
  const [meals, setMeals] = useState<LocalMeal[]>(() => initialPlan ? planToLocal(initialPlan) :
    ((location.state as { meals?: { name: string; suggestedTime: string | null }[] } | null)?.meals ?? []).map(meal => ({
      name: meal.name, time: meal.suggestedTime?.slice(0, 5) ?? '',
      portions: emptyPortions(DEFAULT_GROUPS),
    })))
  const hasChanges = JSON.stringify(localToPlan(meals, groups)) !== JSON.stringify(localToPlan(savedPlan ? planToLocal(savedPlan) : [], groups))
  const [reloading, setReloading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!hasChanges && !rulesDirty && !sheetDirty) return
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  }, [hasChanges, rulesDirty, sheetDirty])
  const [planHistory, setPlanHistory] = useState<PlanSummaryDto[]>([])
  const [planDetail, setPlanDetail] = useState<PlanSummaryDto | null>(null)
  const [planVersion, setPlanVersion] = useState<number | undefined>(initialPlan?.version)
  const [confirmed, setConfirmed] = useState(false)
  const [goToToday, setGoToToday] = useState(false)
  useEffect(() => {
    if (goToToday && !confirming) navigate('/hoy', { replace: true })
  }, [goToToday, confirming, navigate])
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [sheetIndex, setSheetIndex] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [loadedPlan, setLoadedPlan] = useState(initialPlan)
  if (loadedPlan !== initialPlan) {
    setLoadedPlan(initialPlan)
    setSavedPlan(initialPlan)
    setGroups(initialPlan?.foodGroups ?? DEFAULT_GROUPS)
    setMeals(initialPlan ? planToLocal(initialPlan) : [])
    setPlanVersion(initialPlan?.version)
  }


  const [previousLocation, setPreviousLocation] = useState(location)
  if (previousLocation.key !== location.key) {
    setPreviousLocation(location)
    if (previousLocation.pathname === location.pathname) {
      setMeals(savedPlan ? planToLocal(savedPlan) : [])
      setRulesDirty(false)
      setDiscard(false)
      setError(null)
      setConflict(false)
      setTab('resumen')
    }
  }

  // Una edición de reglas puede crear una versión nueva del plan con otros ids de
  // grupos: se recargan las comidas para no confirmar porciones con ids viejos.
  const handleRulesChanged = useCallback((dto: PlanRules) => {
    setCounts({ foods: dto.alimentos.length, habits: dto.habitos.length })
    setGroups(dto.grupos)
    setPlanVersion(dto.planVersion)
    if (!token) return
    getMyPlan(token)
      .then(plan => {
        setSavedPlan(plan)
        setGroups(plan.foodGroups ?? DEFAULT_GROUPS)
        setMeals(planToLocal(plan))
        setPlanVersion(plan.version)
      })
      .catch(() => {})
  }, [token, setGroups, setMeals])

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    getPlanHistory(token, controller.signal).then(data => {
      if (!controller.signal.aborted) setPlanHistory(data)
    }).catch(() => {})
    return () => controller.abort()
  }, [token])

  function editMeal(i: number) { setSheetIndex(i); setConfirmed(false) }
  function addMeal() { setSheetIndex(meals.length); setConfirmed(false) }
  async function saveSheet(meal: LocalMeal | null) {
    const next = meals.slice()
    if (meal) next.splice(sheetIndex!, sheetIndex! < meals.length ? 1 : 0, meal)
    else next.splice(sheetIndex!, 1)
    await confirmPlan(next)
  }

  async function confirmPlan(nextMeals: LocalMeal[], goToToday = false) {
    if (!token) return
    setConfirming(true)
    setError(null)
    setConflict(false)
    try {
      const dto = await saveMyPlan(token, { ...localToPlan(nextMeals, groups), clientVersion: planVersion })
      setSavedPlan(dto)
      setGroups(dto.foodGroups ?? DEFAULT_GROUPS)
      setMeals(planToLocal(dto))
      setPlanVersion(dto.version)
      if (token) getPlanHistory(token).then(setPlanHistory).catch(() => {})
      setSheetIndex(null)
      setSheetDirty(false)
      setConfirmed(true)
      setGoToToday(goToToday)
      returnToSummary()
    } catch (err) {
      if (err instanceof PlanConflictError) {
        setConflict(true)
      } else {
        console.error('confirmarPlan falló:', err)
        setError('No se pudo guardar el plan. Intentá de nuevo.')
      }
    } finally {
      setConfirming(false)
    }
  }

  const today = new Date()
  const weekday = today.getDay() || 7
  const todayMeals = meals.filter(meal => !meal.weekdays?.length || meal.weekdays.includes(weekday))
  const hasWeekdayRestrictions = meals.some(meal => meal.weekdays?.length && meal.weekdays.length < 7)

  async function reloadPlan() {
    if (!token) return
    setConflict(false)
    setReloading(true)
    try {
      const dto = await getMyPlan(token)
      setSavedPlan(dto)
      setGroups(dto.foodGroups ?? DEFAULT_GROUPS)
      setMeals(planToLocal(dto))
      setPlanVersion(dto.version)
      setSheetIndex(null)
      setSheetDirty(false)
    } catch {
      setError('No se pudo recargar el plan.')
    } finally {
      setReloading(false)
    }
  }

  return (
    <div className="mi-plan-page">
      <header className="mi-plan-header">
        <div className="mi-plan-header__meta">
          <Brand size={20} />
        </div>
        {tab !== 'resumen' && <button type="button" className="mi-plan-back"
          disabled={confirming || rulesBusy} onClick={cancelEditing}>‹ Mi plan</button>}
        <h1 className="mi-plan-header__title">Mi plan</h1>
      </header>

      <div className="mi-plan-body" aria-busy={confirming || rulesBusy}>
        {dataRouter && sheetIndex === null && <NavigationGuard dirty={hasChanges || rulesDirty || sheetDirty} busy={confirming || rulesBusy} />}
        {tab === 'resumen' && !loading && !loadError && <>
          <p>{savedPlan?.createdAt ? `Actualizado el ${formatDate(savedPlan.createdAt)}` : savedPlan ? 'Fecha de carga no disponible' : 'Todavía no tenés un plan'}. Tocá una comida para cambiarla.</p>


        </>}
          {discard && <div role="alert">
            <p>Tenés cambios sin guardar. ¿Querés descartarlos?</p>
            <button disabled={confirming || rulesBusy} onClick={() => {
              setMeals(savedPlan ? planToLocal(savedPlan) : [])
              setError(null)
              setConflict(false)
              returnToSummary()
            }}>Descartar cambios</button>
            <button onClick={() => setDiscard(false)}>Seguir editando</button>
          </div>}
        <fieldset id="plan-panel" aria-busy={confirming || rulesBusy} disabled={confirming} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {tab === 'rules' ? (
          <PlanRulesSection
            initialSection={rulesSection}
            meals={meals.map(meal => ({
              portions: groups.map(g => ({ foodGroupId: g.id, portions: meal.portions[g.id] ?? 0 })),
            }))}
            token={token}
            onDirtyChange={setRulesDirty}
            onBusyChange={setRulesBusy}
            onChanged={handleRulesChanged}
          />
        ) : loadError ? (
          <p role="alert">No se pudo cargar el plan. <button onClick={retry}>Reintentar</button></p>
        ) : reloading || loading ? (
          <LoadingSkeleton label="Cargando tu plan…">
            <Skeleton />
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="loading-skeleton__row"><Skeleton /><Skeleton shape="block" /></div>)}
          </LoadingSkeleton>
        ) : (
          <>
            <div className="meal-list">
            {meals.map((meal, i) => {
              const total = Object.values(meal.portions).reduce((sum, n) => sum + n, 0)
              return <button key={i} className="plan-comida" aria-label={'Editar ' + meal.name} onClick={() => editMeal(i)}>
                <strong>{meal.name || 'Sin nombre'}</strong><span>{meal.time}</span>
                <span className="plan-end">{total ? formatPortion(total) + (total === 1 ? ' porción' : ' porciones') : 'Sin porciones'} ›</span>
                <span className="plan-dots" aria-hidden="true">{groups.flatMap((g, index) =>
                  Array.from({ length: Math.ceil(meal.portions[g.id] ?? 0) }, (_, n) =>
                    <span key={g.id + '-' + n} style={{ '--crumb-color': groupColor(g, index) } as React.CSSProperties}><Miga aspect={(meal.portions[g.id] ?? 0) - n < 1 ? 'half' : 'full'} /></span>))}</span>
                <span className="plan-description">{groups.filter(g => meal.portions[g.id] > 0).map(g => formatPortion(meal.portions[g.id]) + ' ' + g.name).join(' · ')}</span>
              </button>
            })}
            <button className="btn-agregar" onClick={addMeal}>Agregar comida</button>
            </div>
            {fromWizard && <button className="btn-confirmar" onClick={() => confirmPlan(meals, true)}>Listo, ir a Hoy</button>}

            {tab === 'resumen' && <>
            <h2>Tu día completo{hasWeekdayRestrictions ? ` · hoy, ${today.toLocaleDateString('es-UY', { weekday: 'long' })}` : ''}</h2>
            <div className="plan-totals">{groups.map((g, index) => {
              const total = todayMeals.reduce((sum, meal) => sum + (meal.portions[g.id] ?? 0), 0)
              return <div key={g.id}><span>{g.name}</span><span className="plan-dots" aria-hidden="true">
                {Array.from({ length: Math.ceil(total) }, (_, n) => <span key={n} style={{ '--crumb-color': groupColor(g, index) } as React.CSSProperties}><Miga aspect={total - n < 1 ? 'half' : 'full'} /></span>)}
              </span><span>{formatPortion(total)}</span></div>
            })}</div>
            <div className="plan-summary-links">
            {([['foods', 'Tus alimentos', counts?.foods], ['habits', 'Hábitos', counts?.habits], ['groups', 'Grupos', groups.length]] as const).map(([section, label, count]) =>
              <button key={section} data-summary-target={section} aria-label={`Ver ${label.toLocaleLowerCase()}, ${count ?? 'cargando'}`} onClick={() => {
                summaryTrigger.current = section
                setRulesSection(section)
                setTab('rules')
              }}><span>{label} ({count ?? '…'})</span><span aria-hidden="true">›</span></button>)}
            <button onClick={() => setShowHistory(value => !value)}><strong>Planes anteriores</strong><span>{planHistory.length} ›</span></button>
          </div></>}
            {error && sheetIndex === null && <p className="plan-error" role="alert">{error}</p>}

            {conflict && sheetIndex === null && (
              <div className="plan-conflicto" role="alert">
                <p>El plan fue modificado en otro dispositivo. Recargá para ver la versión actual.</p>
                <button className="btn-recargar" onClick={reloadPlan}>Recargar plan</button>
              </div>
            )}



            <p className="confirmado-msg" role="status">{confirmed ? '¡Plan guardado!' : ''}</p>

            {showHistory && (
              <div className="plan-historial">
                <p className="plan-historial__titulo">Planes anteriores</p>
                {planHistory.map((h, i) => (
                  <button key={i} className="plan-historial__item" onClick={() => setPlanDetail(h)}>
                    <span className="plan-historial__fecha">
                      {new Date(h.supersededAt).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <span className="plan-historial__detalle">{h.mealCount} comidas</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))}
              </div>
            )}

            {planDetail && (
              <PlanDetailModal plan={planDetail} onClose={() => setPlanDetail(null)} />
            )}


          </>
        )}
        </fieldset>
      </div>
      {sheetIndex !== null && <MealSheet
        meal={meals[sheetIndex] ?? { name: '', time: '', portions: emptyPortions(groups) }}
        groups={groups} isNew={sheetIndex === meals.length} busy={confirming || reloading}
        error={error} conflict={conflict} onReload={reloadPlan} onDirtyChange={setSheetDirty}
        onClose={() => { setSheetIndex(null); setSheetDirty(false); setError(null); setConflict(false) }}
        onSave={saveSheet} onDelete={() => saveSheet(null)}
      >
        {dataRouter && <NavigationGuard dirty={hasChanges || rulesDirty || sheetDirty} busy={confirming || rulesBusy} />}
      </MealSheet>}
    </div>
  )
}
