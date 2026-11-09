import {
  ItemOrigin,
  undoResolveItem,
  type EntryItemDto,
  type PatchItemResultDto,
  type ResolveUndoDto,
} from '../../api/records'
import { type GroupInfo } from './helpers'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDialogFocus } from '../useDialogFocus'
import ResolveFoodStep from './ResolveFoodStep'

export function UnderstoodDialog({ open, onClose, headingRef, mealId, children, items, token, date, groups, onPatched }: {
  open: boolean; onClose: () => void; headingRef: React.RefObject<HTMLHeadingElement | null>
  mealId: number | undefined; children: React.ReactNode
  items: EntryItemDto[]; token: string; date: string; groups: Record<number, GroupInfo>
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
  const unknown = items.filter(item => item.origin === ItemOrigin.UNKNOWN)
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

