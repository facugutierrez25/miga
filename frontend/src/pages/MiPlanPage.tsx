import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Brand from '../components/Brand'
import { getMyPlan, getPlanHistory, saveMyPlan, type FoodGroup, type PlanDto, type PlanSummaryDto } from '../api/plans'
import { getEquivalences, addEquivalence, deleteEquivalence, type EquivalenceDto, type Unit } from '../api/equivalences'
import './MiPlanPage.css'

const GRUPOS: { key: FoodGroup; label: string; dot: string }[] = [
  { key: 'PROTEINS',   label: 'Proteínas', dot: 'var(--g-prot)' },
  { key: 'GRAINS',     label: 'Cereales',  dot: 'var(--g-cer)'  },
  { key: 'FRUITS',     label: 'Frutas',    dot: 'var(--g-frut)' },
  { key: 'DAIRY',      label: 'Lácteos',   dot: 'var(--g-lac)'  },
  { key: 'FATS',       label: 'Grasas',    dot: 'var(--g-gras)' },
  { key: 'VEGETABLES', label: 'Verduras',  dot: 'var(--g-verd)' },
]

type Porciones = Record<FoodGroup, number>

interface ComidaLocal {
  nombre: string
  hora: string
  porciones: Porciones
  minimizada: boolean
}

function porcionesVacias(): Porciones {
  return { PROTEINS: 0, GRAINS: 0, FRUITS: 0, DAIRY: 0, FATS: 0, VEGETABLES: 0 }
}

function planALocal(dto: PlanDto): ComidaLocal[] {
  return dto.meals
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(meal => {
      const porciones = porcionesVacias()
      meal.portions.forEach(p => { porciones[p.foodGroup] = p.portions })
      const hora = meal.suggestedTime ? meal.suggestedTime.slice(0, 5) : ''
      return { nombre: meal.name, hora, porciones, minimizada: true }
    })
}

function localAPlan(comidas: ComidaLocal[]): PlanDto {
  return {
    meals: comidas.map((c, i) => ({
      name: c.nombre,
      suggestedTime: c.hora ? c.hora + ':00' : undefined,
      displayOrder: i + 1,
      portions: GRUPOS.map(g => ({ foodGroup: g.key, portions: c.porciones[g.key] })),
    })),
  }
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })
}

