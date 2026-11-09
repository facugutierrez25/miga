import Skeleton, { LoadingSkeleton } from '../components/Skeleton'
import { mealStatus, type MealStateKind } from '../lib/mealStatus'
import { displayUnit } from '../lib/displayUnit'
import { groupColor } from '../groupColors'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import DictationButton from '../components/DictationButton'
import Brand from '../components/Brand'
import Migas from '../components/Migas'
import FichaComida from '../components/FichaComida'
import { type MigaRow } from '../components/migaSlots'
import { useTitle } from '../hooks/useTitle'
import { useDialogFocus } from './useDialogFocus'
import { reglaLegible } from './reglaLegible'
import { useAhora } from '../hooks/useAhora'
import { type PlanFoodGroupDto, type MealDto } from '../api/plans'
import {
  NoteConflictError, saveNota, deleteNota, removeItem, patchItem, saveRespuesta, getSugerencias, undoResolveItem,
  type DayRegistroDto, type DailySummaryDto, type MealDayDto, type EntryItemDto,
  type NoteInterpretationDto, type PatchItemResultDto, type PatchItemRequest, type ResolveUndoDto,
} from '../api/registro'
import './HoyPage.css'
import ResolveFoodStep from './ResolveFoodStep'
import TodayHabits from '../components/TodayHabits'
import { usePlan } from '../hooks/usePlan'
import { useDayRegistro } from '../hooks/useDayRegistro'

interface GrupoInfo {
  name: string
  token: string
}

function buildGruposMap(foodGroups: PlanFoodGroupDto[]): Record<number, GrupoInfo> {
  return Object.fromEntries(
    foodGroups.map((g, index) => [g.id, {
      name: g.name,
      token: groupColor(g, index),
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

function ActionsMenu({ label, actions, buttonRef, disabled = false }: {
  label: string
  actions: { label: string; onClick: () => void; disabled?: boolean }[]
  buttonRef?: React.RefObject<HTMLButtonElement | null>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const localRef = useRef<HTMLButtonElement>(null)
  const triggerRef = buttonRef ?? localRef
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [open])
  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }
  return <div className="nota-menu" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close() }
    if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
      buttons[next]?.focus()
    }
  }}>
    <button type="button" className="nota-menu__trigger" ref={triggerRef} aria-label={label}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      disabled={disabled} onClick={() => setOpen(value => !value)}>⋯</button>
    {open && <div className="nota-menu__items" ref={menuRef} id={menuId} role="menu" aria-label={label}>
      {actions.map(action => <button key={action.label} type="button" role="menuitem"
        // Safari (iPhone) no enfoca un botón al tocarlo: sin esto el menú se cierra por blur
        // antes del click y la opción elegida no hace nada.
        onMouseDown={event => event.preventDefault()}
        disabled={action.disabled} onClick={() => { close(); action.onClick() }}>{action.label}</button>)}
    </div>}
  </div>
}

