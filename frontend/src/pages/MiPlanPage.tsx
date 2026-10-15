import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import Brand from '../components/Brand'
import { getMyPlan, saveMyPlan, type FoodGroup, type PlanDto } from '../api/plans'
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
      return { nombre: meal.name, porciones, minimizada: true }
    })
}

function localAPlan(comidas: ComidaLocal[]): PlanDto {
  return {
    meals: comidas.map((c, i) => ({
      name: c.nombre,
      displayOrder: i + 1,
      portions: GRUPOS.map(g => ({ foodGroup: g.key, portions: c.porciones[g.key] })),
    })),
  }
}

export default function MiPlanPage() {
  const { token } = useAuth()
  const [comidas, setComidas] = useState<ComidaLocal[]>([])
  const [cargando, setCargando] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    getMyPlan(token)
      .then(dto => setComidas(planALocal(dto)))
      .catch(err => { if (err.message !== 'sin-plan') console.error(err) })
      .finally(() => setCargando(false))
  }, [token])

  function actualizarNombre(i: number, nombre: string) {
    setComidas(prev => prev.map((c, j) => j === i ? { ...c, nombre } : c))
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
    setComidas(prev => [...prev, { nombre: '', porciones: porcionesVacias(), minimizada: false }])
  }

  function eliminarComida(i: number) {
    setComidas(prev => prev.filter((_, j) => j !== i))
  }

  async function confirmarPlan() {
    if (!token) return
    setConfirmando(true)
    setError(null)
    try {
      const dto = await saveMyPlan(token, localAPlan(comidas))
      setComidas(planALocal(dto))
      setConfirmado(true)
      setTimeout(() => setConfirmado(false), 2500)
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
        <Brand size={28} />
        <h1 className="mi-plan-header__title">Tu plan</h1>
      </header>

      <div className="mi-plan-body">
        {cargando ? (
          <p className="mi-plan-loading">Cargando tu plan…</p>
        ) : (
          <>
            {comidas.map((comida, i) =>
              comida.minimizada ? (
                <div key={i} className="comida-card comida-card--min">
                  <span className="comida-min__nombre">{comida.nombre || 'Sin nombre'}</span>
                  <div className="comida-min__chips">
                    {GRUPOS.filter(g => comida.porciones[g.key] > 0).map(g => (
                      <span key={g.key} className="porcion-chip">
                        <span className="porcion-chip__dot" style={{ background: g.dot }} />
                        {comida.porciones[g.key]}
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
          </>
        )}
      </div>
    </div>
  )
}
