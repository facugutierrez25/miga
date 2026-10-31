import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import DictationButton from '../components/DictationButton'
import Brand from '../components/Brand'
import Migas from '../components/Migas'
import { type MigaRow } from '../components/migaSlots'
import { useTitle } from '../hooks/useTitle'
import { useAhora } from '../hooks/useAhora'
import { type PlanFoodGroupDto, type MealDto } from '../api/plans'
import {
  NoteConflictError, saveNota, deleteNota, removeItem, patchItem, saveRespuesta, getSugerencias,
  type DayRegistroDto, type DailySummaryDto, type MealDayDto, type EntryItemDto,
  type GroupStatusDto, type NoteInterpretationDto, type PatchItemResultDto, type PatchItemRequest,
} from '../api/registro'
import './HoyPage.css'
import { usePlan } from '../hooks/usePlan'
import { useDayRegistro } from '../hooks/useDayRegistro'

const ABBR_DOT: Record<string, string> = {
  PRO: 'var(--g-prot)', CER: 'var(--g-cer)', FRU: 'var(--g-frut)',
  LAC: 'var(--g-lac)',  GRA: 'var(--g-gras)', VER: 'var(--g-verd)',
}

interface GrupoInfo {
  name: string
  token: string
}

function buildGruposMap(foodGroups: PlanFoodGroupDto[]): Record<number, GrupoInfo> {
  return Object.fromEntries(
    foodGroups.map(g => [g.id, {
      name: g.name,
      token: ABBR_DOT[g.abbreviation] ?? 'var(--g-prot)',
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

// ── ItemRow ───────────────────────────────────────────────────────────────

function RemoveItemButton({ item, disabled, onClick }: { item: EntryItemDto; disabled: boolean; onClick: () => void }) {
  if (item.id <= 0 || item.origin === 'RESPUESTA') return null
  return <button type="button" className="nota-item__edit" aria-label={`Quitar ${item.food}`}
    disabled={disabled} onClick={onClick}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
    </svg>
  </button>
}

interface ItemRowProps {
  item: EntryItemDto
  date: string
  token: string
  gruposMap: Record<number, GrupoInfo>
  onPatched: (result: PatchItemResultDto) => void
  onRemove?: () => void
  removing?: boolean
}

function ItemRow({ item, date, token, gruposMap, onPatched, onRemove, removing }: ItemRowProps) {
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
        {onRemove && <RemoveItemButton item={item} disabled={!!removing} onClick={onRemove} />}
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

// ── Estado de una comida en texto concreto ────────────────────────────────

type MealStateKind = 'ok' | 'warn' | 'ask' | 'noted' | 'none'

function describirGrupos(grupos: GroupStatusDto[], diff: (s: GroupStatusDto) => number): string {
  return grupos.map(s => `${s.name} ${fmt(diff(s))}`).join(', ')
}

function mealState(mealDay: MealDayDto | undefined): { kind: MealStateKind; text: string } {
  if (!mealDay?.noteText) return { kind: 'none', text: 'Sin anotar' }
  const comparison = mealDay.comparison
  if (comparison.some(s => s.status === 'PREGUNTAR')) return { kind: 'ask', text: 'Por confirmar' }
  if (comparison.length === 0) return { kind: 'noted', text: 'Anotada' }
  // El backend ya aplica el margen del plan: solo CASI y SIN_ANOTAR faltan, solo DE_MAS sobra.
  const faltan = comparison.filter(s => s.status === 'CASI' || s.status === 'SIN_ANOTAR')
  const sobran = comparison.filter(s => s.status === 'DE_MAS')
  const partes = [
    faltan.length > 0 ? `Faltó: ${describirGrupos(faltan, s => s.expected - s.recorded)}` : '',
    sobran.length > 0 ? `De más: ${describirGrupos(sobran, s => s.recorded - s.expected)}` : '',
  ].filter(Boolean)
  return partes.length > 0
    ? { kind: 'warn', text: partes.join(' · ') }
    : { kind: 'ok', text: 'Como el plan' }
}

function MealStateIcon({ kind }: { kind: MealStateKind }) {
  if (kind === 'ok') {
    return (
      <svg viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6" fill="currentColor" />
        <path d="M4.2 7.2l1.9 1.9 3.7-4.1" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'warn' || kind === 'ask') {
    return (
      <svg viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7 1.6a5.4 5.4 0 0 1 0 10.8z" fill="currentColor" />
      </svg>
    )
  }
  if (kind === 'noted') {
    return (
      <svg viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function MealState({ mealDay }: { mealDay: MealDayDto | undefined }) {
  const { kind, text } = mealState(mealDay)
  return (
    <span className={`hoy-estado hoy-estado--${kind}`}>
      <MealStateIcon kind={kind} />
      {text}
    </span>
  )
}

// Migas de una comida: lo comido según la comparación, o el plan vacío si todavía no se anotó.
function mealMigas(meal: MealDto, mealDay: MealDayDto | undefined, gruposMap: Record<number, GrupoInfo>): MigaRow[] {
  const comparison = (mealDay?.noteText ? mealDay.comparison : []).filter(s => s.expected > 0)
  if (comparison.length > 0) {
    return comparison.map(s => ({
      id: s.foodGroupId,
      name: s.name,
      color: gruposMap[s.foodGroupId]?.token ?? 'var(--muted)',
      done: Number(s.recorded),
      total: Number(s.expected),
    }))
  }
  return meal.portions
    .filter(p => p.portions > 0 && gruposMap[p.foodGroupId])
    .map(p => ({
      id: p.foodGroupId,
      name: gruposMap[p.foodGroupId].name,
      color: gruposMap[p.foodGroupId].token,
      done: 0,
      total: Number(p.portions),
    }))
}

// ── NotaMealSection ───────────────────────────────────────────────────────

// Borrador de una nota: vive fuera del editor para no perderse al cerrar una fila ni cuando
// la comida de ahora cambia de lugar.
interface Draft {
  texto: string
  baseVersion: number | null
  dirty: boolean
  conflict: boolean
}

type DraftStore = Map<string, Draft>

interface NotaMealSectionProps {
  meal: MealDto
  drafts: DraftStore
  mealDay: MealDayDto | undefined
  date: string
  token: string
  gruposMap: Record<number, GrupoInfo>
  onNotaSaved: (interp: NoteInterpretationDto, mealId: number) => void
  onItemPatched: (mealId: number, result: PatchItemResultDto) => void
  onNotaBorrada: (mealId: number, version: number | null) => void
  onReload: () => Promise<DayRegistroDto>
  onRespuestaGuardada: (mealId: number) => void
}

function NotaMealSection({
  meal, drafts, mealDay, date, token, gruposMap,
  onNotaSaved, onItemPatched, onNotaBorrada, onRespuestaGuardada, onReload,
}: NotaMealSectionProps) {
  const draftKey = `${date}-${meal.id}`
  const [saved] = useState(() => drafts.get(draftKey))
  const [texto, setTexto] = useState(saved?.dirty ? saved.texto : mealDay?.noteText ?? '')
  const dirty = useRef(saved?.dirty ?? false)
  const draftRevision = useRef(0)
  // Versión de la nota sobre la que se empezó el borrador: una recarga automática
  // no la cambia, así guardar un borrador viejo sigue dando conflicto.
  const baseVersion = useRef<number | null>(saved ? saved.baseVersion : mealDay?.noteVersion ?? null)
  const [conflict, setConflict] = useState(saved?.conflict ?? false)

  useEffect(() => {
    drafts.set(draftKey, { texto, baseVersion: baseVersion.current, dirty: dirty.current, conflict })
  })
  const [sugerencias, setSugerencias] = useState<string[]>([])
  const [cargandoSug, setCargandoSug] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [confirmando, setConfirmando] = useState(false)
  const borrarRef = useRef<HTMLButtonElement>(null)
  const confirmarRef = useRef<HTMLButtonElement>(null)
  const understoodRef = useRef<HTMLHeadingElement>(null)
  const foco = useRef<'confirmar' | 'borrar' | 'textarea' | 'understood' | null>(null)

  const hasNote = !!mealDay?.noteText
  const items = mealDay?.items ?? []
  const comparison = mealDay?.comparison ?? []
  const preguntas = comparison.filter(s => s.status === 'PREGUNTAR')

  useEffect(() => {
    if (!dirty.current) {
      setTexto(mealDay?.noteText ?? '')
      baseVersion.current = mealDay?.noteVersion ?? null
    }
  }, [mealDay?.noteText, mealDay?.noteVersion])

  useEffect(() => {
    if (!meal.id) return
    const controller = new AbortController()
    getSugerencias(token, meal.id!, controller.signal)
      .then(s => { if (!controller.signal.aborted) setSugerencias(s) })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setCargandoSug(false) })
    return () => controller.abort()
  }, [meal.id, token])

  const saveInFlight = useRef(false)
  // Cada edición del borrador (teclado o dictado) sube la revisión: si cambia mientras se
  // guarda, el borrador sigue marcado como modificado y la respuesta no lo reemplaza.
  function editarBorrador(update: (current: string) => string) {
    dirty.current = true
    draftRevision.current += 1
    setGuardado(null)
    setTexto(update)
  }

  // El foco se consume después de actualizar el DOM, sin efectos pendientes del render anterior.
  useLayoutEffect(() => {
    const destino = foco.current
    if (!destino) return
    foco.current = null
    if (destino === 'confirmar') confirmarRef.current?.focus()
    else if (destino === 'borrar') borrarRef.current?.focus()
    else if (destino === 'understood') understoodRef.current?.focus()
    else textareaRef.current?.focus()
  })

  async function handleRemove(item: EntryItemDto) {
    if (saveInFlight.current || conflict) return
    saveInFlight.current = true
    setGuardando(true)
    setError(null)
    setGuardado(null)
    try {
      const updated = await removeItem(token, date, item.id, baseVersion.current)
      baseVersion.current = updated.noteVersion
      if (!dirty.current) setTexto(updated.noteText ?? '')
      setConflict(false)
      foco.current = updated.items.length ? 'understood' : 'textarea'
      onNotaSaved({ noteId: updated.noteId!, version: updated.noteVersion!, text: updated.noteText ?? '',
        date, mealId: updated.mealId, items: [], entries: updated.items, comparison: updated.comparison }, updated.mealId)
      setGuardado(`Quitaste ${item.food}.`)
    } catch (err) {
      setConflict(err instanceof NoteConflictError)
      setError(err instanceof NoteConflictError ? err.message : 'No se pudo quitar. Intentá de nuevo.')
    } finally {
      saveInFlight.current = false
      setGuardando(false)
    }
  }

  async function handleBorrar() {
    if (!meal.id || saveInFlight.current) return
    saveInFlight.current = true
    setGuardando(true)
    setError(null)
    setGuardado(null)
    const revisionEnviada = draftRevision.current
    try {
      const version = await deleteNota(token, date, meal.id, baseVersion.current)
      baseVersion.current = version
      // Lo que se escribió mientras se borraba es un borrador nuevo y se conserva.
      if (draftRevision.current === revisionEnviada) {
        dirty.current = false
        draftRevision.current += 1
        setTexto('')
      }
      setConflict(false)
      setConfirmando(false)
      setGuardado(`Borraste lo anotado en ${meal.name}.`)
      foco.current = 'textarea'
      onNotaBorrada(meal.id, version)
    } catch (err) {
      setConfirmando(false)
      setConflict(err instanceof NoteConflictError)
      setError(err instanceof NoteConflictError ? err.message : 'No se pudo borrar. Intentá de nuevo.')
    } finally {
      saveInFlight.current = false
      setGuardando(false)
    }
  }

  async function handleGuardar(value = texto) {
    if (!meal.id || !value.trim() || saveInFlight.current || conflict) return
    saveInFlight.current = true
    dirty.current = true
    const revisionEnviada = draftRevision.current
    setTexto(value)
    setGuardando(true)
    setGuardado(null)
    setError(null)
    try {
      const interp = await saveNota(token, date, meal.id, value.trim(), baseVersion.current)
      dirty.current = draftRevision.current !== revisionEnviada
      baseVersion.current = interp.version
      setConflict(false)
      onNotaSaved(interp, meal.id)
      const estado = mealState({
        mealId: meal.id, noteId: interp.noteId, noteVersion: interp.version,
        noteText: interp.text, items: interp.entries, comparison: interp.comparison,
      })
      setGuardado(`Guardado. ${estado.text}.`)
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

  const textareaId = `nota-${meal.id}`

  return (
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

      <label className="nota-label" htmlFor={textareaId}>¿Qué comiste?</label>
      <textarea
        id={textareaId}
        ref={textareaRef}
        className="nota-textarea"
        maxLength={2000}
        placeholder="Por ejemplo: tarta de zapallitos y ensalada"
        value={texto}
        onChange={e => { const value = e.target.value; editarBorrador(() => value) }}
        rows={2}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `nota-error-${meal.id}` : undefined}
      />

      <div className="nota-acciones">
        <button
          className="nota-btn-guardar"
          onClick={() => void handleGuardar()}
          disabled={guardando || conflict || !texto.trim()}
        >
          {guardando ? 'Guardando…' : hasNote ? 'Guardar cambios' : 'Guardar'}
        </button>
        <DictationButton disabled={guardando} onTranscript={transcript => {
          editarBorrador(current => current.trim() ? `${current.trimEnd()} ${transcript}` : transcript)
        }} />
        {hasNote && !confirmando && (
          <button type="button" ref={borrarRef} className="nota-btn-borrar" disabled={guardando}
            onClick={() => { setConfirmando(true); foco.current = 'confirmar' }}>
            Borrar lo anotado
          </button>
        )}
      </div>

      {confirmando && (
        <div className="nota-confirmar" role="group" aria-labelledby={`confirmar-${meal.id}`}>
          <p id={`confirmar-${meal.id}`}>
            ¿Borrar todo lo anotado en {meal.name}? Se quita la nota y lo que sumó al día.
          </p>
          <div className="nota-confirmar__acciones">
            <button type="button" ref={confirmarRef} className="nota-btn-confirmar" disabled={guardando}
              onClick={() => void handleBorrar()}>
              Borrar
            </button>
            <button type="button" className="nota-btn-cancelar"
              onClick={() => { setConfirmando(false); foco.current = 'borrar' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <p className="nota-guardado" role="status">{guardado}</p>
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

      {items.length > 0 && (
        <section className="nota-entendido" aria-labelledby={`entendido-${meal.id}`}>
          <h3 ref={understoodRef} tabIndex={-1} id={`entendido-${meal.id}`} className="nota-entendido__titulo">Así lo entendí</h3>
          <ul className="nota-items">
            {agruparPorMencion(items).map(mencion => {
              const fila = (item: EntryItemDto) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onRemove={mencion.length === 1 ? () => handleRemove(item) : undefined}
                  removing={guardando || conflict}
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
                  <div className="nota-compuesto__header">
                    <p className="nota-compuesto__titulo">
                      {primero.food}
                      {primero.quantity !== null && <> · {primero.quantity} {primero.unit ?? ''}</>}
                    </p>
                    <RemoveItemButton item={primero} disabled={guardando || conflict} onClick={() => handleRemove(primero)} />
                  </div>
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
    </div>
  )
}

// ── Resumen diario ────────────────────────────────────────────────────────

function calcResumenDeDay(
  dayRegistro: DayRegistroDto | null,
  meals: MealDto[],
  gruposMap: Record<number, GrupoInfo>,
) {
  const totalById: Record<number, number> = {}
  const doneById: Record<number, number> = {}

  for (const meal of meals) {
    for (const p of meal.portions) {
      if (p.portions <= 0) continue
      totalById[p.foodGroupId] = (totalById[p.foodGroupId] ?? 0) + Number(p.portions)
    }
  }

  for (const s of dayRegistro?.summary ?? []) {
    doneById[s.foodGroupId] = Number(s.totalRecorded)
  }

  const total = Object.values(totalById).reduce((s, v) => s + v, 0)
  const done = Object.values(doneById).reduce((s, v) => s + v, 0)

  const porGrupo: MigaRow[] = []
  for (const [idStr, t] of Object.entries(totalById)) {
    const id = Number(idStr)
    const info = gruposMap[id]
    if (info) porGrupo.push({ id, name: info.name, color: info.token, done: doneById[id] ?? 0, total: t })
  }

  return { total, done, porGrupo }
}

// Al guardar una nota, el resumen del día suma la diferencia de porciones entre los ítems
// anteriores y los nuevos de esa comida, también de grupos que esa comida no tenía previstos.
function porcionesPorGrupo(items: EntryItemDto[]): Map<number, number> {
  const total = new Map<number, number>()
  for (const item of items) {
    if (item.foodGroupId === null || item.portions === null) continue
    total.set(item.foodGroupId, (total.get(item.foodGroupId) ?? 0) + Number(item.portions))
  }
  return total
}

function ajustarResumen(
  summary: DailySummaryDto[],
  antes: EntryItemDto[],
  despues: EntryItemDto[],
  gruposMap: Record<number, GrupoInfo>,
): DailySummaryDto[] {
  const delta = porcionesPorGrupo(despues)
  for (const [id, value] of porcionesPorGrupo(antes)) delta.set(id, (delta.get(id) ?? 0) - value)
  const ajustado = summary.map(s => {
    const d = delta.get(s.foodGroupId)
    return d ? { ...s, totalRecorded: Number(s.totalRecorded) + d } : s
  })
  for (const [foodGroupId, value] of delta) {
    if (value !== 0 && !summary.some(s => s.foodGroupId === foodGroupId)) {
      ajustado.push({ foodGroupId, name: gruposMap[foodGroupId]?.name ?? '', clave: '', totalRecorded: value, dailyGoal: null })
    }
  }
  return ajustado
}

// ── Comidas ───────────────────────────────────────────────────────────────

interface MealProps {
  meal: MealDto
  drafts: DraftStore
  mealDay: MealDayDto | undefined
  fecha: string
  token: string
  gruposMap: Record<number, GrupoInfo>
  onNotaSaved: (interp: NoteInterpretationDto, mealId: number) => void
  onItemPatched: (mealId: number, result: PatchItemResultDto) => void
  onNotaBorrada: (mealId: number, version: number | null) => void
  onReload: () => Promise<DayRegistroDto>
  onRespuestaGuardada: (mealId: number) => void
}

function MealDetail(props: MealProps) {
  const { meal, mealDay, fecha, token, gruposMap } = props
  return (
    <>
      <Migas rows={mealMigas(meal, mealDay, gruposMap)} />
      {meal.id !== undefined && (
        <NotaMealSection
          key={fecha}
          meal={meal}
          drafts={props.drafts}
          mealDay={mealDay}
          date={fecha}
          token={token}
          gruposMap={gruposMap}
          onNotaSaved={props.onNotaSaved}
          onItemPatched={props.onItemPatched}
          onNotaBorrada={props.onNotaBorrada}
          onReload={props.onReload}
          onRespuestaGuardada={props.onRespuestaGuardada}
        />
      )}
    </>
  )
}

function MealAhora(props: MealProps) {
  const { meal } = props
  const headingId = `comida-${meal.id ?? meal.name}`
  return (
    <article className="hoy-ahora" aria-labelledby={headingId}>
      <div className="hoy-ahora__head">
        <h2 id={headingId} className="hoy-ahora__nombre">{meal.name}</h2>
        <span className="hoy-ahora__etiqueta">Ahora</span>
        {meal.suggestedTime && <span className="hoy-ahora__hora">{meal.suggestedTime.slice(0, 5)}</span>}
      </div>
      <MealDetail {...props} />
    </article>
  )
}

function MealRow(props: MealProps) {
  const { meal, mealDay } = props
  const [abierta, setAbierta] = useState(false)
  const detalleId = `comida-detalle-${meal.id ?? meal.name}`
  return (
    <li className="hoy-fila">
      <h3 className="hoy-fila__titulo">
        <button
          type="button"
          className="hoy-fila__btn"
          aria-expanded={abierta}
          aria-controls={detalleId}
          onClick={() => setAbierta(a => !a)}
        >
          <span className="hoy-fila__nombre">{meal.name}</span>
          {meal.suggestedTime && <span className="hoy-fila__hora">{meal.suggestedTime.slice(0, 5)}</span>}
          <MealState mealDay={mealDay} />
          <svg className="hoy-fila__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h3>
      {abierta && (
        <div id={detalleId} className="hoy-fila__detalle">
          <MealDetail {...props} />
        </div>
      )}
    </li>
  )
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
  const [diaAbierto, setDiaAbierto] = useState<boolean | null>(null)
  const [drafts] = useState<DraftStore>(() => new Map())
  const gruposMap = useMemo(() => plan ? buildGruposMap(plan.foodGroups ?? []) : {}, [plan])

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
      const anterior = prev.meals.find(m => m.mealId === mealId)
      const meals = anterior
        ? prev.meals.map(m => m.mealId === mealId ? updatedMeal : m)
        : [...prev.meals, updatedMeal]
      return { ...prev, meals, summary: ajustarResumen(prev.summary, anterior?.items ?? [], interp.entries, gruposMap) }
    })
  }, [setDayRegistro, gruposMap])

  const handleNotaBorrada = useCallback((mealId: number, version: number | null) => {
    setDayRegistro(prev => {
      if (!prev) return prev
      const anterior = prev.meals.find(m => m.mealId === mealId)
      return {
        ...prev,
        meals: prev.meals.map(m => m.mealId === mealId ? { ...m, noteText: '', noteVersion: version, items: [], comparison: [] } : m),
        summary: ajustarResumen(prev.summary, anterior?.items ?? [], [], gruposMap),
      }
    })
  }, [setDayRegistro, gruposMap])

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
  const ahoraCalculada = esHoy && plan ? meals[findIndexAhora(meals, ahora)]?.id ?? null : null
  const [ahoraFija, setAhoraFija] = useState<{ fecha: string; id: number | null }>({ fecha, id: ahoraCalculada })
  const ahoraId = ahoraFija.fecha === fecha ? ahoraFija.id : ahoraCalculada
  // Al cambiar de día se actualiza siempre; dentro del día, la comida de ahora solo cambia
  // si no hay un borrador sin guardar, para no mover el editor mientras se escribe.
  if (ahoraFija.fecha !== fecha || (ahoraFija.id !== ahoraCalculada && (ahoraFija.id === null
    || ![...drafts.entries()].some(([key, d]) => key.startsWith(`${fecha}-`) && d.dirty)))) {
    setAhoraFija({ fecha, id: ahoraCalculada })
  }
  const ahoraIdx = ahoraId === null ? -1 : meals.findIndex(m => m.id === ahoraId)
  const { total, done, porGrupo } = calcResumenDeDay(dayRegistro, meals, gruposMap)
  const sinAnotar = !dayRegistro?.meals.some(m => m.noteText)
  const ahoraMeal = ahoraIdx >= 0 ? meals[ahoraIdx] : null
  const restoMeals = meals.filter((_, i) => i !== ahoraIdx)

  const titulo = esHoy ? (
    <>{nombre ? `${saludo(ahora)}, ${nombre}` : saludo(ahora)}<span className="punto-miga">.</span></>
  ) : formatFechaLarga(fecha)

  const navFecha = (
    <nav className="hoy-fecha-nav" aria-label="Navegación por fecha">
      <button
        className="hoy-fecha-nav__btn"
        onClick={() => irDia(-1)}
        aria-label="Día anterior"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <span className="hoy-fecha-nav__label">{labelFecha(fecha, HOY)}</span>
      <button
        className="hoy-fecha-nav__btn"
        onClick={() => irDia(1)}
        disabled={esHoy}
        aria-label="Día siguiente"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </nav>
  )

  const mealProps = {
    drafts,
    fecha,
    token: token!,
    gruposMap,
    onNotaSaved: handleNotaSaved,
    onItemPatched: handleItemPatched,
    onNotaBorrada: handleNotaBorrada,
    onReload: reloadDay,
    onRespuestaGuardada: handleRespuestaGuardada,
  }

  return (
    <div className="hoy-page">
      <header className="hoy-header">
        <div className="hoy-header__top">
          <Brand size={20} />
          {navFecha}
        </div>
        <h1 className="hoy-header__titulo">{titulo}</h1>
      </header>

      <div className="hoy-body">
        <div className="hoy-desktop-saludo">
          {navFecha}
          <h1 className="hoy-desktop-saludo__titulo">{titulo}</h1>
        </div>
        {plan?.createdAt && !sinPlan && !cargando && (
          <p className="hoy-plan-fecha">
            Según tu plan · cargado el {plan.createdAt.slice(8, 10)}/{plan.createdAt.slice(5, 7)}
          </p>
        )}

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

            {ahoraMeal && (
              <MealAhora
                key={`${fecha}-${ahoraMeal.id}`}
                meal={ahoraMeal}
                mealDay={dayRegistro?.meals.find(m => m.mealId === ahoraMeal.id)}
                {...mealProps}
              />
            )}

            {total > 0 && (
              <details
                className="hoy-dia"
                open={diaAbierto ?? (sinAnotar || !ahoraMeal)}
                onToggle={e => setDiaAbierto(e.currentTarget.open)}
              >
                <summary className="hoy-dia__summary">
                  <span className="hoy-dia__titulo">Tu día por grupo</span>
                  <span className="hoy-dia__total">{fmt(done)} de {fmt(total)} porciones</span>
                  <svg className="hoy-dia__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                {sinAnotar && esHoy && (
                  <p className="hoy-dia__explicacion">
                    Todavía no anotaste nada hoy. Cada porción de tu plan es una miga: se rellena
                    cuando la comés, y la media miga es media porción.
                  </p>
                )}
                <Migas rows={porGrupo} />
              </details>
            )}

            {restoMeals.length > 0 && (
              <section className="hoy-resto" aria-labelledby="hoy-resto-titulo">
                <h2 id="hoy-resto-titulo" className="hoy-resto__titulo">
                  {ahoraMeal ? 'Resto del día' : 'Comidas'}
                </h2>
                <ul className="hoy-filas">
                  {restoMeals.map(meal => (
                    <MealRow
                      key={`${fecha}-${meal.id ?? meal.name}`}
                      meal={meal}
                      mealDay={dayRegistro?.meals.find(m => m.mealId === meal.id)}
                      {...mealProps}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