function UnderstoodDialog({ open, onClose, headingRef, mealId, children, items, token, date, groups, onPatched }: {
  open: boolean; onClose: () => void; headingRef: React.RefObject<HTMLHeadingElement | null>
  mealId: number | undefined; children: React.ReactNode
  items: EntryItemDto[]; token: string; date: string; groups: Record<number, GrupoInfo>
  onPatched: (result: PatchItemResultDto) => void
}) {
  const [selected, setSelected] = useState<EntryItemDto | null>(null)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState('')
  const [undo, setUndo] = useState<ResolveUndoDto | null>(null)
  const [remembered, setRemembered] = useState(false)
  const [undoError, setUndoError] = useState(false)
  const returnId = useRef<number | null>(null)
  const buttons = useRef(new Map<number, HTMLButtonElement>())
  function back() { if (!saving) setSelected(null) }
  const dialogRef = useDialogFocus<HTMLDivElement>(() => { if (saving) return; if (selected) back(); else onClose() }, open)
  useEffect(() => {
    if (!open) { returnId.current = null; return }
    if (selected) headingRef.current?.focus()
    else if (returnId.current !== null) {
      const target = buttons.current.get(returnId.current) ?? headingRef.current
      target?.focus()
      returnId.current = null
    }
  }, [selected, headingRef, open])
  const unknown = items.filter(item => item.origin === 'UNKNOWN')
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
      setSelected(null)
      setBanner('')
      setUndo(null)
      setRemembered(false)
      setUndoError(false)
    }
  }, [open])

  // Se conserva el contenido al cerrar para no perder una corrección todavía sin guardar.
  return createPortal(
    <div className="regla-overlay entendido-overlay" hidden={!open} onClick={() => { if (!saving) onClose() }}>
      <div className="regla-dialog entendido-dialog" id={`entendido-dialog-${mealId}`}
        ref={dialogRef} role="dialog" aria-modal={open ? true : undefined}
        aria-labelledby={`entendido-${mealId}`} inert={!open}
        onClick={event => event.stopPropagation()}>
        <div className="regla-dialog__header">
          {selected && <button type="button" className="regla-dialog__close" aria-label="Volver a Así lo entendí" disabled={saving} onClick={back}>‹</button>}
          <h2 ref={headingRef} tabIndex={-1} id={`entendido-${mealId}`} className="regla-dialog__title">{selected ? `¿Qué es «${selected.originalText || selected.food}»?` : 'Así lo entendí'}</h2>
          <button type="button" className="regla-dialog__close" disabled={saving} onClick={onClose} aria-label="Cerrar Así lo entendí">✕</button>
        </div>
        {selected ? <ResolveFoodStep key={selected.id} item={selected} token={token} date={date} groups={groups}
          onBack={back} onSaving={setSaving} onResolved={(result, message, remember) => {
            onPatched(result); setUndo(result.undo); setBanner(message); setUndoError(false)
            if (remember) setRemembered(true)
            setSelected(null)
          }} /> : <>
          {banner && <div className="resolve-notice" role="status">{banner} {undo && <button type="button" disabled={saving} onClick={async () => {
            setSaving(true); setUndoError(false)
            try { onPatched(await undoResolveItem(token, date, undo)); setUndo(null); setBanner('Listo, quedó como antes.') }
            catch { setUndoError(true) }
            finally { setSaving(false) }
          }}>Deshacer</button>}</div>}
          {undoError && <p role="alert">No se pudo guardar. Probá de nuevo.</p>}
          {unknown.length > 0 && <section className="resolve-notice" aria-label="Sin reconocer">
            <h3>No reconocí {unknown.length} {unknown.length === 1 ? 'cosa' : 'cosas'}</h3>
            {unknown.map(item => <div className="resolve-unknown" key={item.id}>
              <span>«{item.originalText || item.food}»</span>
              <button type="button" className="resolve-primary" disabled={saving} ref={element => { if (element) buttons.current.set(item.id, element); else buttons.current.delete(item.id) }}
                aria-label={`Decime qué es «${item.originalText || item.food}»`} onClick={() => { returnId.current = item.id; setSelected(item) }}>Decime qué es</button>
            </div>)}
            <p>Mientras tanto no cuenta para tu plan. Si lo dejás así, queda anotado tal cual para tu nutri.</p>
          </section>}
          {children}
          {remembered && <p>Lo que resolviste queda en Mi plan → Tus alimentos. El plan de tu nutri no cambia.</p>}
        </>}
      </div>
    </div>, document.body,
  )
}

