import { Fragment, useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Brand from '../components/Brand'
import { getMyPlan, type FoodGroup, type MealDto, type PlanDto } from '../api/plans'
import { getLog, markMealEaten, unmarkMealEaten } from '../api/registro'
import './HoyPage.css'

const GRUPOS: Record<FoodGroup, { label: string; token: string }> = {
  PROTEINS:   { label: 'Proteínas', token: 'var(--g-prot)' },
  GRAINS:     { label: 'Cereales',  token: 'var(--g-cer)'  },
  FRUITS:     { label: 'Frutas',    token: 'var(--g-frut)' },
  DAIRY:      { label: 'Lácteos',   token: 'var(--g-lac)'  },
  FATS:       { label: 'Grasas',    token: 'var(--g-gras)' },
  VEGETABLES: { label: 'Verduras',  token: 'var(--g-verd)' },
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sumarDias(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  return toISO(d)
}

function formatFechaLarga(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-UY', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function labelFecha(iso: string, hoy: string): string {
  if (iso === hoy) return 'Hoy'
  if (iso === sumarDias(hoy, -1)) return 'Ayer'
  const d = new Date(iso + 'T12:00:00')
  const wd = d.toLocaleDateString('es-UY', { weekday: 'short' }).replace(/\./g, '')
  const day = d.getDate()
  const mo = d.toLocaleDateString('es-UY', { month: 'short' }).replace(/\./g, '')
  return `${wd} ${day} ${mo}`
}

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function esPasada(suggestedTime?: string): boolean {
  if (!suggestedTime) return false
  const [h, m] = suggestedTime.split(':').map(Number)
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  return h * 60 + m < nowMin - 90
}

function findIndexAhora(meals: MealDto[], comidas: Set<number>): number {
  if (meals.length === 0) return -1
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  const byTime = meals
    .map((m, i) => ({ m, i }))
    .find(({ m }) => {
      if (!m.suggestedTime) return false
      const [h, min] = m.suggestedTime.split(':').map(Number)
      const mealMin = h * 60 + min
      return mealMin >= nowMin - 90 && mealMin <= nowMin + 180
    })

  if (byTime) return byTime.i

  const firstUneaten = meals
    .map((m, i) => ({ m, i }))
    .find(({ m }) => m.id === undefined || !comidas.has(m.id))

  return firstUneaten ? firstUneaten.i : meals.length - 1
}

function calcResumen(meals: MealDto[], comidas: Set<number>) {
  let total = 0
  let done = 0
  const porGrupo: Partial<Record<FoodGroup, { total: number; done: number }>> = {}

  for (const meal of meals) {
    const eaten = meal.id !== undefined && comidas.has(meal.id)
    for (const p of meal.portions) {
      if (p.portions <= 0) continue
      const n = Number(p.portions)
      total += n
      if (eaten) done += n
      if (!porGrupo[p.foodGroup]) porGrupo[p.foodGroup] = { total: 0, done: 0 }
      porGrupo[p.foodGroup]!.total += n
      if (eaten) porGrupo[p.foodGroup]!.done += n
    }
  }

  return { total, done, porGrupo }
}

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ',')
}

