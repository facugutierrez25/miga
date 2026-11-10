import { CompoundRows } from './CompoundRows'
import { ItemRow } from './ItemRow'
import {
  ItemOrigin,
  undoResolveItem,
  type EntryItemDto,
  type PatchItemResultDto,
  type ResolveUndoDto,
} from '../../api/records'
import { type GroupInfo } from './helpers'
import { Activity, useEffect, useRef, useState } from 'react'
import BottomSheet from '../../components/BottomSheet'
import { Link } from 'react-router-dom'
import ResolveFoodStep from './ResolveFoodStep'
import './UnderstoodSheet.css'

export function UnderstoodSheet({ open, onClose, headingRef, mealId, children, items, token, date, groups, onPatched, selected, onSelect }: {
  selected: EntryItemDto | null
  onSelect: (item: EntryItemDto | null) => void
  open: boolean; onClose: () => void; headingRef: React.RefObject<HTMLHeadingElement | null>
  mealId: number | undefined; children: React.ReactNode
  items: EntryItemDto[]; token: string; date: string; groups: Record<number, GroupInfo>
  onPatched: (result: PatchItemResultDto) => void
}) {
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState('')
  const [undo, setUndo] = useState<ResolveUndoDto | null>(null)
  const [remembered, setRemembered] = useState(false)
  const [undoError, setUndoError] = useState(false)
  const returnId = useRef<number | null>(null)
  const buttons = useRef(new Map<number, HTMLButtonElement>())
  function back() { if (!saving) onSelect(null) }
  useEffect(() => {
    if (!open) { returnId.current = null; return }
    if (selected) headingRef.current?.focus()
    else if (returnId.current !== null) {
      const target = buttons.current.get(returnId.current) ?? headingRef.current
      target?.focus()
      returnId.current = null
    }
  }, [selected, headingRef, open])
  const unknown = items.filter(item => item.origin === ItemOrigin.UNKNOWN)
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
      setBanner('')
      setUndo(null)
      setRemembered(false)
      setUndoError(false)
    }
  }, [open])

  return <Activity mode={open ? 'visible' : 'hidden'}><BottomSheet title={selected ? `¿Qué es «${selected.originalText || selected.food}»?` : 'Así lo entendí'}
    onClose={() => { if (!saving) { if (selected) back(); else onClose() } }}>
    <div className="understood-sheet" id={`entendido-dialog-${mealId}`} ref={node => {
        const title = node?.closest('.bottom-sheet')?.querySelector('h2') ?? null
        if (title) title.tabIndex = -1
        headingRef.current = title
      }}>
      {selected && <button type="button" disabled={saving} aria-label="Volver a Así lo entendí" onClick={back}>Volver</button>}
        {selected ? <ResolveFoodStep key={selected.id} item={selected} token={token} date={date} groups={groups}
          onBack={back} onSaving={setSaving} onResolved={(result, message, remember) => {
            onPatched(result); setUndo(result.undo); setBanner(message); setUndoError(false)
            if (remember) setRemembered(true)
            onSelect(null)
          }} /> : <>
          {banner && <div className="resolve-notice" role="status">{banner} {undo && <button type="button" disabled={saving} onClick={async () => {
            setSaving(true); setUndoError(false)
            try { onPatched(await undoResolveItem(token, date, undo)); setUndo(null); setBanner('Listo, quedó como antes.') }
            catch { setUndoError(true) }
            finally { setSaving(false) }
          }}>Deshacer</button>}</div>}
          {undoError && <p role="alert">No se pudo guardar. Probá de nuevo.</p>}
          <p className="muted sm">Cada cosa que escribiste, cómo la conté y con qué regla. Si corregís algo, vale para esta comida. Con «Usar siempre» queda como regla tuya en Mi plan: el plan de tu nutri no cambia.</p>
          {unknown.length > 0 && <ul className="lista nota-items">{unknown.map(item => <li key={item.id}>
            <i className="nota-item__dot" style={{ background: 'var(--muted)' }} aria-hidden="true" />
            <span className="nota-item__contenido"><strong>{item.food}</strong><br /><span className="muted sm">Sin reconocer: no cuenta hasta que me digas qué es</span></span>
            <button type="button" className="nota-mini" disabled={saving} ref={element => { if (element) buttons.current.set(item.id, element); else buttons.current.delete(item.id) }}
              aria-label={`Decime qué es «${item.originalText || item.food}»`} onClick={() => { returnId.current = item.id; onSelect(item) }}>Decime qué es</button>
          </li>)}</ul>}
          {children}
          <Link className="regla-dialog__link" to="/mi-plan" state={{ tab: 'rules' }}>Ver todas las reglas en Mi plan</Link>
          {remembered && <p>Lo que resolviste queda en Mi plan → Tus alimentos. El plan de tu nutri no cambia.</p>}
        </>}
    </div>
  </BottomSheet></Activity>
}

interface UnderstoodItemsProps {
  expandedMentions: Set<string>
  setExpandedMentions: React.Dispatch<React.SetStateAction<Set<string>>>
  meal: { id?: number }
  items: EntryItemDto[]
  date: string
  token: string
  groupsMap: Record<number, GroupInfo>
  detailOpen: boolean
  feedback: React.ReactNode
  saving: boolean
  conflict: boolean
  handleRemove: (item: EntryItemDto) => void
  onItemPatched: (mealId: number, result: PatchItemResultDto) => void
}

export function UnderstoodItems({ meal, items, date, token, groupsMap, detailOpen, feedback,
  saving, conflict, handleRemove, onItemPatched,
  expandedMentions, setExpandedMentions }: UnderstoodItemsProps) {
  return (
    <section className="nota-entendido" aria-label="Así lo entendí">
      {detailOpen && feedback}
      <ul className="nota-items">
        {items.filter(item => item.foodGroupId === null && item.origin !== ItemOrigin.UNKNOWN).map(item => <ItemRow
          key={item.id} item={item} date={date} token={token} groupsMap={groupsMap}
          onRemove={() => handleRemove(item)} removing={saving || conflict}
          onPatched={result => onItemPatched(meal.id!, result)} />)}
      </ul>
      <CompoundRows meal={meal} items={items} date={date} token={token} groupsMap={groupsMap}
        saving={saving} conflict={conflict} expandedMentions={expandedMentions}
        setExpandedMentions={setExpandedMentions} handleRemove={handleRemove} onItemPatched={onItemPatched} />
    </section>
  )
}