function PlanDetalleModal({ plan, onClose }: { plan: PlanSummaryDto; onClose: () => void }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Detalle del plan" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
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
                  const g = GRUPOS.find(gr => gr.key === p.foodGroup)
                  if (!g) return null
                  return (
                    <span key={p.foodGroup} className={`porcion-chip porcion-chip--${p.foodGroup}`}>
                      <span className="porcion-chip__num">{p.portions}</span>
                      {g.label}
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

type Tab = 'comidas' | 'equivalencias'

export default function MiPlanPage() {
  const { token } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const desdeWizard = !!(location.state as { meals?: unknown } | null)?.meals
  const [tab, setTab] = useState<Tab>('comidas')
  const [comidas, setComidas] = useState<ComidaLocal[]>([])
  const [cargando, setCargando] = useState(true)
  const [historial, setHistorial] = useState<PlanSummaryDto[]>([])
  const [planDetalle, setPlanDetalle] = useState<PlanSummaryDto | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [equivalences, setEquivalences] = useState<EquivalenceDto[] | null>(null)
  const [equivError, setEquivError] = useState<string | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<FoodGroup | null>(null)
  const [newFood, setNewFood] = useState('')
  const [newQuantity, setNewQuantity] = useState('')
  const [newUnit, setNewUnit] = useState<Unit>('G')
  const [equivAdding, setEquivAdding] = useState(false)

  useEffect(() => {
    if (!token) return
    getMyPlan(token)
      .then(dto => setComidas(planALocal(dto)))
      .catch(err => {
        if (err.message === 'sin-plan') {
          const draft = (location.state as { meals?: { name: string; suggestedTime: string | null }[] } | null)?.meals
          if (draft) {
            setComidas(draft.map(m => ({ nombre: m.name, hora: m.suggestedTime ? m.suggestedTime.slice(0, 5) : '', porciones: porcionesVacias(), minimizada: false })))
          }
        } else {
          console.error(err)
        }
      })
      .finally(() => setCargando(false))

    getPlanHistory(token).then(setHistorial).catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token || tab !== 'equivalencias' || equivalences !== null) return
    getEquivalences(token)
      .then(dtos => setEquivalences(dtos))
      .catch(() => setEquivError('No se pudieron cargar las equivalencias.'))
  }, [token, tab, equivalences])

  function actualizarNombre(i: number, nombre: string) {
    setComidas(prev => prev.map((c, j) => j === i ? { ...c, nombre } : c))
  }

  function actualizarHora(i: number, hora: string) {
    setComidas(prev => prev.map((c, j) => j === i ? { ...c, hora } : c))
  }

  function actualizarPorcion(i: number, grupo: FoodGroup, delta: number) {
    setComidas(prev => prev.map((c, j) => {
      if (j !== i) return c
      const nuevo = Math.round((c.porciones[grupo] + delta) * 10) / 10
      if (nuevo < 0 || nuevo > 10) return c
      return { ...c, porciones: { ...c.porciones, [grupo]: nuevo } }
    }))
  }

  function guardarComida(i: number) {
    setComidas(prev => prev.map((c, j) => j === i ? { ...c, minimizada: true } : c))
  }

  function editarComida(i: number) {
    setComidas(prev => prev.map((c, j) => j === i ? { ...c, minimizada: false } : c))
  }

  function agregarComida() {
    setComidas(prev => [...prev, { nombre: '', hora: '', porciones: porcionesVacias(), minimizada: false }])
  }

  function eliminarComida(i: number) {
    setComidas(prev => prev.filter((_, j) => j !== i))
  }

  function toggleGroup(group: FoodGroup) {
    setExpandedGroup(prev => prev === group ? null : group)
    setNewFood('')
    setNewQuantity('')
    setNewUnit('G')
    setEquivError(null)
  }

  async function handleAddEquivalence(group: FoodGroup) {
    const qty = parseFloat(newQuantity)
    if (!token || !newFood.trim() || !qty || qty <= 0) return
    setEquivAdding(true)
    setEquivError(null)
    try {
      const created = await addEquivalence(token, group, newFood.trim(), qty, newUnit.trim())
      setEquivalences(prev => [...(prev ?? []), created])
      setNewFood('')
      setNewQuantity('')
      setNewUnit('G')
    } catch {
      setEquivError('No se pudo agregar. Intentá de nuevo.')
    } finally {
      setEquivAdding(false)
    }
  }

  async function handleDeleteEquivalence(id: number) {
    if (!token) return
    try {
      await deleteEquivalence(token, id)
      setEquivalences(prev => prev?.filter(e => e.id !== id) ?? null)
    } catch {
      setEquivError('No se pudo eliminar. Intentá de nuevo.')
    }
  }

  async function confirmarPlan() {
    if (!token) return
    setConfirmando(true)
    setError(null)
    try {
      const dto = await saveMyPlan(token, localAPlan(comidas))
      setComidas(planALocal(dto))
      if (token) getPlanHistory(token).then(setHistorial).catch(() => {})
      setConfirmado(true)
      if (desdeWizard) setTimeout(() => navigate('/hoy', { replace: true }), 1800)
    } catch (err) {
      console.error('confirmarPlan falló:', err)
      setError('No se pudo guardar el plan. Intentá de nuevo.')
    } finally {
      setConfirmando(false)
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
            role="tab"
            aria-selected={tab === 'comidas'}
            className={`plan-tab${tab === 'comidas' ? ' plan-tab--active' : ''}`}
            onClick={() => setTab('comidas')}
          >
            Comidas
          </button>
          <button
            role="tab"
            aria-selected={tab === 'equivalencias'}
            className={`plan-tab${tab === 'equivalencias' ? ' plan-tab--active' : ''}`}
            onClick={() => setTab('equivalencias')}
          >
            Equivalencias
          </button>
        </div>

        {tab === 'equivalencias' ? (
          equivalences === null ? (
            <p className="mi-plan-loading">Cargando equivalencias…</p>
          ) : (
            <>
              {GRUPOS.map(g => {
                const items = equivalences.filter(e => e.foodGroup === g.key)
                const open = expandedGroup === g.key
                return (
                  <div key={g.key} className={`equiv-group${open ? ' equiv-group--open' : ''}`}>
                    <button
                      className="equiv-group__header"
                      onClick={() => toggleGroup(g.key)}
                      aria-expanded={open}
                    >
                      <span className="equiv-group__dot" style={{ background: g.dot }} />
                      <span className="equiv-group__label">{g.label}</span>
                      <span className="equiv-group__count">
                        {items.length > 0 ? `${items.length} equiv.` : ''}
                      </span>
                      <svg className={`equiv-group__chevron${open ? ' equiv-group__chevron--open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {open && (
                      <div className="equiv-group__body">
                        {items.length === 0 && (
                          <p className="equiv-empty">Todavía no cargaste equivalencias para este grupo.</p>
                        )}
                        {items.map(eq => (
                          <div key={eq.id} className="equiv-item">
                            <span className="equiv-item__food">{eq.food}</span>
                            <span className="equiv-item__amount">{eq.quantity} {eq.unit.toLowerCase()}</span>
                            <button
                              className="equiv-item__delete"
                              onClick={() => handleDeleteEquivalence(eq.id)}
                              aria-label={`Eliminar ${eq.food}`}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        ))}
                        <div className="equiv-add">
                          <input
                            className="equiv-add__input"
                            type="text"
                            placeholder="Alimento"
                            value={newFood}
                            onChange={e => setNewFood(e.target.value)}
                            aria-label="Nombre del alimento"
                          />
                          <input
                            className="equiv-add__input equiv-add__input--qty"
                            type="number"
                            min="0.01"
                            step="0.5"
                            placeholder="Cant."
                            value={newQuantity}
                            onChange={e => setNewQuantity(e.target.value)}
                            aria-label="Cantidad numérica"
                          />
                          <div className="equiv-add__unit-wrap">
                            <select
                              value={newUnit}
                              onChange={e => setNewUnit(e.target.value as Unit)}
                              aria-label="Unidad"
                            >
                              <option value="G">g</option>
                              <option value="ML">ml</option>
                              <option value="UNIDAD">unidad</option>
                              <option value="TAZA">taza</option>
                            </select>
                            <svg className="equiv-add__unit-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                              <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <button
                            className="equiv-add__btn"
                            onClick={() => handleAddEquivalence(g.key)}
                            disabled={equivAdding || !newFood.trim() || !newQuantity || parseFloat(newQuantity) <= 0}
                            aria-label="Agregar equivalencia"
                          >
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                              <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {equivError && <p className="plan-error" role="alert">{equivError}</p>}
            </>
          )
        ) : cargando ? (
          <p className="mi-plan-loading">Cargando tu plan…</p>
        ) : (
          <>
            {comidas.map((comida, i) =>
              comida.minimizada ? (
                <div key={i} className="comida-card comida-card--min">
                  <span className="comida-min__nombre">{comida.nombre || 'Sin nombre'}</span>
                  {comida.hora && <span className="comida-min__hora">{comida.hora}</span>}
                  <div className="comida-min__chips">
                    {GRUPOS.filter(g => comida.porciones[g.key] > 0).map(g => (
                      <span key={g.key} className={`porcion-chip porcion-chip--${g.key}`}>
                        <span className="porcion-chip__num">{comida.porciones[g.key]}</span>
                        {g.label}
                      </span>
                    ))}
                  </div>
                  <button
                    className="btn-editar"
                    onClick={() => editarComida(i)}
                    aria-label="Editar comida"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path d="M12.5 2.5a1.414 1.414 0 0 1 2 2L5 14H3v-2L12.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    className="btn-eliminar-min"
                    onClick={() => eliminarComida(i)}
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
                    />
                    <button
                      className="btn-eliminar-exp"
                      onClick={() => eliminarComida(i)}
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
                  {GRUPOS.map(g => (
                    <div key={g.key} className="porcion-row">
                      <span className="porcion-row__dot" style={{ background: g.dot }} />
                      <span className="porcion-row__label">{g.label}</span>
                      <div className="porcion-row__stepper">
                        <button
                          className="stepper-btn"
                          onClick={() => actualizarPorcion(i, g.key, -0.5)}
                          disabled={comida.porciones[g.key] <= 0}
                          aria-label={`Reducir ${g.label}`}
                        >−</button>
                        <span className="stepper-value" aria-live="polite">{comida.porciones[g.key]}</span>
                        <button
                          className="stepper-btn"
                          onClick={() => actualizarPorcion(i, g.key, 0.5)}
                          disabled={comida.porciones[g.key] >= 10}
                          aria-label={`Aumentar ${g.label}`}
                        >+</button>
                      </div>
                    </div>
                  ))}
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

            {error && <p className="plan-error" role="alert">{error}</p>}

            <button className="btn-confirmar" onClick={confirmarPlan} disabled={confirmando}>
              {confirmando ? 'Confirmando…' : 'Confirmar plan'}
            </button>

            {confirmado && <p className="confirmado-msg">¡Plan guardado!</p>}

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
          </>
        )}
      </div>
    </div>
  )
}
