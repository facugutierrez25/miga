import Skeleton, { LoadingSkeleton } from '../components/Skeleton'
import { MAX_CARD_PORTIONS } from '../components/crumbSlots'
import { groupColor } from '../groupColors'
import { useContext, useCallback, useEffect, useRef, useState } from 'react'
import { useDialogFocus } from './useDialogFocus'
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
  collapsed: boolean
}

// Cada porción es una miga de la ficha (media porción también ocupa una): el plan admite hasta 12.
function mealCrumbCount(portions: Portions): number {
  return Object.values(portions).reduce((total, p) => total + Math.ceil(p ?? 0), 0)
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
      return { name: meal.name, time, portions, collapsed: true }
    })
}

function localToPlan(meals: LocalMeal[], groups: PlanFoodGroupDto[]) {
  return {
    meals: meals.map((c, i) => ({
      name: c.name,
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

function ConfirmDeleteModal({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onCancel)
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Confirmar eliminación"
        onClick={e => e.stopPropagation()}>
        <p className="confirm-modal__msg">
          ¿Eliminar <strong>{name}</strong>?
        </p>
        <div className="confirm-modal__actions">
          <button type="button" className="confirm-modal__cancel" onClick={onCancel}>Cancelar</button>
          <button type="button" className="confirm-modal__confirm" onClick={onConfirm}>Eliminar</button>
        </div>
      </div>
    </div>
  )
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

type Tab = 'resumen' | 'comidas' | 'rules'

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
  const summaryTrigger = useRef('edit')
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
  function startEditing() {
    summaryTrigger.current = 'edit'
    setTab('comidas')
    setConfirmed(false)
    if (meals.length) editMeal(0)
  }
  const [groups, setGroups] = useState<PlanFoodGroupDto[]>(initialPlan?.foodGroups ?? DEFAULT_GROUPS)
  const [meals, setMeals] = useState<LocalMeal[]>(() => initialPlan ? planToLocal(initialPlan) :
    ((location.state as { meals?: { name: string; suggestedTime: string | null }[] } | null)?.meals ?? []).map(meal => ({
      name: meal.name, time: meal.suggestedTime?.slice(0, 5) ?? '',
      portions: emptyPortions(DEFAULT_GROUPS), collapsed: false,
    })))
  const hasChanges = JSON.stringify(localToPlan(meals, groups)) !== JSON.stringify(localToPlan(savedPlan ? planToLocal(savedPlan) : [], groups))
  // El foco solo se mueve por una acción de la persona: al guardar una comida vuelve a
  // su «Editar», al editar o agregar va al nombre y al eliminar va a «Agregar comida».
  const focusEdit = useRef<number | null>(null)
  const focusName = useRef<number | null>(null)
  const focusAdd = useRef(false)
  useEffect(() => {
    if (focusEdit.current !== null) {
      document.querySelector<HTMLElement>(`[data-edit-index="${focusEdit.current}"]`)?.focus()
    } else if (focusName.current !== null) {
      document.querySelector<HTMLElement>(`[data-name-index="${focusName.current}"]`)?.focus()
    } else if (focusAdd.current) {
      document.querySelector<HTMLElement>('.btn-agregar')?.focus()
    }
    focusEdit.current = null
    focusName.current = null
    focusAdd.current = false
  }, [meals])
  const [reloading, setReloading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!hasChanges && !rulesDirty) return
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  }, [hasChanges, rulesDirty])
  const [planHistory, setPlanHistory] = useState<PlanSummaryDto[]>([])
  const [planDetail, setPlanDetail] = useState<PlanSummaryDto | null>(null)
  const [planVersion, setPlanVersion] = useState<number | undefined>(initialPlan?.version)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null)
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
  }, [token])

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    getPlanHistory(token, controller.signal).then(data => {
      if (!controller.signal.aborted) setPlanHistory(data)
    }).catch(() => {})
    return () => controller.abort()
  }, [token])

  function updateName(i: number, name: string) {
    setMeals(prev => prev.map((c, j) => j === i ? { ...c, name } : c))
  }

  function updateTime(i: number, time: string) {
    setMeals(prev => prev.map((c, j) => j === i ? { ...c, time } : c))
  }

  function updatePortion(i: number, groupId: number, delta: number) {
    setMeals(prev => prev.map((c, j) => {
      if (j !== i) return c
      const nextValue = Math.round(((c.portions[groupId] ?? 0) + delta) * 10) / 10
      if (nextValue < 0 || nextValue > 10) return c
      const portions = { ...c.portions, [groupId]: nextValue }
      if (delta > 0 && mealCrumbCount(portions) > MAX_CARD_PORTIONS) return c
      return { ...c, portions }
    }))
  }

  function saveMeal(i: number) {
    focusEdit.current = i
    setMeals(prev => prev.map((c, j) => j === i ? { ...c, collapsed: true } : c))
  }

  function editMeal(i: number) {
    focusName.current = i
    setMeals(prev => prev.map((c, j) => j === i ? { ...c, collapsed: false } : c))
  }

  function addMeal() {
    focusName.current = meals.length
    setMeals(prev => [...prev, { name: '', time: '', portions: emptyPortions(groups), collapsed: false }])
  }

  function removeMeal(i: number) {
    focusAdd.current = true
    setMeals(prev => prev.filter((_, j) => j !== i))
    setConfirmDeleteIdx(null)
  }

  async function confirmPlan() {
    if (!token) return
    setConfirming(true)
    setError(null)
    setConflict(false)
    try {
      const dto = await saveMyPlan(token, { ...localToPlan(meals, groups), clientVersion: planVersion })
      setSavedPlan(dto)
      setGroups(dto.foodGroups ?? DEFAULT_GROUPS)
      setMeals(planToLocal(dto))
      setPlanVersion(dto.version)
      if (token) getPlanHistory(token).then(setPlanHistory).catch(() => {})
      setConfirmed(true)
      returnToSummary()
      if (fromWizard) setTimeout(() => navigate('/hoy', { replace: true }), 1800)
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
        <h1 className="mi-plan-header__title">Tu plan</h1>
      </header>

      <div className="mi-plan-body" aria-busy={confirming || rulesBusy}>
        {dataRouter && <NavigationGuard dirty={hasChanges || rulesDirty} busy={confirming || rulesBusy} />}
        {tab === 'resumen' && !loading && !loadError && <>
          <p>{savedPlan?.createdAt ? `Cargado el ${formatDate(savedPlan.createdAt)}` : 'Fecha de carga no disponible'}</p>
          <button data-summary-target="edit" className="btn-confirmar" onClick={startEditing}>Editar plan</button>

        </>}
        {tab === 'comidas' && <>
          <button disabled={hasChanges} onClick={() => { setRulesSection('groups'); setTab('rules') }}>Grupos</button>
          {hasChanges && <p>Guardá o descartá los cambios de comidas antes de editar grupos.</p>}
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
            {meals.map((meal, i) =>
              (tab === 'resumen' || meal.collapsed) ? (
                <div key={i} className="comida-card comida-card--min">
                  <span className="comida-min__nombre">{meal.name || 'Sin nombre'}</span>
                  {meal.time && <span className="comida-min__hora">{meal.time}</span>}
                  <div className="comida-min__chips">
                    {groups.filter(g => (meal.portions[g.id] ?? 0) > 0).map(g => {
                      const color = groupColor(g, groups.indexOf(g))
                      return (
                        <span key={g.id} className="porcion-chip" style={{ '--chip-dot': color } as React.CSSProperties}>
                          <span className="porcion-chip__num">{formatPortion(meal.portions[g.id])}</span>
                          {g.name}
                        </span>
                      )
                    })}
                  </div>
                  {tab === 'comidas' && <button
                    className="btn-editar"
                    data-edit-index={i}
                    onClick={() => editMeal(i)}
                    aria-label={`Editar ${meal.name || 'comida'}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path d="M12.5 2.5a1.414 1.414 0 0 1 2 2L5 14H3v-2L12.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>}

                </div>
              ) : (
                <div key={i} className="comida-card comida-card--exp" onKeyDown={e => { if (e.key === 'Escape') saveMeal(i) }}>
                  <div className="comida-card__header">
                    <input
                      className="comida-card__nombre"
                      placeholder="Nombre de la comida"
                      value={meal.name}
                      onChange={e => updateName(i, e.target.value)}
                      aria-label="Nombre de la comida"
                      data-name-index={i}
                    />
                    <button
                      className="btn-eliminar-exp"
                      onClick={() => setConfirmDeleteIdx(i)}
                      aria-label="Eliminar comida"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M7 4h6M3 6h14M8 9v5M12 9v5M5 6l1 11h8l1-11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                  <div className="comida-card__hora-row">
                    <svg className="comida-card__hora-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M7 4.5V7l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <label htmlFor={`hora-${i}`} className="comida-card__hora-label">Hora sugerida</label>
                    <input
                      id={`hora-${i}`}
                      type="time"
                      className="comida-card__hora-input"
                      value={meal.time}
                      onChange={e => updateTime(i, e.target.value)}
                    />
                  </div>
                  <p className="porcion-tope" aria-live="polite">
                    {mealCrumbCount(meal.portions)} de {MAX_CARD_PORTIONS} porciones: una comida tiene hasta {MAX_CARD_PORTIONS}.
                  </p>
                  {groups.map((g, index) => {
                    const dot = groupColor(g, index)
                    const full = mealCrumbCount({ ...meal.portions, [g.id]: (meal.portions[g.id] ?? 0) + 0.5 }) > MAX_CARD_PORTIONS
                    return (
                      <div key={g.id} className="porcion-row">
                        <span className="porcion-row__dot" style={{ background: dot }} />
                        <span className="porcion-row__label">{g.name}</span>
                        <div className="porcion-row__stepper">
                          <button
                            className="stepper-btn"
                            onClick={() => updatePortion(i, g.id, -0.5)}
                            disabled={(meal.portions[g.id] ?? 0) <= 0}
                            aria-label={`Reducir ${g.name}`}
                          >−</button>
                          <span className="stepper-value" aria-live="polite">{formatPortion(meal.portions[g.id] ?? 0)}</span>
                          <button
                            className="stepper-btn"
                            onClick={() => updatePortion(i, g.id, 0.5)}
                            disabled={(meal.portions[g.id] ?? 0) >= 10 || full}
                            aria-label={`Aumentar ${g.name}`}
                          >+</button>
                        </div>
                      </div>
                    )
                  })}
                  <button
                    className="btn-guardar-comida"
                    onClick={() => saveMeal(i)}
                    disabled={!meal.name.trim()}
                  >
                    Listo
                  </button>
                </div>
              )
            )}

            {tab === 'comidas' && <button className="btn-agregar" onClick={addMeal}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Agregar comida
            </button>}
            </div>

            {tab === 'resumen' && <>          <div className="plan-summary-links">
            {([['foods', 'Tus alimentos', counts?.foods], ['habits', 'Hábitos', counts?.habits]] as const).map(([section, label, count]) =>
              <button key={section} data-summary-target={section} aria-label={`Ver ${label.toLocaleLowerCase()}, ${count ?? 'cargando'}`} onClick={() => {
                summaryTrigger.current = section
                setRulesSection(section)
                setTab('rules')
              }}><span>{label} ({count ?? '…'})</span><span aria-hidden="true">›</span></button>)}
          </div></>}
            {error && <p className="plan-error" role="alert">{error}</p>}

            {conflict && (
              <div className="plan-conflicto" role="alert">
                <p>El plan fue modificado en otro dispositivo. Recargá para ver la versión actual.</p>
                <button className="btn-recargar" onClick={reloadPlan}>Recargar plan</button>
              </div>
            )}

            {tab === 'comidas' && <button className="btn-confirmar" onClick={confirmPlan} disabled={confirming || conflict || meals.some(c => !c.name.trim())}>
              {confirming ? 'Guardando…' : 'Guardar cambios'}
            </button>}

            <p className="confirmado-msg" role="status">{confirmed ? '¡Plan guardado!' : ''}</p>

            {planHistory.length > 0 && (
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

            {confirmDeleteIdx !== null && meals[confirmDeleteIdx] && (
              <ConfirmDeleteModal
                name={meals[confirmDeleteIdx].name || 'esta comida'}
                onCancel={() => setConfirmDeleteIdx(null)}
                onConfirm={() => removeMeal(confirmDeleteIdx)}
              />
            )}
          </>
        )}
        </fieldset>
      </div>
    </div>
  )
}
