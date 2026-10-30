import { Fragment, useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import DictationButton from '../components/DictationButton'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import { useAhora } from '../hooks/useAhora'
import { type PlanFoodGroupDto, type MealDto } from '../api/plans'
import {
  NoteConflictError, saveNota, patchItem, saveRespuesta, getSugerencias,
  type DayRegistroDto, type MealDayDto, type EntryItemDto,
  type GroupStatusDto, type NoteInterpretationDto, type PatchItemResultDto, type PatchItemRequest,
} from '../api/registro'
import './HoyPage.css'
import { usePlan } from '../hooks/usePlan'
import { useDayRegistro } from '../hooks/useDayRegistro'

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
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  // Al cerrar la corrección, el foco vuelve al botón «Corregir» de este ítem.
  useEffect(() => {
    if (wasEditing.current && !editando) editButtonRef.current?.focus()
    wasEditing.current = editando
  }, [editando])
  const [repartiendo, setRepartiendo] = useState(false)
  const [qty, setQty] = useState(String(item.quantity ?? ''))
  const [reparto, setReparto] = useState<{ foodGroupId: string; porciones: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const info = item.foodGroupId !== null ? gruposMap[item.foodGroupId] : null
  const editable = item.id > 0 && !['MENTION', 'UNKNOWN'].includes(item.origin ?? '')

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
              autoFocus
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
              <button type="button" className="nota-item__edit" ref={editButtonRef} onClick={() => setEditando(true)} aria-label={`Corregir ${item.food}`}>
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
  onReload: () => Promise<DayRegistroDto>
  onRespuestaGuardada: (mealId: number) => void
}

function NotaMealSection({
  meal, mealDay, date, token, gruposMap, isAhora,
  onNotaSaved, onItemPatched, onRespuestaGuardada, onReload,
}: NotaMealSectionProps) {
  const [isOpen, setIsOpen] = useState(isAhora)
  const [texto, setTexto] = useState(mealDay?.noteText ?? '')
  const dirty = useRef(false)
  const draftRevision = useRef(0)
  // Versión de la nota sobre la que se empezó el borrador: una recarga automática
  // no la cambia, así guardar un borrador viejo sigue dando conflicto.
  const baseVersion = useRef<number | null>(mealDay?.noteVersion ?? null)
  const [conflict, setConflict] = useState(false)
  const [sugerencias, setSugerencias] = useState<string[]>([])
  const [cargandoSug, setCargandoSug] = useState(true)
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
    }
  }, [mealDay?.noteText, mealDay?.noteVersion])

  useEffect(() => {
    if (!isOpen || !meal.id) return
    const controller = new AbortController()
    getSugerencias(token, meal.id!, controller.signal)
      .then(s => { if (!controller.signal.aborted) setSugerencias(s) })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setCargandoSug(false) })
    return () => controller.abort()
  }, [isOpen, meal.id, token])

  const saveInFlight = useRef(false)
  // Cada edición del borrador (teclado o dictado) sube la revisión: si cambia mientras se
  // guarda, el borrador sigue marcado como modificado y la respuesta no lo reemplaza.
  function editarBorrador(update: (current: string) => string) {
    dirty.current = true
    draftRevision.current += 1
    setTexto(update)
  }

  async function handleGuardar(value = texto) {
    if (!meal.id || !value.trim() || saveInFlight.current || conflict) return
    saveInFlight.current = true
    dirty.current = true
    const revisionEnviada = draftRevision.current
    setTexto(value)
    setGuardando(true)
    setError(null)
    try {
      const interp = await saveNota(token, date, meal.id, value.trim(), baseVersion.current)
      dirty.current = draftRevision.current !== revisionEnviada
      baseVersion.current = interp.version
      setConflict(false)
      onNotaSaved(interp, meal.id)
    } catch (err) {
      setConflict(err instanceof NoteConflictError)
      setError(err instanceof NoteConflictError ? err.message : 'No se pudo guardar. Intentá de nuevo.')
    } finally {
      saveInFlight.current = false
      setGuardando(false)
    }
  }

  async function handleRespuesta(foodGroupId: number, consumed: boolean) {
    if (!meal.id) return
    try {
      await saveRespuesta(token, date, meal.id, { foodGroupId, consumed })
      onRespuestaGuardada(meal.id)
    } catch {
      setError('No se pudo guardar la respuesta. Intentá de nuevo.')
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
                  disabled={guardando || conflict}
                  onClick={() => void handleGuardar(s)}
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
            onChange={e => { const value = e.target.value; editarBorrador(() => value) }}
            rows={3}
            aria-label="Nota de la comida"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `nota-error-${meal.id}` : undefined}
          />

          <DictationButton disabled={guardando} onTranscript={transcript => {
            editarBorrador(current => current.trim() ? `${current.trimEnd()} ${transcript}` : transcript)
          }} />
          {error && <p id={`nota-error-${meal.id}`} className="nota-error" role="alert">{error}</p>}
          {conflict && (
            <button type="button" className="nota-btn-recargar" disabled={guardando}
              onClick={async () => {
                setGuardando(true)
                try {
                  // Recargar desde el aviso es aceptar la versión actual como base del borrador.
                  const day = await onReload()
                  baseVersion.current = day.meals.find(m => m.mealId === meal.id)?.noteVersion ?? null
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
            onClick={() => void handleGuardar()}
            disabled={guardando || conflict || !texto.trim()}
          >
            {guardando ? 'Guardando…' : hasNote ? 'Guardar cambios' : 'Guardar'}
          </button>

          {items.length > 0 && (
            <section className="nota-entendido" aria-labelledby={`entendido-${meal.id}`}>
              <h3 id={`entendido-${meal.id}`} className="nota-entendido__titulo">Así lo entendí</h3>
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
  const { token, email } = useAuth()
  return <HoyContent key={JSON.stringify([email, token])} />
}

function HoyContent() {
  useTitle('Hoy | Miga')
  const ahora = useAhora()
  const HOY = toISO(ahora)
  const { token, email, firstName } = useAuth()
  const [fecha, setFecha] = useState(HOY)
  const planLoad = usePlan(token, email)
  const plan = planLoad.data
  const sinPlan = planLoad.status === 'empty' && !plan
  const { data: dayRegistro, setData: setDayRegistro, status: dayStatus, retry: retryDay, reload: reloadDay } = useDayRegistro(token, email, fecha)
  const cargando = planLoad.status === 'loading' || (!!plan && dayStatus === 'loading' && !dayRegistro)
  const diaError = dayStatus === 'error'

  const [previousToday, setPreviousToday] = useState(HOY)
  if (previousToday !== HOY) {
    setPreviousToday(HOY)
    if (fecha === previousToday) setFecha(HOY)
  }

  function irDia(delta: number) {
    setFecha(f => sumarDias(f, delta))
  }

  const handleNotaSaved = useCallback((interp: NoteInterpretationDto, mealId: number) => {
    setDayRegistro(prev => {
      if (!prev) return prev
      const updatedMeal: MealDayDto = {
        mealId,
        noteId: interp.noteId,
        noteVersion: interp.version,
        noteText: interp.text,
        items: interp.entries,
        comparison: interp.comparison,
      }
      const exists = prev.meals.some(m => m.mealId === mealId)
      const meals = exists
        ? prev.meals.map(m => m.mealId === mealId ? updatedMeal : m)
        : [...prev.meals, updatedMeal]
      return { ...prev, meals }
    })
  }, [setDayRegistro])

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
      reloadDay().catch(() => {})
    }
  }, [token, reloadDay, setDayRegistro])

  const handleRespuestaGuardada = useCallback((_mealId: number) => {
    if (!token) return
    reloadDay()
      .catch(() => {})
  }, [token, reloadDay])

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
        ) : planLoad.status === 'error' ? (
          <p role="alert">No se pudo cargar el plan. <button onClick={planLoad.retry}>Reintentar</button></p>
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

            <p>Según tu plan{plan?.createdAt && ` · cargado el ${plan.createdAt.slice(8, 10)}/${plan.createdAt.slice(5, 7)}`}</p>
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
                        <h2 className="comida-hoy__nombre">{meal.name}</h2>
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
                        onReload={reloadDay}
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
