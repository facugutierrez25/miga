import { ItemOrigin, type EntryItemDto } from '../../api/registro'
import { type GroupInfo, fmt, groupByMention } from './helpers'
import { displayUnit } from '../../lib/displayUnit'
import { useId } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useDialogFocus } from '../useDialogFocus'
import { reglaLegible } from '../reglaLegible'

// Tipo de regla en palabras, a partir del texto que arma el intérprete.
function ruleTypeLabel(item: EntryItemDto): string {
  const rule = item.appliedRule ?? ''
  if (item.origin === ItemOrigin.RESPUESTA) return 'Lo respondiste vos'
  if (!rule || item.origin === ItemOrigin.UNKNOWN || item.origin === ItemOrigin.MENTION) return 'Sin regla'
  if (rule.includes('= no cuenta')) return 'No cuenta'
  if (rule.includes('= libre')) return 'Libre'
  if (rule.includes('= flexible')) return 'Comida flexible'
  if (rule.includes('compuesto')) return 'Compuesto'
  if (rule.includes('supuest')) return 'Cantidad supuesta'
  return 'Por porción'
}

// "Cómo lo calculé" de toda la comida: cada cosa escrita, el tipo de regla y el resultado.
export function ReglasSheet({ items, groupsMap, onClose }: {
  items: EntryItemDto[]; groupsMap: Record<number, GroupInfo>; onClose: () => void
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
          {groupByMention(items).map(mention => {
            const [first] = mention
            const quantityLabel = first.quantity !== null ? ` · ${fmt(first.quantity)} ${displayUnit(first.unit, first.quantity)}`.trimEnd() : ''
            const resultLabel = mention
              .filter(item => item.portions !== null && item.foodGroupId !== null)
              .map(item => `${fmt(item.portions!)} ${item.portions === 1 ? 'porción' : 'porciones'} de ${groupsMap[item.foodGroupId!]?.name ?? 'un grupo del plan'}`)
              .join(' + ')
            return (
              <li key={first.occurrenceId ?? first.id} className="regla-lista__item">
                <p className="regla-lista__alimento"><strong>{first.food}</strong>{quantityLabel}</p>
                <p className="regla-lista__tipo">{ruleTypeLabel(first)}{resultLabel && <> · {resultLabel}</>}</p>
                <p className="regla-lista__regla">
                  {first.origin === ItemOrigin.UNKNOWN ? 'No lo reconocí. Podés decirme qué es desde Así lo entendí.' : first.appliedRule ? reglaLegible(first.appliedRule) : 'No está en tu plan ni en el catálogo: queda anotado tal cual para tu nutri.'}
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

