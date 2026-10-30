import { Fragment, useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import { useAhora } from '../hooks/useAhora'
import { getMyPlan, type PlanFoodGroupDto, type MealDto, type PlanDto } from '../api/plans'
import {
  NoteConflictError, getDayRegistro, saveNota, patchItem, saveRespuesta, getSugerencias,
  type DayRegistroDto, type MealDayDto, type EntryItemDto,
  type GroupStatusDto, type NoteInterpretationDto, type PatchItemResultDto, type PatchItemRequest,
} from '../api/registro'
import './HoyPage.css'

const ABBR_DOT: Record<string, string> = {
  PRO: 'var(--g-prot)', CER: 'var(--g-cer)', FRU: 'var(--g-frut)',
  LAC: 'var(--g-lac)',  GRA: 'var(--g-gras)', VER: 'var(--g-verd)',
}

const ABBR_CSS: Record<string, string> = {
  PRO: 'PROTEINS', CER: 'GRAINS', FRU: 'FRUITS',
  LAC: 'DAIRY',    GRA: 'FATS',   VER: 'VEGETABLES',
}


interface GrupoInfo {
  name: string
  token: string
  cssKey: string
}

function buildGruposMap(foodGroups: PlanFoodGroupDto[]): Record<number, GrupoInfo> {
  return Object.fromEntries(
    foodGroups.map(g => [g.id, {
      name: g.name,
      token: ABBR_DOT[g.abbreviation] ?? 'var(--g-prot)',
      cssKey: ABBR_CSS[g.abbreviation] ?? g.abbreviation,
    }])
  )
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

function findIndexAhora(meals: MealDto[], ahora: Date): number {
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

  const firstWithoutNote = meals.map((m, i) => ({ m, i })).find(({ m }) =>
    m.id === undefined
  )
  return firstWithoutNote ? firstWithoutNote.i : meals.length - 1
}

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ',')
}

function statusColor(status: string): string {
  if (status === 'OK' || status === 'CUMPLIDO') return 'var(--g-verd)'
  if (status === 'EXCEDIDO') return 'var(--error)'
  if (status === 'INCOMPLETO' || status === 'SIN_ANOTAR') return 'var(--muted)'
  return 'var(--muted)'
}

// ── ItemRow ───────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: EntryItemDto
  date: string
  token: string
  gruposMap: Record<number, GrupoInfo>
  onPatched: (result: PatchItemResultDto) => void
}