function ReglaDialog({ item, resultado, onClose }: {
  item: EntryItemDto; resultado: string | null; onClose: () => void
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose)
  const titleId = useId()
  const cantidad = item.quantity !== null ? ` · ${fmt(item.quantity)} ${displayUnit(item.unit, item.quantity)}`.trimEnd() : ''
  // Portal: las tarjetas de vidrio usan backdrop-filter, que encerraría un position: fixed.
  return createPortal(
    <div className="regla-overlay" onClick={onClose}>
      <div className="regla-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}>
        <div className="regla-dialog__header">
          <h2 id={titleId} className="regla-dialog__title">Cómo lo calculé</h2>
          <button type="button" className="regla-dialog__close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <p className="regla-dialog__item"><strong>{item.food}</strong>{cantidad}</p>
        {resultado && <p className="regla-dialog__resultado">= {resultado}</p>}
        <p className="regla-dialog__label">Regla usada</p>
        <p className="regla-dialog__regla">{reglaLegible(item.appliedRule ?? '')}</p>
        <p className="regla-dialog__ayuda">¿Tu plan dice otra cosa?</p>
        <Link className="regla-dialog__link" to="/mi-plan" state={{ tab: 'rules' }}>Ajustar en Mi plan</Link>
      </div>
    </div>,
    document.body,
  )
}

// Tipo de regla en palabras, a partir del texto que arma el intérprete.
function tipoDeRegla(item: EntryItemDto): string {
  const regla = item.appliedRule ?? ''
  if (item.origin === 'RESPUESTA') return 'Lo respondiste vos'
  if (!regla || item.origin === 'UNKNOWN' || item.origin === 'MENTION') return 'Sin regla'
  if (regla.includes('= no cuenta')) return 'No cuenta'
  if (regla.includes('= libre')) return 'Libre'
  if (regla.includes('= flexible')) return 'Comida flexible'
  if (regla.includes('compuesto')) return 'Compuesto'
  if (regla.includes('supuest')) return 'Cantidad supuesta'
  return 'Por porción'
}

// "Cómo lo calculé" de toda la comida: cada cosa escrita, el tipo de regla y el resultado.
function ReglasSheet({ items, gruposMap, onClose }: {
  items: EntryItemDto[]; gruposMap: Record<number, GrupoInfo>; onClose: () => void
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose)
  const titleId = useId()
  return createPortal(
    <div className="regla-overlay" onClick={onClose}>
      <div className="regla-dialog regla-dialog--lista" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}>
        <div className="regla-dialog__header">
          <h2 id={titleId} className="regla-dialog__title">Cómo lo calculé</h2>
          <button type="button" className="regla-dialog__close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <p className="regla-dialog__ayuda regla-dialog__ayuda--arriba">
          Cada cosa que escribiste y la regla que usé. Si algo no está bien, tocá Corregir en esa fila:
          la corrección queda como regla tuya en Mi plan y no cambia el plan de tu nutri.
        </p>
        <ul className="regla-lista">
          {agruparPorMencion(items).map(mencion => {
            const [primero] = mencion
            const cantidad = primero.quantity !== null ? ` · ${fmt(primero.quantity)} ${displayUnit(primero.unit, primero.quantity)}`.trimEnd() : ''
            const resultado = mencion
              .filter(item => item.portions !== null && item.foodGroupId !== null)
              .map(item => `${fmt(item.portions!)} ${item.portions === 1 ? 'porción' : 'porciones'} de ${gruposMap[item.foodGroupId!]?.name ?? 'un grupo del plan'}`)
              .join(' + ')
            return (
              <li key={primero.occurrenceId ?? primero.id} className="regla-lista__item">
                <p className="regla-lista__alimento"><strong>{primero.food}</strong>{cantidad}</p>
                <p className="regla-lista__tipo">{tipoDeRegla(primero)}{resultado && <> · {resultado}</>}</p>
                <p className="regla-lista__regla">
                  {primero.origin === 'UNKNOWN' ? 'No lo reconocí. Podés decirme qué es desde Así lo entendí.' : primero.appliedRule ? reglaLegible(primero.appliedRule) : 'No está en tu plan ni en el catálogo: queda anotado tal cual para tu nutri.'}
                </p>
              </li>
            )
          })}
        </ul>
        <Link className="regla-dialog__link" to="/mi-plan" state={{ tab: 'rules' }}>Ver todas las reglas en Mi plan</Link>
      </div>
    </div>,
    document.body,
  )
}