export default function HoyPage() {
  const HOY = toISO(new Date())
  const { token, email } = useAuth()
  const [fecha, setFecha] = useState(HOY)
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [sinPlan, setSinPlan] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [comidas, setComidas] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!token) return
    getMyPlan(token)
      .then(data => setPlan(data))
      .catch(err => { if (err.message === 'sin-plan') setSinPlan(true) })
      .finally(() => setCargando(false))
  }, [token])

  useEffect(() => {
    if (!token) return
    getLog(token, fecha)
      .then(log => setComidas(new Set(log)))
      .catch(() => setComidas(new Set()))
  }, [token, fecha])

  function irDia(delta: number) {
    setComidas(new Set())
    setFecha(f => sumarDias(f, delta))
  }

  const toggle = useCallback(async (mealId: number) => {
    if (!token) return
    const eaten = comidas.has(mealId)
    setComidas(prev => {
      const next = new Set(prev)
      if (eaten) next.delete(mealId); else next.add(mealId)
      return next
    })
    try {
      if (eaten) await unmarkMealEaten(token, mealId, fecha)
      else await markMealEaten(token, mealId, fecha)
    } catch {
      setComidas(prev => {
        const next = new Set(prev)
        if (eaten) next.add(mealId); else next.delete(mealId)
        return next
      })
    }
  }, [token, comidas, fecha])

  const esHoy = fecha === HOY
  const nombre = email?.split('@')[0] ?? ''
  const meals = plan?.meals.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? []
  const ahoraIdx = esHoy && plan ? findIndexAhora(meals, comidas) : -1
  const { total, done, porGrupo } = calcResumen(meals, comidas)

  const navFecha = (
    <nav className="hoy-fecha-nav" aria-label="Navegación por fecha">
      <button
        className="hoy-fecha-nav__btn"
        onClick={() => irDia(-1)}
        aria-label="Día anterior"
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
          <path d="M8 2L2 8l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <span className="hoy-fecha-nav__label">{labelFecha(fecha, HOY)}</span>
      <button
        className="hoy-fecha-nav__btn"
        onClick={() => irDia(1)}
        disabled={esHoy}
        aria-label="Día siguiente"
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
          <path d="M2 2l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </nav>
  )

  return (
    <div className="hoy-page">
      <header className="hoy-header">
        <div className="hoy-header__meta">
          <Brand size={20} />
        </div>
        {navFecha}
        <h1 className="hoy-header__titulo">
          {esHoy ? `${saludo()}, ${nombre}.` : formatFechaLarga(fecha)}
        </h1>
      </header>

      <div className="hoy-body">
        <div className="hoy-desktop-saludo">
          {navFecha}
          <h1 className="hoy-desktop-saludo__titulo">
            {esHoy ? `${saludo()}, ${nombre}.` : formatFechaLarga(fecha)}
          </h1>
        </div>

        {cargando ? (
          <p className="hoy-loading">Cargando tu día…</p>
        ) : sinPlan ? (
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
            {total > 0 && (
              <div className="hoy-resumen">
                <div className="hoy-resumen__porciones">
                  <span className="hoy-resumen__num">{fmt(done)}</span>
                  <span className="hoy-resumen__sep"> de </span>
                  <span className="hoy-resumen__total">{fmt(total)}</span>
                  <span className="hoy-resumen__label">porciones</span>
                </div>
                <div className="hoy-resumen__grupos">
                  {(Object.keys(GRUPOS) as FoodGroup[])
                    .filter(g => porGrupo[g] && porGrupo[g]!.total > 0)
                    .map(g => {
                      const { total: t, done: d } = porGrupo[g]!
                      const pct = Math.round((d / t) * 100)
                      const circ = 2 * Math.PI * 15
                      return (
                        <Fragment key={g}>
                        {/* Escritorio: barra por grupo */}
                        <div className="hoy-grupo-prog" title={GRUPOS[g].label}>
                          <div className="hoy-grupo-prog__dot" style={{ background: GRUPOS[g].token }} />
                          <div className="hoy-grupo-prog__bar">
                            <div
                              className="hoy-grupo-prog__fill"
                              style={{ width: `${pct}%`, background: GRUPOS[g].token }}
                            />
                          </div>
                          <span className="hoy-grupo-prog__frac">{fmt(d)}/{fmt(t)}</span>
                        </div>
                        {/* Celular: anillo por grupo */}
                        <div
                          className="hoy-anillo"
                          role="img"
                          aria-label={`${GRUPOS[g].label}: ${fmt(d)} de ${fmt(t)}`}
                        >
                          <svg className="hoy-anillo__svg" viewBox="0 0 40 40" aria-hidden="true">
                            <circle className="hoy-anillo__pista" cx="20" cy="20" r="15" />
                            <circle
                              className="hoy-anillo__valor"
                              cx="20" cy="20" r="15"
                              style={{ stroke: GRUPOS[g].token, opacity: pct > 0 ? 1 : 0 }}
                              strokeDasharray={`${(pct / 100) * circ} ${circ}`}
                            />
                          </svg>
                          <span className="hoy-anillo__frac" aria-hidden="true">{fmt(d)}/{fmt(t)}</span>
                        </div>
                        </Fragment>
                      )
                    })}
                </div>
              </div>
            )}

            <div className="hoy-cards">
              {meals.map((meal, i) => {
                const noVacias = meal.portions.filter(p => p.portions > 0)
                const esAhora = i === ahoraIdx
                const hecha = meal.id !== undefined && comidas.has(meal.id)
                const pasada = esHoy && !hecha && esPasada(meal.suggestedTime)

                return (
                  <div
                    key={i}
                    className={[
                      'comida-hoy',
                      esAhora && !hecha ? 'comida-hoy--ahora' : '',
                      hecha ? 'comida-hoy--hecha' : '',
                      pasada ? 'comida-hoy--pasada' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="comida-hoy__encabezado">
                      <span className="comida-hoy__nombre">{meal.name}</span>
                      <div className="comida-hoy__enc-right">
                        {meal.suggestedTime && (
                          <div className={`comida-hoy__hora-wrap${esAhora && !hecha ? ' comida-hoy__hora-wrap--ahora' : ''}`}>
                            <span className="comida-hoy__hora">
                              {meal.suggestedTime.slice(0, 5)}
                            </span>
                          </div>
                        )}
                        {meal.id !== undefined && !esAhora && (
                          <button
                            className={`btn-toggle-comida${hecha ? ' btn-toggle-comida--hecha' : ''}`}
                            aria-pressed={hecha}
                            aria-label={hecha ? `Desmarcar ${meal.name}` : `Marcar ${meal.name} como comida`}
                            onClick={() => toggle(meal.id!)}
                          >
                            <span className="btn-toggle-comida__dot" />
                          </button>
                        )}
                      </div>
                    </div>

                    {noVacias.length > 0 && (
                      <div className="comida-hoy__grupos">
                        {noVacias.map(p => (
                          <span key={p.foodGroup} className={`grupo-badge grupo-badge--${p.foodGroup}`}>
                            <span className="grupo-badge__numero">{fmt(Number(p.portions))}</span>
                            <span className="grupo-badge__label">{GRUPOS[p.foodGroup].label}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {meal.id !== undefined && esAhora && (
                      <button
                        className={`btn-ya-lo-comi${hecha ? ' btn-ya-lo-comi--hecha' : ''}`}
                        aria-pressed={hecha}
                        onClick={() => toggle(meal.id!)}
                      >
                        {hecha ? '✓ Hecho' : 'Ya lo comí'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
