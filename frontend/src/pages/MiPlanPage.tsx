import { useCallback, useEffect, useRef, useState } from 'react'
import { useDialogFocus } from './useDialogFocus'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import {
  getMyPlan, getPlanHistory, saveMyPlan, PlanConflictError,
  type PlanFoodGroupDto, type PlanDto, type PlanSummaryDto,
} from '../api/plans'
import type { PlanRules } from '../api/planRules'
import PlanRulesSection from './plan/PlanRulesSection'
import './MiPlanPage.css'
import { usePlan } from '../hooks/usePlan'

const DEFAULT_GRUPOS: PlanFoodGroupDto[] = [
  { id: -1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
  { id: -2, name: 'Cereales',  abbreviation: 'CER', displayOrder: 2, color: null },
  { id: -3, name: 'Frutas',    abbreviation: 'FRU', displayOrder: 3, color: null },
  { id: -4, name: 'Lácteos',   abbreviation: 'LAC', displayOrder: 4, color: null },
  { id: -5, name: 'Grasas',    abbreviation: 'GRA', displayOrder: 5, color: null },
  { id: -6, name: 'Verduras',  abbreviation: 'VER', displayOrder: 6, color: null },
]

const ABBR_DOT: Record<string, string> = {
  PRO: 'var(--g-prot)', CER: 'var(--g-cer)', FRU: 'var(--g-frut)',
  LAC: 'var(--g-lac)',  GRA: 'var(--g-gras)', VER: 'var(--g-verd)',
}

const ABBR_CSS: Record<string, string> = {
  PRO: 'PROTEINS', CER: 'GRAINS', FRU: 'FRUITS',
  LAC: 'DAIRY',    GRA: 'FATS',   VER: 'VEGETABLES',
}

type Porciones = Record<number, number>

interface ComidaLocal {
  nombre: string
  hora: string
  porciones: Porciones
  minimizada: boolean
}

function porcionesVacias(grupos: PlanFoodGroupDto[]): Porciones {
  return Object.fromEntries(grupos.map(g => [g.id, 0]))
}

function planALocal(dto: PlanDto): ComidaLocal[] {
  return dto.meals
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(meal => {
      const porciones: Porciones = {}
      meal.portions.forEach(p => { porciones[p.foodGroupId] = p.portions })
      const hora = meal.suggestedTime ? meal.suggestedTime.slice(0, 5) : ''
      return { nombre: meal.name, hora, porciones, minimizada: true }
    })
}

function localAPlan(comidas: ComidaLocal[], grupos: PlanFoodGroupDto[]) {
  return {
    meals: comidas.map((c, i) => ({
      name: c.nombre,
      suggestedTime: c.hora ? c.hora + ':00' : undefined,
      displayOrder: i + 1,
      portions: grupos.map(g => ({ foodGroupAbbr: g.abbreviation, portions: c.porciones[g.id] ?? 0 })),
    })),
  }
}

// Porciones con coma decimal (es-UY).
function formatPorcion(value: number) {
  return String(value).replace('.', ',')
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })
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