function ItemActions({ item, disabled, onRemove, resultado = null }: {
  item: EntryItemDto; disabled: boolean; onRemove?: () => void; resultado?: string | null
}) {
  const [showRule, setShowRule] = useState(false)
  return <>
    <ActionsMenu label={`Más opciones de ${item.food}`} actions={[
      ...(item.origin !== 'UNKNOWN' ? [{ label: 'Cómo lo calculé', disabled: !item.appliedRule, onClick: () => setShowRule(true) }] : []),
      ...(onRemove && item.id > 0 && item.origin !== 'RESPUESTA'
        ? [{ label: 'Quitar', disabled, onClick: onRemove }] : []),
    ]} />
    {showRule && <ReglaDialog item={item} resultado={resultado} onClose={() => setShowRule(false)} />}
  </>
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
  const label = info?.name?.trim() || (item.foodGroupId !== null ? 'Grupo del plan' : item.appliedRule ? null : 'Sin grupo en tu plan')

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
            <span className="nota-item__unit">{displayUnit(item.unit, Number(qty))}</span>
            <button type="button" className="nota-item__save" aria-label="Guardar cantidad"
              disabled={saving || !(Number(qty) > 0)}
              onClick={() => enviar({ quantity: Number(qty), unit: item.unit })}>✓</button>
            <button type="button" className="nota-item__cancel" aria-label="Cancelar"
              onClick={() => { setEditando(false); setRepartiendo(false); setQty(String(item.quantity ?? '')) }}>✕</button>
          </>
        ) : (
          <>
            {item.quantity !== null && (
              <span className="nota-item__qty">{item.quantity} {displayUnit(item.unit, item.quantity)}</span>
            )}
            {label && <span className="nota-item__grupo">{label}</span>}
            {item.portions !== null && (
              <span className="nota-item__porciones">{fmt(item.portions)} {displayUnit('p.', item.portions)}</span>
            )}
            {editable && (
              <button type="button" className="nota-item__edit" ref={editButtonRef} onClick={() => setEditando(true)} aria-label={`Corregir ${item.food}`}>
                Corregir
              </button>
            )}
          </>
        )}
        <ItemActions item={item} disabled={!!removing} onRemove={onRemove}
          resultado={item.portions !== null ? `${fmt(item.portions)} ${item.portions === 1 ? 'porción' : 'porciones'}${label ? ` de ${label}` : ''}` : null} />
      </div>
      {item.uncertain && <p className="nota-item__regla">cantidad estimada</p>}
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
  const { kind, label } = mealStatus(mealDay)
  return (
    <span className={`hoy-estado hoy-estado--${kind}`}>
      <MealStateIcon kind={kind} />
      {label}
    </span>
  )
}