function ItemRow({ item, date, token, gruposMap, onPatched }: ItemRowProps) {
  const [editando, setEditando] = useState(false)
  const [repartiendo, setRepartiendo] = useState(false)
  const [qty, setQty] = useState(String(item.quantity ?? ''))
  const [reparto, setReparto] = useState<{ foodGroupId: string; porciones: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const info = item.foodGroupId !== null ? gruposMap[item.foodGroupId] : null
  const editable = item.id > 0

  async function enviar(req: PatchItemRequest) {
    setSaving(true)
    setError(null)
    try {
      onPatched(await patchItem(token, date, item.id, req))
      setEditando(false)
      setRepartiendo(false)
    } catch {
      setError('No se pudo guardar la corrección.')
    } finally {
      setSaving(false)
    }
  }

  function abrirReparto() {
    const actual = item.foodGroupId !== null ? String(item.foodGroupId) : ''
    setReparto([
      { foodGroupId: actual, porciones: String(item.portions ?? 1) },
      { foodGroupId: '', porciones: '1' },
    ])
    setRepartiendo(true)
  }

  function guardarReparto(saveAsRule: boolean) {
    enviar({
      quantity: item.quantity,
      grupos: reparto.map(r => ({ foodGroupId: Number(r.foodGroupId), porciones: Number(r.porciones) })),
      saveAsRule,
    })
  }

  const repartoValido = reparto.length >= 2
    && reparto.every(r => r.foodGroupId && Number(r.porciones) > 0)
    && new Set(reparto.map(r => r.foodGroupId)).size === reparto.length

  const dot = info?.token ?? 'var(--muted)'
  const label = info?.name ?? (item.foodGroupId !== null ? String(item.foodGroupId) : item.appliedRule ? null : 'Sin grupo en tu plan')

  return (
    <li className={`nota-item${item.uncertain ? ' nota-item--dudoso' : ''}`}>
      <div className="nota-item__linea">
        <span className="nota-item__dot" style={{ background: dot }} aria-hidden="true" />
        <span className="nota-item__food">{item.food}</span>
        {editando ? (
          <>
            <input
              className="nota-item__qty-input"
              type="number"
              value={qty}
              onChange={e => setQty(e.target.value)}
              min={0}
              step="any"
              aria-label={`Cantidad de ${item.food}`}
            />
            <span className="nota-item__unit">{item.unit ?? ''}</span>
            <button type="button" className="nota-item__save" aria-label="Guardar cantidad"
              disabled={saving || !(Number(qty) > 0)}
              onClick={() => enviar({ quantity: Number(qty), unit: item.unit })}>✓</button>
            <button type="button" className="nota-item__cancel" aria-label="Cancelar"
              onClick={() => { setEditando(false); setRepartiendo(false); setQty(String(item.quantity ?? '')) }}>✕</button>
          </>
        ) : (
          <>
            {item.quantity !== null && (
              <span className="nota-item__qty">{item.quantity} {item.unit ?? ''}</span>
            )}
            {label && <span className="nota-item__grupo">{label}</span>}
            {item.portions !== null && (
              <span className="nota-item__porciones">{fmt(item.portions)} p.</span>
            )}
            {editable && (
              <button type="button" className="nota-item__edit" onClick={() => setEditando(true)} aria-label={`Corregir ${item.food}`}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M8.5 1.5a1 1 0 0 1 1.414 1.414L3.5 9H2v-1.5L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </>
        )}
      </div>
      {(item.appliedRule || item.uncertain) && (
        <p className="nota-item__regla">
          {item.appliedRule}
          {item.appliedRule && item.uncertain && ' · '}
          {item.uncertain && 'cantidad supuesta'}
        </p>
      )}
      {editando && !repartiendo && (
        <button type="button" className="nota-item__repartir" onClick={abrirReparto}>
          Repartir en varios grupos
        </button>
      )}
      {repartiendo && (
        <fieldset className="nota-reparto">
          <legend>Repartir {item.food} en grupos</legend>
          {reparto.map((r, i) => (
            <div key={i} className="nota-reparto__fila">
              <label>
                <span className="sr-only">Grupo {i + 1}</span>
                <select value={r.foodGroupId}
                  onChange={e => setReparto(rs => rs.map((x, j) => j === i ? { ...x, foodGroupId: e.target.value } : x))}>
                  <option value="">Elegí un grupo</option>
                  {Object.entries(gruposMap).map(([id, g]) => <option key={id} value={id}>{g.name}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Porciones del grupo {i + 1}</span>
                <input type="number" min={0.5} step={0.5} value={r.porciones}
                  onChange={e => setReparto(rs => rs.map((x, j) => j === i ? { ...x, porciones: e.target.value } : x))} />
              </label>
              {reparto.length > 2 && (
                <button type="button" aria-label={`Quitar grupo ${i + 1}`}
                  onClick={() => setReparto(rs => rs.filter((_, j) => j !== i))}>✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setReparto(rs => [...rs, { foodGroupId: '', porciones: '1' }])}>
            + Agregar grupo
          </button>
          <div className="nota-reparto__acciones">
            <button type="button" className="nota-reparto__principal" disabled={saving || !repartoValido}
              onClick={() => guardarReparto(false)}>
              Guardar
            </button>
            <button type="button" disabled={saving || !repartoValido} onClick={() => guardarReparto(true)}>
              Guardar y usar siempre
            </button>
            <button type="button" onClick={() => setRepartiendo(false)}>Cancelar</button>
          </div>
        </fieldset>
      )}
      {error && <p className="nota-error" role="alert">{error}</p>}
    </li>
  )
}

// Tipos de regla que se reconocen pero no generan ítems guardados.
const TIPOS_SIN_ITEM = new Set(['LIBRE', 'FLEXIBLE', 'NO_CUENTA'])

// Agrupa los ítems de una misma mención (p. ej. los grupos de un alimento compuesto).
function agruparPorMencion(items: EntryItemDto[]): EntryItemDto[][] {
  const grupos: EntryItemDto[][] = []
  const porMencion = new Map<string, EntryItemDto[]>()
  for (const item of items) {
    const key = item.occurrenceId
    if (!key) {
      grupos.push([item])
      continue
    }
    const existente = porMencion.get(key)
    if (existente) {
      existente.push(item)
      continue
    }
    const nuevo = [item]
    porMencion.set(key, nuevo)
    grupos.push(nuevo)
  }
  return grupos
}

// ── ComparisonRow ─────────────────────────────────────────────────────────

function ComparisonRow({ status }: { status: GroupStatusDto }) {
  const pct = status.expected > 0
    ? Math.min(100, Math.round((status.recorded / status.expected) * 100))
    : 0
  const color = statusColor(status.status)

  return (
    <div className="comp-row">
      <span className="comp-row__name">{status.name}</span>
      <div className="comp-row__bar">
        <div className="comp-row__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="comp-row__frac">{fmt(status.recorded)}/{fmt(status.expected)}</span>
    </div>
  )
}

// ── NotaMealSection ───────────────────────────────────────────────────────

interface NotaMealSectionProps {
  meal: MealDto
  mealDay: MealDayDto | undefined
  date: string
  token: string
  gruposMap: Record<number, GrupoInfo>
  isAhora: boolean
  onNotaSaved: (interp: NoteInterpretationDto, mealId: number) => void
  onItemPatched: (mealId: number, result: PatchItemResultDto) => void
  onReload: () => Promise<void>
  onRespuestaGuardada: (mealId: number) => void
}

function NotaMealSection({
  meal, mealDay, date, token, gruposMap, isAhora,
  onNotaSaved, onItemPatched, onRespuestaGuardada, onReload,
}: NotaMealSectionProps) {
  const [isOpen, setIsOpen] = useState(isAhora)
  const [texto, setTexto] = useState(mealDay?.noteText ?? '')
  const dirty = useRef(false)
  // Versión de la nota sobre la que se empezó el borrador: una recarga automática
  // no la cambia, así guardar un borrador viejo sigue dando conflicto.
  const baseVersion = useRef<number | null>(mealDay?.noteVersion ?? null)
  const acceptReloadedVersion = useRef(false)
  const [conflict, setConflict] = useState(false)
  const [sugerencias, setSugerencias] = useState<string[]>([])
  const [cargandoSug, setCargandoSug] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const hasNote = !!mealDay?.noteText
  const items = mealDay?.items ?? []
  const comparison = mealDay?.comparison ?? []
  const preguntas = comparison.filter(s => s.status === 'PREGUNTA')

  useEffect(() => {
    if (!dirty.current) {
      setTexto(mealDay?.noteText ?? '')
      baseVersion.current = mealDay?.noteVersion ?? null
    } else if (acceptReloadedVersion.current) {
      acceptReloadedVersion.current = false
      baseVersion.current = mealDay?.noteVersion ?? null
    }
  }, [mealDay?.noteText, mealDay?.noteVersion])

  useEffect(() => {
    if (!isOpen || !meal.id) return
    const controller = new AbortController()
    setCargandoSug(true)
    getSugerencias(token, meal.id!, controller.signal)
      .then(s => { if (!controller.signal.aborted) setSugerencias(s) })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setCargandoSug(false) })
    return () => controller.abort()
  }, [isOpen, meal.id, token])

  async function handleGuardar() {
    if (!meal.id || !texto.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const interp = await saveNota(token, date, meal.id, texto.trim(), baseVersion.current)
      dirty.current = false
      baseVersion.current = interp.version
      setConflict(false)
      onNotaSaved(interp, meal.id)
    } catch (err) {
      setConflict(err instanceof NoteConflictError)
      setError(err instanceof NoteConflictError ? err.message : 'No se pudo guardar. Intentá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleRespuesta(foodGroupId: number, consumed: boolean) {
    if (!meal.id) return
    try {
      await saveRespuesta(token, date, meal.id, { foodGroupId, consumed })
      onRespuestaGuardada(meal.id)
    } catch {
      // no-op
    }
  }

  const summaryLabel = !hasNote
    ? 'Anotar'
    : `${items.length} ${items.length === 1 ? 'ítem' : 'ítems'}`

  return (
    <div className="comida-hoy__nota">
      <button
        className="nota-toggle"
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
      >
        <span className={`nota-toggle__label${hasNote ? ' nota-toggle__label--anotado' : ''}`}>
          {summaryLabel}
        </span>
        <svg
          className={`nota-toggle__chevron${isOpen ? ' nota-toggle__chevron--open' : ''}`}
          viewBox="0 0 10 6" fill="none" aria-hidden="true" width="10" height="6"
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <div className="nota-body">
          {!cargandoSug && sugerencias.length > 0 && !hasNote && (
            <div className="nota-sugerencias" aria-label="Lo de siempre">
              {sugerencias.map((s, i) => (
                <button
                  key={i}
                  className="nota-sugerencia"
                  onClick={() => { dirty.current = true; setTexto(s); textareaRef.current?.focus() }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            className="nota-textarea"
            placeholder="¿Qué comiste? Escribí en texto libre…"
            value={texto}
            onChange={e => { dirty.current = true; setTexto(e.target.value) }}
            rows={3}
            aria-label="Nota de la comida"
          />

          {error && <p className="nota-error" role="alert">{error}</p>}
          {conflict && (
            <button type="button" className="nota-btn-recargar" disabled={guardando}
              onClick={async () => {
                setGuardando(true)
                try {
                  acceptReloadedVersion.current = true
                  await onReload()
                  setConflict(false)
                  setError(null)
                } catch {
                  setError('No se pudo recargar. Intentá de nuevo.')
                } finally {
                  setGuardando(false)
                }
              }}>
              Recargar
            </button>
          )}

          <button
            className="nota-btn-guardar"
            onClick={handleGuardar}
            disabled={guardando || conflict || !texto.trim()}
          >
            {guardando ? 'Guardando…' : hasNote ? 'Guardar cambios' : 'Guardar'}
          </button>

          {items.length > 0 && (
            <section className="nota-entendido" aria-labelledby={`entendido-${meal.id}`}>
              <h4 id={`entendido-${meal.id}`} className="nota-entendido__titulo">Así lo entendí</h4>
              <ul className="nota-items">
                {agruparPorMencion(items).map(mencion => {
                  const fila = (item: EntryItemDto) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      date={date}
                      token={token}
                      gruposMap={gruposMap}
                      onPatched={result => onItemPatched(meal.id!, result)}
                    />
                  )
                  if (mencion.length === 1) return fila(mencion[0])
                  const [primero] = mencion
                  return (
                    <li key={primero.occurrenceId} className="nota-compuesto">
                      <p className="nota-compuesto__titulo">
                        {primero.food}
                        {primero.quantity !== null && <> · {primero.quantity} {primero.unit ?? ''}</>}
                      </p>
                      {primero.appliedRule && <p className="nota-item__regla">{primero.appliedRule}</p>}
                      <ul className="nota-items" aria-label={`Grupos de ${primero.food}`}>
                        {mencion.map(item => fila({ ...item, appliedRule: null }))}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {comparison.length > 0 && (
            <div className="nota-comparacion">
              {comparison
                .filter(s => s.status !== 'PREGUNTA' && s.status !== 'LIBRE')
                .map(s => <ComparisonRow key={s.foodGroupId} status={s} />)}
            </div>
          )}

          {preguntas.map(p => (
            <div key={p.foodGroupId} className="nota-pregunta">
              <span className="nota-pregunta__texto">
                ¿Consumiste <strong>{p.name}</strong>?
              </span>
              <div className="nota-pregunta__acciones">
                <button className="nota-pregunta__si" onClick={() => handleRespuesta(p.foodGroupId, true)}>Sí</button>
                <button className="nota-pregunta__no" onClick={() => handleRespuesta(p.foodGroupId, false)}>No</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Resumen diario ────────────────────────────────────────────────────────

function calcResumenDeDay(
  dayRegistro: DayRegistroDto | null,
  meals: MealDto[],
  gruposMap: Record<number, GrupoInfo>,
) {
  if (!dayRegistro) {
    const totalById: Record<number, number> = {}
    for (const meal of meals) {
      for (const p of meal.portions) {
        if (p.portions <= 0) continue
        totalById[p.foodGroupId] = (totalById[p.foodGroupId] ?? 0) + Number(p.portions)
      }
    }
    const total = Object.values(totalById).reduce((s, v) => s + v, 0)
    return { total, done: 0, porGrupo: {} as Record<number, { total: number; done: number; info: GrupoInfo }> }
  }

  const totalById: Record<number, number> = {}
  const doneById: Record<number, number> = {}

  for (const meal of meals) {
    for (const p of meal.portions) {
      if (p.portions <= 0) continue
      totalById[p.foodGroupId] = (totalById[p.foodGroupId] ?? 0) + Number(p.portions)
    }
  }

  for (const s of dayRegistro.summary) {
    doneById[s.foodGroupId] = Number(s.totalRecorded)
  }

  const total = Object.values(totalById).reduce((s, v) => s + v, 0)
  const done = Object.values(doneById).reduce((s, v) => s + v, 0)

  const porGrupo: Record<number, { total: number; done: number; info: GrupoInfo }> = {}
  for (const [idStr, t] of Object.entries(totalById)) {
    const id = Number(idStr)
    const info = gruposMap[id]
    if (info) porGrupo[id] = { total: t, done: doneById[id] ?? 0, info }
  }

  return { total, done, porGrupo }
}

// ── HoyPage ────────────────────────────────────────────────────────────────

export default function HoyPage() {
  useTitle('Hoy | Miga')
  const ahora = useAhora()
  const HOY = toISO(ahora)
  const { token, email, firstName } = useAuth()
  const [fecha, setFecha] = useState(HOY)
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [sinPlan, setSinPlan] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [dayRegistro, setDayRegistro] = useState<DayRegistroDto | null>(null)
  const [diaError, setDiaError] = useState(false)
  const [diaRetry, setDiaRetry] = useState(0)

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
    const controller = new AbortController()
    getDayRegistro(token, fecha, controller.signal)
      .then(data => { setDayRegistro(data); setDiaError(false) })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setDiaError(true)
      })
    return () => controller.abort()
  }, [token, fecha, diaRetry])

  function irDia(delta: number) {
    setDayRegistro(null)
    setFecha(f => sumarDias(f, delta))
  }

  const handleNotaSaved = useCallback((interp: NoteInterpretationDto, mealId: number) => {
    setDayRegistro(prev => {
      if (!prev) return prev
      // Lo que no genera ítems guardados (no reconocido, o reconocido sin grupo:
      // libre, flexible, no cuenta) se muestra igual, sin opción de corregir.
      const sinItem: EntryItemDto[] = interp.items
        .filter(it => !it.recognized || TIPOS_SIN_ITEM.has(it.tipo))
        .map((it, i) => ({
          id: -(i + 1),
          food: it.foodName,
          quantity: it.quantity,
          unit: it.unit,
          foodGroupId: null,
          portions: null,
          origin: 'NOTA',
          uncertain: it.recognized && it.uncertain,
          appliedRule: it.recognized ? it.appliedRule : null,
        }))
      const updatedMeal: MealDayDto = {
        mealId,
        noteId: interp.noteId,
        noteVersion: interp.version,
        noteText: interp.text,
        items: [...interp.entries, ...sinItem],
        comparison: interp.comparison,
      }
      const exists = prev.meals.some(m => m.mealId === mealId)
      const meals = exists
        ? prev.meals.map(m => m.mealId === mealId ? updatedMeal : m)
        : [...prev.meals, updatedMeal]
      return { ...prev, meals }
    })
  }, [])

  const handleItemPatched = useCallback((mealId: number, result: PatchItemResultDto) => {
    setDayRegistro(prev => {
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
      getDayRegistro(token, fecha).then(setDayRegistro).catch(() => {})
    }
  }, [token, fecha])

  const handleRespuestaGuardada = useCallback((_mealId: number) => {
    if (!token) return
    getDayRegistro(token, fecha)
      .then(data => setDayRegistro(data))
      .catch(() => {})
  }, [token, fecha])

  const esHoy = fecha === HOY
  const nombre = firstName ?? formatNombre(email ?? undefined)
  const meals = plan?.meals.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? []
  const gruposMap = plan ? buildGruposMap(plan.foodGroups ?? []) : {}
  const ahoraIdx = esHoy && plan ? findIndexAhora(meals, ahora) : -1
  const { total, done, porGrupo } = calcResumenDeDay(dayRegistro, meals, gruposMap)

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
            {diaError && (
              <p className="hoy-intake-error">
                No se pudo cargar el registro del día.{' '}
                <button
                  className="hoy-intake-error__retry"
                  onClick={() => setDiaRetry(n => n + 1)}
                  type="button"
                >
                  Reintentar
                </button>
              </p>
            )}

            {total > 0 && (
              <div className="hoy-resumen">
                <div className="hoy-resumen__porciones">
                  <span className="hoy-resumen__num">{fmt(done)}</span>
                  <span className="hoy-resumen__sep"> de </span>
                  <span className="hoy-resumen__total">{fmt(total)}</span>
                  <span className="hoy-resumen__label">porciones</span>
                </div>
                <div className="hoy-resumen__grupos">
                  {Object.entries(porGrupo).map(([idStr, { total: t, done: d, info }]) => {
                    const id = Number(idStr)
                    const pct = Math.min(100, Math.round((d / t) * 100))
                    const circ = 2 * Math.PI * 15
                    return (
                      <Fragment key={id}>
                        <div className="hoy-grupo-prog" title={info.name}>
                          <span className="hoy-grupo-prog__nombre">{info.name}</span>
                          <div className="hoy-grupo-prog__bar">
                            <div
                              className="hoy-grupo-prog__fill"
                              style={{ width: `${pct}%`, background: info.token }}
                            />
                          </div>
                          <span className="hoy-grupo-prog__frac">{fmt(d)}/{fmt(t)}</span>
                        </div>
                        <div
                          className="hoy-anillo"
                          role="img"
                          aria-label={`${info.name}: ${fmt(d)} de ${fmt(t)}`}
                        >
                          <svg className="hoy-anillo__svg" viewBox="0 0 40 40" aria-hidden="true">
                            <circle className="hoy-anillo__pista" cx="20" cy="20" r="15" />
                            <circle
                              className="hoy-anillo__valor"
                              cx="20" cy="20" r="15"
                              style={{ stroke: info.token, opacity: pct > 0 ? 1 : 0 }}
                              strokeDasharray={`${(pct / 100) * circ} ${circ}`}
                            />
                          </svg>
                          <span className="hoy-anillo__frac" aria-hidden="true">{fmt(d)}/{fmt(t)}</span>
                          <span className="hoy-anillo__nombre" aria-hidden="true">{info.name}</span>
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
                const mealDay = dayRegistro?.meals.find(m => m.mealId === meal.id)
                const pasada = esHoy && !mealDay?.noteText && !esAhora && esPasada(meal.suggestedTime, ahora)

                return (
                  <div
                    key={i}
                    className={[
                      'comida-hoy',
                      esAhora && !mealDay?.noteText ? 'comida-hoy--ahora' : '',
                      mealDay?.noteText ? 'comida-hoy--anotada' : '',
                      pasada ? 'comida-hoy--pasada' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="comida-hoy__encabezado">
                      <div className="comida-hoy__nombre-wrap">
                        <span className="comida-hoy__nombre">{meal.name}</span>
                        {mealDay?.noteText && (
                          <svg className="comida-hoy__done-icon" viewBox="0 0 16 16" fill="none" aria-label="Anotada" width="14" height="14">
                            <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15"/>
                            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      {meal.suggestedTime && (
                        <div className={`comida-hoy__hora-wrap${esAhora && !mealDay?.noteText ? ' comida-hoy__hora-wrap--ahora' : ''}`}>
                          <span className="comida-hoy__hora">
                            {meal.suggestedTime.slice(0, 5)}
                          </span>
                        </div>
                      )}
                    </div>

                    {noVacias.length > 0 && (
                      <div className="comida-hoy__grupos">
                        {noVacias.map(p => {
                          const info = gruposMap[p.foodGroupId]
                          if (!info) return null
                          return (
                            <span key={p.foodGroupId} className={`grupo-badge grupo-badge--${info.cssKey}`}>
                              <span className="grupo-badge__numero">{fmt(Number(p.portions))}</span>
                              <span className="grupo-badge__label">{info.name}</span>
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {meal.id !== undefined && (
                      <NotaMealSection
                        key={fecha}
                        onReload={async () => {
                          const data = await getDayRegistro(token!, fecha)
                          setDayRegistro(data)
                        }}
                        meal={meal}
                        mealDay={mealDay}
                        date={fecha}
                        token={token!}
                        gruposMap={gruposMap}
                        isAhora={esAhora}
                        onNotaSaved={handleNotaSaved}
                        onItemPatched={handleItemPatched}
                        onRespuestaGuardada={handleRespuestaGuardada}
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
