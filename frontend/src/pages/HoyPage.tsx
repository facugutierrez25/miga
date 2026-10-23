import { Fragment, useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import { useAhora } from '../hooks/useAhora'
import { getMyPlan, type FoodGroup, type MealDto, type PlanDto } from '../api/plans'
import { getIntake, addFoodEntry, deleteFoodEntry, markMealConsumed, unmarkMealConsumed, type FoodEntryDto } from '../api/intake'
import { getEquivalences, type EquivalenceDto } from '../api/equivalences'
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

function saludo(ahora: Date): string {
  const h = ahora.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function formatNombre(email: string | undefined): string {
  if (!email) return ''
  const local = email.split('@')[0]
  return local
    .replace(/[._+]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

function esPasada(suggestedTime: string | undefined, ahora: Date): boolean {
  if (!suggestedTime) return false
  const [h, m] = suggestedTime.split(':').map(Number)
  const nowMin = ahora.getHours() * 60 + ahora.getMinutes()
  return h * 60 + m < nowMin - 90
}

function findIndexAhora(meals: MealDto[], consumedSet: Set<number>, ahora: Date): number {
  if (meals.length === 0) return -1
  const nowMin = ahora.getHours() * 60 + ahora.getMinutes()

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
    .find(({ m }) => m.id === undefined || !consumedSet.has(m.id))

  return firstUneaten ? firstUneaten.i : meals.length - 1
}

function calcPortions(entry: FoodEntryDto, equivalences: EquivalenceDto[]): number {
  const equiv = equivalences.find(e => e.food === entry.food && e.foodGroup === entry.foodGroup)
  if (!equiv || equiv.quantity === 0) return 0
  return entry.quantity / equiv.quantity
}

function calcResumen(meals: MealDto[], entries: FoodEntryDto[], equivalences: EquivalenceDto[]) {
  const totalByGroup: Partial<Record<FoodGroup, number>> = {}
  const doneByGroup: Partial<Record<FoodGroup, number>> = {}

  for (const meal of meals) {
    for (const p of meal.portions) {
      if (p.portions <= 0) continue
      const n = Number(p.portions)
      totalByGroup[p.foodGroup] = (totalByGroup[p.foodGroup] ?? 0) + n
    }
  }

  for (const entry of entries.filter(e => e.consumed)) {
    const portions = calcPortions(entry, equivalences)
    doneByGroup[entry.foodGroup] = (doneByGroup[entry.foodGroup] ?? 0) + portions
  }

  const total = Object.values(totalByGroup).reduce((s, v) => s + v, 0)
  const done = Object.values(doneByGroup).reduce((s, v) => s + v, 0)

  const porGrupo: Partial<Record<FoodGroup, { total: number; done: number }>> = {}
  for (const [g, t] of Object.entries(totalByGroup) as [FoodGroup, number][]) {
    porGrupo[g] = { total: t, done: doneByGroup[g] ?? 0 }
  }

  return { total, done, porGrupo }
}

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ',')
}

// ── IntakeMealSection ──────────────────────────────────────────────────────

interface IntakeMealSectionProps {
  mealId: number
  entries: FoodEntryDto[]
  equivalences: EquivalenceDto[]
  mealFoodGroups: FoodGroup[]
  onAdd: (mealId: number, food: string, qty: number, unit: string, foodGroup: FoodGroup) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onToggleConsumed: (mealId: number) => Promise<void>
  isConsumed: boolean
  isAhora: boolean
}

function IntakeMealSection({
  mealId, entries, equivalences, mealFoodGroups,
  onAdd, onDelete, onToggleConsumed, isConsumed, isAhora,
}: IntakeMealSectionProps) {
  const [isOpen, setIsOpen] = useState(isAhora)
  const [selectedEquivId, setSelectedEquivId] = useState<string>('')
  const [qty, setQty] = useState('')
  const [adding, setAdding] = useState(false)

  const relevantEquivs = equivalences.filter(e => mealFoodGroups.includes(e.foodGroup))
  const selectedEquiv = equivalences.find(e => String(e.id) === selectedEquivId)
  const hasEntries = entries.length > 0
  const unitLabel = selectedEquiv?.unit.toLowerCase() ?? ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedEquiv) return
    const q = parseFloat(qty)
    if (!q || q <= 0) return
    setAdding(true)
    try {
      await onAdd(mealId, selectedEquiv.food, q, selectedEquiv.unit, selectedEquiv.foodGroup)
      setQty('')
      setSelectedEquivId('')
    } finally {
      setAdding(false)
    }
  }

  const summaryLabel = !hasEntries
    ? 'Registrar'
    : isConsumed
      ? `✓ ${entries.length} alimento${entries.length !== 1 ? 's' : ''}`
      : `${entries.length} alimento${entries.length !== 1 ? 's' : ''}`

  return (
    <div className="comida-hoy__intake">
      <button
        className="intake-toggle"
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
        aria-controls={`intake-body-${mealId}`}
      >
        <span className={`intake-toggle__label${isConsumed ? ' intake-toggle__label--consumed' : ''}`}>
          {summaryLabel}
        </span>
        <svg
          className={`intake-toggle__chevron${isOpen ? ' intake-toggle__chevron--open' : ''}`}
          viewBox="0 0 10 6" fill="none" aria-hidden="true" width="10" height="6"
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <div className="intake-body" id={`intake-body-${mealId}`}>
          {hasEntries && (
            <ul className="intake-entries" aria-label="Lo que comiste">
              {entries.map(e => (
                <li key={e.id} className="intake-entry">
                  <span className="intake-entry__food">{e.food}</span>
                  <span className="intake-entry__qty">{e.quantity} {e.unit.toLowerCase()}</span>
                  <button
                    className="intake-entry__del"
                    onClick={() => onDelete(e.id)}
                    aria-label={`Eliminar ${e.food}`}
                    type="button"
                  >×</button>
                </li>
              ))}
            </ul>
          )}

          <form className="intake-form" onSubmit={handleSubmit}>
            {relevantEquivs.length === 0 ? (
              <span className="intake-form__hint">
                Agregá equivalencias en{' '}
                <Link to="/mi-plan" className="intake-form__hint-link">Mi plan</Link>
                {' '}para registrar lo que comés
              </span>
            ) : (
              <>
                <div className="intake-form__equiv-wrap">
                  <select
                    className="intake-form__equiv"
                    value={selectedEquivId}
                    onChange={e => { setSelectedEquivId(e.target.value); setQty('') }}
                    aria-label="Alimento"
                  >
                    <option value="">Alimento…</option>
                    {(Object.keys(GRUPOS) as FoodGroup[])
                      .filter(g => relevantEquivs.some(e => e.foodGroup === g))
                      .map(g => (
                        <optgroup key={g} label={GRUPOS[g].label}>
                          {relevantEquivs
                            .filter(e => e.foodGroup === g)
                            .map(e => (
                              <option key={e.id} value={String(e.id)}>
                                {e.food}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                  </select>
                  <svg className="intake-form__chevron" viewBox="0 0 10 6" fill="none" aria-hidden="true" width="10" height="6">
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <input
                  className="intake-form__qty"
                  type="number"
                  placeholder="Cant."
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  min={0.01}
                  step="any"
                  aria-label="Cantidad"
                  disabled={!selectedEquiv}
                />
                {unitLabel && <span className="intake-form__unit-label">{unitLabel}</span>}
                <button
                  className="intake-form__add"
                  type="submit"
                  disabled={adding || !selectedEquiv || !qty}
                  aria-label="Agregar alimento"
                >+</button>
              </>
            )}
          </form>

          {hasEntries && (
            <button
              className={[
                'btn-ya-lo-comi',
                isConsumed ? 'btn-ya-lo-comi--hecha' : '',
                !isAhora ? 'btn-ya-lo-comi--secondary' : '',
              ].filter(Boolean).join(' ')}
              aria-pressed={isConsumed}
              onClick={() => onToggleConsumed(mealId)}
            >
              {isConsumed ? '✓ Hecho' : isAhora ? 'Ya lo comí' : 'Marcar como comido'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── HoyPage ────────────────────────────────────────────────────────────────

export default function HoyPage() {
  useTitle('Hoy | Miga')
  // Hora del dispositivo, al día aunque la app vuelva de segundo plano
  const ahora = useAhora()
  const HOY = toISO(ahora)
  const { token, email, firstName } = useAuth()
  const [fecha, setFecha] = useState(HOY)
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [sinPlan, setSinPlan] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [entries, setEntries] = useState<FoodEntryDto[]>([])
  const [equivalences, setEquivalences] = useState<EquivalenceDto[]>([])

  // Si pasó la medianoche con la app abierta (o en segundo plano) y estaba viendo
  // "hoy", se pasa solo al día nuevo. Si estaba mirando otro día, no se toca.
  const hoyAnterior = useRef(HOY)
  useEffect(() => {
    if (hoyAnterior.current === HOY) return
    const anterior = hoyAnterior.current
    hoyAnterior.current = HOY
    setFecha(f => (f === anterior ? HOY : f))
  }, [HOY])

  useEffect(() => {
    if (!token) return
    getMyPlan(token)
      .then(data => setPlan(data))
      .catch(err => { if (err.message === 'sin-plan') setSinPlan(true) })
      .finally(() => setCargando(false))
  }, [token])

  useEffect(() => {
    if (!token) return
    getEquivalences(token).then(setEquivalences).catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) return
    getIntake(token, fecha)
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [token, fecha])

  function irDia(delta: number) {
    setEntries([])
    setFecha(f => sumarDias(f, delta))
  }

  const addEntry = useCallback(async (mealId: number, food: string, qty: number, unit: string, foodGroup: FoodGroup) => {
    if (!token) return
    const entry = await addFoodEntry(token, fecha, mealId, food, qty, unit, foodGroup)
    setEntries(prev => [...prev, entry])
  }, [token, fecha])

  const deleteEntry = useCallback(async (id: number) => {
    if (!token) return
    setEntries(prev => prev.filter(e => e.id !== id))
    try {
      await deleteFoodEntry(token, id)
    } catch {
      getIntake(token, fecha).then(setEntries).catch(() => {})
    }
  }, [token, fecha])

  const toggleConsumed = useCallback(async (mealId: number) => {
    if (!token) return
    const mealEntries = entries.filter(e => e.mealId === mealId)
    if (mealEntries.length === 0) return
    const wasConsumed = mealEntries.every(e => e.consumed)

    setEntries(prev => prev.map(e =>
      e.mealId === mealId ? { ...e, consumed: !wasConsumed } : e
    ))
    try {
      if (wasConsumed) await unmarkMealConsumed(token, fecha, mealId)
      else await markMealConsumed(token, fecha, mealId)
    } catch {
      setEntries(prev => prev.map(e =>
        e.mealId === mealId ? { ...e, consumed: wasConsumed } : e
      ))
    }
  }, [token, fecha, entries])

  const esHoy = fecha === HOY
  const nombre = firstName ?? formatNombre(email ?? undefined)
  const meals = plan?.meals.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? []

  const consumedMealIds = new Set(
    meals
      .filter(m => m.id !== undefined)
      .filter(m => {
        const mealEntries = entries.filter(e => e.mealId === m.id)
        return mealEntries.length > 0 && mealEntries.every(e => e.consumed)
      })
      .map(m => m.id!)
  )

  const ahoraIdx = esHoy && plan ? findIndexAhora(meals, consumedMealIds, ahora) : -1
  const { total, done, porGrupo } = calcResumen(meals, entries, equivalences)

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
          {esHoy ? `${saludo(ahora)}, ${nombre}.` : formatFechaLarga(fecha)}
        </h1>
      </header>

      <div className="hoy-body">
        <div className="hoy-desktop-saludo">
          {navFecha}
          <h1 className="hoy-desktop-saludo__titulo">
            {esHoy ? `${saludo(ahora)}, ${nombre}.` : formatFechaLarga(fecha)}
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
                      const pct = Math.min(100, Math.round((d / t) * 100))
                      const circ = 2 * Math.PI * 15
                      return (
                        <Fragment key={g}>
                        <div className="hoy-grupo-prog" title={GRUPOS[g].label}>
                          <span className="hoy-grupo-prog__nombre">{GRUPOS[g].label}</span>
                          <div className="hoy-grupo-prog__bar">
                            <div
                              className="hoy-grupo-prog__fill"
                              style={{ width: `${pct}%`, background: GRUPOS[g].token }}
                            />
                          </div>
                          <span className="hoy-grupo-prog__frac">{fmt(d)}/{fmt(t)}</span>
                        </div>
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
                          <span className="hoy-anillo__nombre" aria-hidden="true">{GRUPOS[g].label}</span>
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
                const isConsumed = meal.id !== undefined && consumedMealIds.has(meal.id)
                const pasada = esHoy && !isConsumed && !esAhora && esPasada(meal.suggestedTime, ahora)
                const mealFoodGroups = noVacias.map(p => p.foodGroup)

                return (
                  <div
                    key={i}
                    className={[
                      'comida-hoy',
                      esAhora && !isConsumed ? 'comida-hoy--ahora' : '',
                      isConsumed ? 'comida-hoy--hecha' : '',
                      pasada ? 'comida-hoy--pasada' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="comida-hoy__encabezado">
                      <div className="comida-hoy__nombre-wrap">
                        <span className="comida-hoy__nombre">{meal.name}</span>
                        {isConsumed && (
                          <svg className="comida-hoy__done-icon" viewBox="0 0 16 16" fill="none" aria-label="Consumida" width="14" height="14">
                            <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15"/>
                            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      {meal.suggestedTime && (
                        <div className={`comida-hoy__hora-wrap${esAhora && !isConsumed ? ' comida-hoy__hora-wrap--ahora' : ''}`}>
                          <span className="comida-hoy__hora">
                            {meal.suggestedTime.slice(0, 5)}
                          </span>
                        </div>
                      )}
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

                    {meal.id !== undefined && (
                      <IntakeMealSection
                        mealId={meal.id}
                        entries={entries.filter(e => e.mealId === meal.id)}
                        equivalences={equivalences}
                        mealFoodGroups={mealFoodGroups}
                        onAdd={addEntry}
                        onDelete={deleteEntry}
                        onToggleConsumed={toggleConsumed}
                        isConsumed={isConsumed}
                        isAhora={esAhora}
                      />
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