// Migas de una comida: lo comido según la comparación, o el plan vacío si todavía no se anotó.
function mealMigas(meal: MealDto, mealDay: MealDayDto | undefined, gruposMap: Record<number, GrupoInfo>): MigaRow[] {
  const comparison = (mealDay?.noteText ? mealDay.comparison : []).filter(s => s.expected > 0)
  if (mealDay?.noteText) {
    return comparison.map(s => ({
      id: s.foodGroupId,
      name: s.name,
      color: gruposMap[s.foodGroupId]?.token ?? 'var(--muted)',
      done: Number(s.recorded),
      total: Number(s.expected),
      status: s.status,
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
  onRespuestaGuardada: (mealId: number) => Promise<void>
}

const NotaMealSection = memo(function NotaMealSection({
  meal, drafts, mealDay, date, token, gruposMap,
  onNotaSaved, onItemPatched, onNotaBorrada, onRespuestaGuardada, onReload,
}: NotaMealSectionProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [reglasOpen, setReglasOpen] = useState(false)
  const [expandedMentions, setExpandedMentions] = useState<Set<string>>(() => new Set())
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
  // Las respuestas guardadas se ocultan hasta que llega la comparación nueva, aunque falle la recarga.
  const [answered, setAnswered] = useState<{ source: unknown; groupIds: number[] }>({ source: null, groupIds: [] })
  const answeredGroups = answered.source === mealDay?.comparison ? answered.groupIds : []
  const answerPending = useRef(false)
  const [answerSaving, setAnswerSaving] = useState(false)
  const preguntas = comparison.filter(s => s.status === 'PREGUNTAR' && !answeredGroups.includes(s.foodGroupId))
  const understoodFoods = [...new Set(items.filter(item => item.origin !== 'UNKNOWN').map(item => item.food))]
  const understoodSummary = understoodFoods.slice(0, 3).join(', ')
    + (understoodFoods.length > 3 ? ' y otros alimentos' : '')
  const unknownCount = items.filter(item => item.origin === 'UNKNOWN').length
  const estimatedCount = items.filter(item => item.uncertain).length

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
      if (updated.items.length === 0) setDetailOpen(false)
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
      const estado = mealStatus({
        noteText: interp.text, comparison: interp.comparison,
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
    if (!meal.id || answerPending.current) return
    answerPending.current = true
    setAnswerSaving(true)
    setError(null)
    const source = mealDay?.comparison
    setAnswered({ source, groupIds: [...answeredGroups, foodGroupId] })
    try {
      await saveRespuesta(token, date, meal.id, { foodGroupId, consumed })
    } catch {
      setAnswered(prev => ({ ...prev, groupIds: prev.groupIds.filter(id => id !== foodGroupId) }))
      setError('No se pudo guardar la respuesta. Intentá de nuevo.')
      return
    } finally {
      answerPending.current = false
      setAnswerSaving(false)
    }
    await onRespuestaGuardada(meal.id).catch(() => {})
  }
  const feedback = (<>
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

  </>)

  const textareaId = `nota-${meal.id}`

  return (
    <div className="nota-body">
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

      {!cargandoSug && sugerencias.length > 0 && !hasNote && (
        <section className="nota-sugerencias" aria-labelledby={`sugerencias-${meal.id}`}>
          <h3 id={`sugerencias-${meal.id}`} className="nota-sugerencias__titulo">Lo de siempre</h3>
          {sugerencias.map((s, i) => (
            <button
              key={i}
              className="nota-sugerencia"
              type="button"
              aria-label={`Anotar: ${s}`}
              disabled={guardando || conflict}
              onClick={() => void handleGuardar(s)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              <span>{s}</span>
            </button>
          ))}
        </section>
      )}

      <div className="nota-acciones">
        <button
          className="nota-btn-guardar"
          onClick={() => void handleGuardar()}
          disabled={guardando || conflict || !texto.trim()}
        >
          {guardando ? 'Guardando…' : hasNote ? 'Guardar cambios' : 'Guardar'}
        </button>
        <DictationButton iconOnly disabled={guardando} onTranscript={transcript => {
          editarBorrador(current => current.trim() ? `${current.trimEnd()} ${transcript}` : transcript)
        }} />
        {hasNote && <ActionsMenu label={`Más opciones de ${meal.name}`} buttonRef={borrarRef} disabled={guardando}
          actions={[{ label: 'Borrar lo anotado', onClick: () => { setConfirmando(true); foco.current = 'confirmar' } }]} />}

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

      {!detailOpen && feedback}

      {preguntas.map(p => (
        <div key={p.foodGroupId} className="nota-pregunta">
          <span className="nota-pregunta__texto">
            ¿Consumiste <strong>{p.name}</strong>?
          </span>
          <div className="nota-pregunta__acciones">
            <button disabled={answerSaving} className="nota-pregunta__si" onClick={() => handleRespuesta(p.foodGroupId, true)}>Sí</button>
            <button disabled={answerSaving} className="nota-pregunta__no" onClick={() => handleRespuesta(p.foodGroupId, false)}>No</button>
          </div>
        </div>
      ))}

      {(hasNote || items.length > 0) && (
        <>
          <button type="button" className="nota-revisar" aria-haspopup="dialog"
            aria-expanded={detailOpen} aria-controls={`entendido-dialog-${meal.id}`}
            onClick={event => { event.currentTarget.focus(); setDetailOpen(true) }}>
            Así lo entendí{unknownCount > 0 && ` · ${unknownCount} sin reconocer`}{estimatedCount > 0 && ` · ${estimatedCount} estimados`}
          </button>
          <UnderstoodDialog open={detailOpen} onClose={() => setDetailOpen(false)}
            headingRef={understoodRef} mealId={meal.id} items={items} token={token} date={date} groups={gruposMap}
            onPatched={result => onItemPatched(meal.id!, result)}>
            <section className="nota-entendido" aria-labelledby={`entendido-${meal.id}`}>
              {detailOpen && feedback}
              <p className="nota-entendido__resumen">
                Entendí: {understoodSummary || 'sin alimentos reconocidos'}.
                {' '}{mealStatus(mealDay).text}.
              </p>
              <div className="nota-entendido__acciones">
                {items.some(item => item.appliedRule || item.origin === 'UNKNOWN') && (
                  <button type="button" className="nota-link" onClick={() => setReglasOpen(true)}>Cómo lo calculé</button>
                )}
              </div>
              {reglasOpen && <ReglasSheet items={items} gruposMap={gruposMap} onClose={() => setReglasOpen(false)} />}
              <ul className="nota-items">
                {items.filter(item => item.foodGroupId === null && item.origin !== 'UNKNOWN').map(item => <ItemRow
                  key={item.id} item={item} date={date} token={token} gruposMap={gruposMap}
                  onRemove={() => handleRemove(item)} removing={guardando || conflict}
                  onPatched={result => onItemPatched(meal.id!, result)} />)}
              </ul>
              <ul className="nota-items" id={`entendido-detalle-${meal.id}`}>
                {agruparPorMencion(items.filter(item => item.foodGroupId !== null && item.origin !== 'UNKNOWN')).map(mencion => {
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
                  const mentionKey = primero.occurrenceId!
                  const expanded = expandedMentions.has(mentionKey)
                  const detailId = `grupos-${meal.id}-${primero.id}`
                  return (
                    <li key={primero.occurrenceId} className="nota-compuesto">
                      <div className="nota-compuesto__header">
                        <span className="nota-compuesto__dots" aria-hidden="true">
                          {mencion.map(item => <span key={item.id} className="nota-item__dot"
                            style={{ background: (item.foodGroupId !== null ? gruposMap[item.foodGroupId]?.token : null) ?? 'var(--muted)' }} />)}
                        </span>
                        <div className="nota-compuesto__contenido">
                          <p className="nota-compuesto__titulo">
                            {primero.food}
                            {primero.quantity !== null && <> · {fmt(primero.quantity)} {displayUnit(primero.unit, primero.quantity)}</>}
                          </p>
                          <p className="nota-compuesto__grupos">{mencion.map(item =>
                            `${item.portions !== null ? fmt(item.portions) + ' ' : ''}${(item.foodGroupId !== null ? gruposMap[item.foodGroupId]?.name : null) || 'Grupo del plan'}`
                          ).join(' · ')}</p>
                        </div>
                        <button type="button" className="nota-item__edit" aria-label={`Corregir grupos de ${primero.food}`}
                          aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpandedMentions(previous => {
                            const next = new Set(previous)
                            if (next.has(mentionKey)) next.delete(mentionKey)
                            else next.add(mentionKey)
                            return next
                          })}>
                          Corregir
                        </button>
                        <ItemActions item={primero} disabled={guardando || conflict} onRemove={() => handleRemove(primero)}
                          resultado={mencion.map(item =>
                            `${item.portions !== null ? fmt(item.portions) + ' ' : ''}${(item.foodGroupId !== null ? gruposMap[item.foodGroupId]?.name : null) || 'Grupo del plan'}`
                          ).join(' + ')} />
                      </div>
                      <ul id={detailId} hidden={!expanded} className="nota-items" aria-label={`Grupos de ${primero.food}`}>
                        {mencion.map(item => fila(item))}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            </section>
          </UnderstoodDialog>
        </>
      )}
    </div>
  )
})

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
      ajustado.push({ foodGroupId, name: gruposMap[foodGroupId]?.name ?? '', clave: '', totalRecorded: value })
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
  onRespuestaGuardada: (mealId: number) => Promise<void>
}

const MealDetail = memo(function MealDetail(props: MealProps & { ficha?: boolean }) {
  const { meal, mealDay, fecha, token, gruposMap, ficha = false } = props
  const rows = mealMigas(meal, mealDay, gruposMap)
  return (
    <>
      {ficha && rows.length > 0
        ? <FichaComida nombre={meal.name} rows={rows} />
        : <Migas rows={rows} differencesOnly />}
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
})

const MealAhora = memo(function MealAhora(props: MealProps) {
  const { meal } = props
  const headingId = `comida-${meal.id ?? meal.name}`
  return (
    <article className="hoy-ahora" aria-labelledby={headingId}>
      <div className="hoy-ahora__head">
        <span className="hoy-ahora__etiqueta">Ahora</span>
        <h2 id={headingId} className="hoy-ahora__nombre">{meal.name}</h2>
        {meal.suggestedTime && <span className="hoy-ahora__hora">{meal.suggestedTime.slice(0, 5)}</span>}
      </div>
      <MealDetail {...props} ficha />
    </article>
  )
})

const MealRow = memo(function MealRow(props: MealProps) {
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
          aria-label={`${meal.name}${meal.suggestedTime ? `, ${meal.suggestedTime.slice(0, 5)}` : ''}: ${mealStatus(mealDay).text}`}
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
})

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
  const planLoad = usePlan(token, email, fecha)
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

  const handleRespuestaGuardada = useCallback(async (_mealId: number) => {
    if (!token) return
    await reloadDay()
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
  // Con la comida de ahora en el medio, lo anterior queda en "Antes" y lo que falta en "Después".
  const antesMeals = ahoraIdx >= 0 ? meals.slice(0, ahoraIdx) : []
  const despuesMeals = ahoraIdx >= 0 ? meals.slice(ahoraIdx + 1) : meals

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

  const reloadPlan = planLoad.reload
  const handleReload = useCallback(async () => {
    const [, day] = await Promise.all([reloadPlan(), reloadDay()])
    return day
  }, [reloadPlan, reloadDay])

  const mealProps = {
    drafts,
    fecha,
    token: token!,
    gruposMap,
    onNotaSaved: handleNotaSaved,
    onItemPatched: handleItemPatched,
    onNotaBorrada: handleNotaBorrada,
    // Un conflicto puede venir de un plan desactualizado: se recargan el plan y el día.
    onReload: handleReload,
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
        {cargando ? (
          <LoadingSkeleton label="Cargando tu día…">
            <Skeleton />
            <div className="loading-skeleton__card"><Skeleton /><Skeleton shape="block" /><Skeleton /></div>
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="loading-skeleton__row"><Skeleton /><Skeleton shape="block" /></div>)}
          </LoadingSkeleton>
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

            <TodayHabits key={fecha} date={fecha} revision={dayRegistro} />

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

            {[
              { key: 'despues', titulo: ahoraMeal ? 'Después' : 'Comidas', lista: despuesMeals },
              { key: 'antes', titulo: 'Antes', lista: antesMeals },
            ].filter(seccion => seccion.lista.length > 0).map(seccion => (
              <section key={seccion.key} className="hoy-resto" aria-labelledby={`hoy-${seccion.key}-titulo`}>
                <h2 id={`hoy-${seccion.key}-titulo`} className="hoy-resto__titulo">{seccion.titulo}</h2>
                <ul className="hoy-filas">
                  {seccion.lista.map(meal => (
                    <MealRow
                      key={`${fecha}-${meal.id ?? meal.name}`}
                      meal={meal}
                      mealDay={dayRegistro?.meals.find(m => m.mealId === meal.id)}
                      {...mealProps}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