function PlanDetalleModal({ plan, onClose }: { plan: PlanSummaryDto; onClose: () => void }) {
  const gruposMap = Object.fromEntries((plan.foodGroups ?? []).map(g => [g.id, g]))
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Detalle del plan"
        onClick={e => e.stopPropagation()}>
        <div className="modal-card__header">
          <div>
            <p className="modal-card__eyebrow">Plan anterior</p>
            <p className="modal-card__rango">
              <span>Desde {formatFecha(plan.createdAt)}</span>
              <span className="modal-card__rango-sep">→</span>
              <span>Hasta {formatFecha(plan.supersededAt)}</span>
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
                  const g = gruposMap[p.foodGroupId]
                  if (!g) return null
                  const cssKey = ABBR_CSS[g.abbreviation] ?? g.abbreviation
                  return (
                    <span key={p.foodGroupId} className={`porcion-chip porcion-chip--${cssKey}`}>
                      <span className="porcion-chip__num">{formatPorcion(Number(p.portions))}</span>
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

type Tab = 'comidas' | 'rules'

export default function MiPlanPage() {
  const { token, email } = useAuth()
  return <PlanLoader key={JSON.stringify([email, token])} />
}

function PlanLoader() {
  useTitle('Mi plan | Miga')
  const { token, email } = useAuth()
  const { data, status, retry } = usePlan(token, email)
  const [tab, setTab] = useState<Tab>('comidas')
  return <PlanEditor initialPlan={data} loading={status === 'loading'} loadError={status === 'error'} retry={retry} tab={tab} setTab={setTab} />
}

function PlanEditor({ initialPlan, loading, loadError, retry, tab, setTab }: {
  initialPlan: PlanDto | null; loading: boolean; loadError: boolean; retry: () => void
  tab: Tab; setTab: (tab: Tab) => void
}) {
  useTitle('Mi plan | Miga')
  const { token } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const desdeWizard = !!(location.state as { meals?: unknown } | null)?.meals

  const [grupos, setGrupos] = useState<PlanFoodGroupDto[]>(initialPlan?.foodGroups ?? DEFAULT_GRUPOS)
  const [comidas, setComidas] = useState<ComidaLocal[]>(() => initialPlan ? planALocal(initialPlan) :
    ((location.state as { meals?: { name: string; suggestedTime: string | null }[] } | null)?.meals ?? []).map(meal => ({
      nombre: meal.name, hora: meal.suggestedTime?.slice(0, 5) ?? '',
      porciones: porcionesVacias(DEFAULT_GRUPOS), minimizada: false,
    })))
  // El foco solo se mueve por una acción de la persona: al guardar una comida vuelve a
  // su «Editar», al editar o agregar va al nombre y al eliminar va a «Agregar comida».
  const focoEditar = useRef<number | null>(null)
  const focoNombre = useRef<number | null>(null)
  const focoAgregar = useRef(false)
  useEffect(() => {
    if (focoEditar.current !== null) {
      document.querySelector<HTMLElement>(`[data-edit-index="${focoEditar.current}"]`)?.focus()
    } else if (focoNombre.current !== null) {
      document.querySelector<HTMLElement>(`[data-name-index="${focoNombre.current}"]`)?.focus()
    } else if (focoAgregar.current) {
      document.querySelector<HTMLElement>('.btn-agregar')?.focus()
    }
    focoEditar.current = null
    focoNombre.current = null
    focoAgregar.current = false
  }, [comidas])
  const [cargando, setCargando] = useState(false)
  const [historial, setHistorial] = useState<PlanSummaryDto[]>([])
  const [planDetalle, setPlanDetalle] = useState<PlanSummaryDto | null>(null)
  const [planVersion, setPlanVersion] = useState<number | undefined>(initialPlan?.version)
  const [confirmando, setConfirmando] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicto, setConflicto] = useState(false)
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null)
  const [loadedPlan, setLoadedPlan] = useState(initialPlan)
  if (loadedPlan !== initialPlan) {
    setLoadedPlan(initialPlan)
    setGrupos(initialPlan?.foodGroups ?? DEFAULT_GRUPOS)
    setComidas(initialPlan ? planALocal(initialPlan) : [])
    setPlanVersion(initialPlan?.version)
  }


  // Una edición de reglas puede crear una versión nueva del plan con otros ids de
  // grupos: se recargan las comidas para no confirmar porciones con ids viejos.
  const handleRulesChanged = useCallback((dto: PlanRules) => {
    setGrupos(dto.grupos)
    setPlanVersion(dto.planVersion)
    if (!token) return
    getMyPlan(token)
      .then(plan => {
        setGrupos(plan.foodGroups ?? DEFAULT_GRUPOS)
        setComidas(planALocal(plan))
        setPlanVersion(plan.version)
      })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    getPlanHistory(token, controller.signal).then(data => {
      if (!controller.signal.aborted) setHistorial(data)
    }).catch(() => {})
    return () => controller.abort()
  }, [token])

  function actualizarNombre(i: number, nombre: string) {
    setComidas(prev => prev.map((c, j) => j === i ? { ...c, nombre } : c))
  }

  function actualizarHora(i: number, hora: string) {
    setComidas(prev => prev.map((c, j) => j === i ? { ...c, hora } : c))
  }

  function actualizarPorcion(i: number, grupoId: number, delta: number) {
    setComidas(prev => prev.map((c, j) => {
      if (j !== i) return c
      const nuevo = Math.round(((c.porciones[grupoId] ?? 0) + delta) * 10) / 10
      if (nuevo < 0 || nuevo > 10) return c
      return { ...c, porciones: { ...c.porciones, [grupoId]: nuevo } }
    }))
  }

  function guardarComida(i: number) {
    focoEditar.current = i
    setComidas(prev => prev.map((c, j) => j === i ? { ...c, minimizada: true } : c))
  }

  function editarComida(i: number) {
    focoNombre.current = i
    setComidas(prev => prev.map((c, j) => j === i ? { ...c, minimizada: false } : c))
  }

  function agregarComida() {
    focoNombre.current = comidas.length
    setComidas(prev => [...prev, { nombre: '', hora: '', porciones: porcionesVacias(grupos), minimizada: false }])
  }

  function eliminarComida(i: number) {
    focoAgregar.current = true
    setComidas(prev => prev.filter((_, j) => j !== i))
    setConfirmDeleteIdx(null)
  }

  async function confirmarPlan() {
    if (!token) return
    setConfirmando(true)
    setError(null)
    setConflicto(false)
    try {
      const dto = await saveMyPlan(token, { ...localAPlan(comidas, grupos), clientVersion: planVersion })
      setGrupos(dto.foodGroups ?? DEFAULT_GRUPOS)
      setComidas(planALocal(dto))
      setPlanVersion(dto.version)
      if (token) getPlanHistory(token).then(setHistorial).catch(() => {})
      setConfirmado(true)
      if (desdeWizard) setTimeout(() => navigate('/hoy', { replace: true }), 1800)
    } catch (err) {
      if (err instanceof PlanConflictError) {
        setConflicto(true)
      } else {
        console.error('confirmarPlan falló:', err)
        setError('No se pudo guardar el plan. Intentá de nuevo.')
      }
    } finally {
      setConfirmando(false)
    }
  }

  async function recargarPlan() {
    if (!token) return
    setConflicto(false)
    setCargando(true)
    try {
      const dto = await getMyPlan(token)
      setGrupos(dto.foodGroups ?? DEFAULT_GRUPOS)
      setComidas(planALocal(dto))
      setPlanVersion(dto.version)
    } catch {
      setError('No se pudo recargar el plan.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="mi-plan-page">
      <header className="mi-plan-header">
        <div className="mi-plan-header__meta">
          <Brand size={20} />
        </div>
        <h1 className="mi-plan-header__title">Tu plan</h1>
      </header>

      <div className="mi-plan-body">
        <div className="plan-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            id="plan-tab-meals"
            aria-controls="plan-panel"
            aria-selected={tab === 'comidas'}
            className={`plan-tab${tab === 'comidas' ? ' plan-tab--active' : ''}`}
            onClick={() => setTab('comidas')}
          >
            Comidas
          </button>
          <button
            type="button"
            role="tab"
            id="plan-tab-rules"
            aria-controls="plan-panel"
            aria-selected={tab === 'rules'}
            className={`plan-tab${tab === 'rules' ? ' plan-tab--active' : ''}`}
            onClick={() => setTab('rules')}
          >
            Reglas de tu plan
          </button>
        </div>

        <div id="plan-panel" role="tabpanel" aria-labelledby={tab === 'rules' ? 'plan-tab-rules' : 'plan-tab-meals'}>
        {tab === 'rules' ? (
          <PlanRulesSection
            meals={comidas.map(meal => ({
              portions: grupos.map(g => ({ foodGroupId: g.id, portions: meal.porciones[g.id] ?? 0 })),
            }))}
            token={token}
            onChanged={handleRulesChanged}
          />
        ) : loadError ? (
          <p role="alert">No se pudo cargar el plan. <button onClick={retry}>Reintentar</button></p>
        ) : cargando || loading ? (
          <p className="mi-plan-loading">Cargando tu plan…</p>
        ) : (
          <>
            <div className="meal-list">
            {comidas.map((comida, i) =>
              comida.minimizada ? (
                <div key={i} className="comida-card comida-card--min">
                  <span className="comida-min__nombre">{comida.nombre || 'Sin nombre'}</span>
                  {comida.hora && <span className="comida-min__hora">{comida.hora}</span>}
                  <div className="comida-min__chips">
                    {grupos.filter(g => (comida.porciones[g.id] ?? 0) > 0).map(g => {
                      const cssKey = ABBR_CSS[g.abbreviation] ?? g.abbreviation
                      return (
                        <span key={g.id} className={`porcion-chip porcion-chip--${cssKey}`}>
                          <span className="porcion-chip__num">{formatPorcion(comida.porciones[g.id])}</span>
                          {g.name}
                        </span>
                      )
                    })}
                  </div>
                  <button
                    className="btn-editar"
                    data-edit-index={i}
                    onClick={() => editarComida(i)}
                    aria-label={`Editar ${comida.nombre || 'comida'}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path d="M12.5 2.5a1.414 1.414 0 0 1 2 2L5 14H3v-2L12.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    className="btn-eliminar-min"
                    onClick={() => setConfirmDeleteIdx(i)}
                    aria-label="Eliminar comida"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path d="M6 3.5h6M2.5 5.5h13M7.5 8v5M10.5 8v5M4 5.5l.9 9.5h8.2l.9-9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <div key={i} className="comida-card comida-card--exp">
                  <div className="comida-card__header">
                    <input
                      className="comida-card__nombre"
                      placeholder="Nombre de la comida"
                      value={comida.nombre}
                      onChange={e => actualizarNombre(i, e.target.value)}
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
                      value={comida.hora}
                      onChange={e => actualizarHora(i, e.target.value)}
                    />
                  </div>
                  {grupos.map(g => {
                    const dot = ABBR_DOT[g.abbreviation] ?? 'var(--g-prot)'
                    return (
                      <div key={g.id} className="porcion-row">
                        <span className="porcion-row__dot" style={{ background: dot }} />
                        <span className="porcion-row__label">{g.name}</span>
                        <div className="porcion-row__stepper">
                          <button
                            className="stepper-btn"
                            onClick={() => actualizarPorcion(i, g.id, -0.5)}
                            disabled={(comida.porciones[g.id] ?? 0) <= 0}
                            aria-label={`Reducir ${g.name}`}
                          >−</button>
                          <span className="stepper-value" aria-live="polite">{formatPorcion(comida.porciones[g.id] ?? 0)}</span>
                          <button
                            className="stepper-btn"
                            onClick={() => actualizarPorcion(i, g.id, 0.5)}
                            disabled={(comida.porciones[g.id] ?? 0) >= 10}
                            aria-label={`Aumentar ${g.name}`}
                          >+</button>
                        </div>
                      </div>
                    )
                  })}
                  <button
                    className="btn-guardar-comida"
                    onClick={() => guardarComida(i)}
                    disabled={!comida.nombre.trim()}
                  >
                    Guardar comida
                  </button>
                </div>
              )
            )}

            <button className="btn-agregar" onClick={agregarComida}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Agregar comida
            </button>
            </div>

            {error && <p className="plan-error" role="alert">{error}</p>}

            {conflicto && (
              <div className="plan-conflicto" role="alert">
                <p>El plan fue modificado en otro dispositivo. Recargá para ver la versión actual.</p>
                <button className="btn-recargar" onClick={recargarPlan}>Recargar plan</button>
              </div>
            )}

            <button className="btn-confirmar" onClick={confirmarPlan} disabled={confirmando || conflicto}>
              {confirmando ? 'Confirmando…' : 'Confirmar plan'}
            </button>

            <p className="confirmado-msg" role="status">{confirmado ? '¡Plan guardado!' : ''}</p>

            {historial.length > 0 && (
              <div className="plan-historial">
                <p className="plan-historial__titulo">Planes anteriores</p>
                {historial.map((h, i) => (
                  <button key={i} className="plan-historial__item" onClick={() => setPlanDetalle(h)}>
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

            {planDetalle && (
              <PlanDetalleModal plan={planDetalle} onClose={() => setPlanDetalle(null)} />
            )}

            {confirmDeleteIdx !== null && comidas[confirmDeleteIdx] && (
              <ConfirmDeleteModal
                name={comidas[confirmDeleteIdx].nombre || 'esta comida'}
                onCancel={() => setConfirmDeleteIdx(null)}
                onConfirm={() => eliminarComida(confirmDeleteIdx)}
              />
            )}
          </>
        )}
        </div>
      </div>
    </div>
  )
}
