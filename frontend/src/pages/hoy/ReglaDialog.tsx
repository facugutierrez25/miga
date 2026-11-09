import { fmt } from './helpers'
import { displayUnit } from '../../lib/displayUnit'
import { useId } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useDialogFocus } from '../useDialogFocus'
import { reglaLegible } from '../reglaLegible'
import { type EntryItemDto } from '../../api/registro'

export function ReglaDialog({ item, resultLabel, onClose }: {
  item: EntryItemDto; resultLabel: string | null; onClose: () => void
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose)
  const titleId = useId()
  const quantityLabel = item.quantity !== null ? ` · ${fmt(item.quantity)} ${displayUnit(item.unit, item.quantity)}`.trimEnd() : ''
  // Portal: las tarjetas de vidrio usan backdrop-filter, que encerraría un position: fixed.
  return createPortal(
    <div className="regla-overlay" onClick={onClose}>
      <div className="regla-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}>
        <div className="regla-dialog__header">
          <h2 id={titleId} className="regla-dialog__title">Cómo lo calculé</h2>
          <button type="button" className="regla-dialog__close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <p className="regla-dialog__item"><strong>{item.food}</strong>{quantityLabel}</p>
        {resultLabel && <p className="regla-dialog__resultado">= {resultLabel}</p>}
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
