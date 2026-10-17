import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Brand from '../components/Brand'
import { getMyPlan, type FoodGroup, type MealDto, type PlanDto } from '../api/plans'
import { getTodayLog, markMealEaten, unmarkMealEaten } from '../api/registro'
import './HoyPage.css'

const GRUPOS: Record<FoodGroup, { label: string; token: string }> = {
  PROTEINS:   { label: 'Proteínas', token: 'var(--g-prot)' },
  GRAINS:     { label: 'Cereales',  token: 'var(--g-cer)'  },
  FRUITS:     { label: 'Frutas',    token: 'var(--g-frut)' },
  DAIRY:      { label: 'Lácteos',   token: 'var(--g-lac)'  },
  FATS:       { label: 'Grasas',    token: 'var(--g-gras)' },
  VEGETABLES: { label: 'Verduras',  token: 'var(--g-verd)' },
}

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function fechaHoy(): string {
  return new Date().toLocaleDateString('es-UY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
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

  // Buscar por ventana de tiempo (independiente del estado)
  const byTime = meals
    .map((m, i) => ({ m, i }))
    .find(({ m }) => {
      if (!m.suggestedTime) return false
      const [h, min] = m.suggestedTime.split(':').map(Number)
      const mealMin = h * 60 + min
      return mealMin >= nowMin - 90 && mealMin <= nowMin + 180
    })

  if (byTime) return byTime.i

  // Si no hay por tiempo, primera no hecha; si todas hechas, la última
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
  const { token, email } = useAuth()
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [sinPlan, setSinPlan] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [comidas, setComidas] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!token) return
    Promise.all([
      getMyPlan(token).catch(err => { if (err.message === 'sin-plan') setSinPlan(true); return null }),
      getTodayLog(token).catch(() => [] as number[]),
    ]).then(([planData, log]) => {
      if (planData) setPlan(planData)
      setComidas(new Set(log))
    }).finally(() => setCargando(false))
  }, [token])

  const toggle = useCallback(async (mealId: number) => {
    if (!token) return
    const eaten = comidas.has(mealId)
    setComidas(prev => {
      const next = new Set(prev)
      if (eaten) next.delete(mealId); else next.add(mealId)
      return next
    })
    try {
      if (eaten) await unmarkMealEaten(token, mealId); else await markMealEaten(token, mealId)
    } catch {
      setComidas(prev => {
        const next = new Set(prev)
        if (eaten) next.add(mealId); else next.delete(mealId)
        return next
      })
    }
  }, [token, comidas])

  const nombre = email?.split('@')[0] ?? ''
  const meals = plan?.meals.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? []
  const ahoraIdx = plan ? findIndexAhora(meals, comidas) : -1
  const { total, done, porGrupo } = calcResumen(meals, comidas)

  return (
    <div className="hoy-page">
      <header className="hoy-header">
        <div className="hoy-header__meta">
          <Brand size={20} />
          <p className="hoy-header__fecha">{fechaHoy()}</p>
        </div>
        <h1 className="hoy-header__titulo">{saludo()}, {nombre}.</h1>
      </header>

      <div className="hoy-body">
        <div className="hoy-desktop-saludo">
          <p className="hoy-desktop-saludo__fecha">{fechaHoy()}</p>
          <h1 className="hoy-desktop-saludo__titulo">{saludo()}, {nombre}.</h1>
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
                      return (
                        <div key={g} className="hoy-grupo-prog" title={GRUPOS[g].label}>
                          <div
                            className="hoy-grupo-prog__dot"
                            style={{ background: GRUPOS[g].token }}
                          />
                          <div className="hoy-grupo-prog__bar">
                            <div
                              className="hoy-grupo-prog__fill"
                              style={{ width: `${pct}%`, background: GRUPOS[g].token }}
                            />
                          </div>
                          <span className="hoy-grupo-prog__frac">{fmt(d)}/{fmt(t)}</span>
                        </div>
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
                const pasada = !hecha && esPasada(meal.suggestedTime)

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
                            {esAhora && !hecha && <span className="comida-hoy__live-dot" aria-hidden="true" />}
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
