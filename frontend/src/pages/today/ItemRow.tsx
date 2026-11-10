import { validGroupPortions } from '../../lib/groupPortions'
import {
  ItemOrigin,
  patchItem,
  type EntryItemDto,
  type PatchItemResultDto,
  type PatchItemRequest,
} from '../../api/records'
import { GroupPortionsEditor } from '../../components/GroupPortionsEditor'
import { ItemActions } from './ItemActions'
import { type GroupInfo, fmt } from './helpers'
import { displayUnit } from '../../lib/displayUnit'
import { useEffect, useRef, useState } from 'react'
import { readableRule } from '../readableRule'

export interface ItemRowProps {
  item: EntryItemDto
  date: string
  token: string
  groupsMap: Record<number, GroupInfo>
  onPatched: (result: PatchItemResultDto) => void
  onRemove?: () => void
  removing?: boolean
}

export function ItemRow({ item, date, token, groupsMap, onPatched, onRemove, removing }: ItemRowProps) {
  const [editing, setEditing] = useState(false)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  // Al cerrar la corrección, el foco vuelve al botón «Corregir» de este ítem.
  useEffect(() => {
    if (wasEditing.current && !editing) editButtonRef.current?.focus()
    wasEditing.current = editing
  }, [editing])
  const [splitting, setSplitting] = useState(false)
  const [qty, setQty] = useState(String(item.quantity ?? ''))
  const [portions, setPortions] = useState(item.portions ?? 1)
  const [saveAsRule, setSaveAsRule] = useState(false)
  const [splitRows, setSplitRows] = useState<{ foodGroupId: string; portions: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const info = item.foodGroupId !== null ? groupsMap[item.foodGroupId] : null
  const editable = item.id > 0 && !([ItemOrigin.MENTION, ItemOrigin.UNKNOWN] as readonly string[]).includes(item.origin ?? '')

  async function submit(req: PatchItemRequest) {
    setSaving(true)
    setError(null)
    try {
      onPatched(await patchItem(token, date, item.id, req))
      setEditing(false)
      setSplitting(false)
    } catch {
      setError('No se pudo guardar la corrección.')
    } finally {
      setSaving(false)
    }
  }

  function openSplit() {
    const current = item.foodGroupId !== null ? String(item.foodGroupId) : ''
    setSplitRows([
      { foodGroupId: current, portions: String(item.portions ?? 1) },
      { foodGroupId: '', portions: '1' },
    ])
    setSplitting(true)
  }

  function saveSplit(saveAsRule: boolean) {
    submit({
      quantity: item.quantity,
      grupos: splitRows.map(r => ({ foodGroupId: Number(r.foodGroupId), porciones: Number(r.portions) })),
      saveAsRule,
    })
  }

  const validSplit = validGroupPortions(splitRows)

  const dot = info?.token ?? 'var(--muted)'
  const label = info?.name?.trim() || (item.foodGroupId !== null ? 'Grupo del plan' : item.appliedRule ? null : 'Sin grupo en tu plan')

  return (
    <li className={`nota-item${item.uncertain ? ' nota-item--dudoso' : ''}`}>
      <div className="nota-item__linea">
        <span className="nota-item__dot" style={{ background: dot }} aria-hidden="true" />
        <span className="nota-item__food">{item.food}</span>
        {editing ? (
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
              onClick={() => submit({ quantity: Number(qty), unit: item.unit, saveAsRule })}>✓</button>
            <button type="button" className="nota-item__cancel" aria-label="Cancelar"
              onClick={() => { setEditing(false); setSplitting(false); setQty(String(item.quantity ?? '')) }}>✕</button>
          </>
        ) : (
          <>
            {item.quantity !== null && (
              <span className="nota-item__qty">{item.quantity} {displayUnit(item.unit, item.quantity)}</span>
            )}
            {label && item.portions === null && <span className="nota-item__grupo">{label}</span>}
            {item.portions !== null && (
              <span className="nota-item__porciones">{fmt(item.portions)} {item.portions === 1 ? 'porción' : 'porciones'}{label && ` de ${label}`}</span>
            )}
            {editable && (
              <button type="button" className="nota-item__edit" ref={editButtonRef} onClick={() => { setPortions(item.portions ?? 1); setSaveAsRule(false); setEditing(true) }} aria-label={`Corregir ${item.food}`}>
                Corregir
              </button>
            )}
          </>
        )}
        <ItemActions item={item} disabled={!!removing} onRemove={onRemove}
          resultLabel={item.portions !== null ? `${fmt(item.portions)} ${item.portions === 1 ? 'porción' : 'porciones'}${label ? ` de ${label}` : ''}` : null} />
      </div>
      <p className="nota-item__regla">{item.appliedRule ? readableRule(item.appliedRule) : 'Sin regla: queda anotado para tu nutri.'}</p>
      {item.uncertain && <p className="nota-item__regla">cantidad estimada</p>}
      {editing && !splitting && item.foodGroupId !== null && (
        <div className="understood-correction">
          <button type="button" aria-label={`Menos porciones de ${item.food}`} disabled={saving || portions <= 0.5} onClick={() => setPortions(value => value - 0.5)}>−</button>
          <output aria-label={`Porciones de ${item.food}`}>{fmt(portions)}</output>
          <button type="button" aria-label={`Más porciones de ${item.food}`} disabled={saving} onClick={() => setPortions(value => value + 0.5)}>+</button>
          <button type="button" disabled={saving} onClick={() => submit({ portions, saveAsRule })}>Listo</button>
        </div>
      )}
      {editing && <label className="resolve-remember"><input type="checkbox" checked={saveAsRule} disabled={saving} onChange={event => setSaveAsRule(event.target.checked)} />Usar siempre</label>}
      {editing && !splitting && (
        <button type="button" className="nota-item__repartir" onClick={openSplit}>
          Repartir en varios grupos
        </button>
      )}
      {splitting && (
        <fieldset className="nota-reparto">
          <legend>Repartir {item.food} en grupos</legend>
          <GroupPortionsEditor groups={groupsMap} rows={splitRows} onChange={setSplitRows} variant="split" labels={{
            group: index => `Grupo ${index + 1}`, portions: index => `Porciones del grupo ${index + 1}`,
            remove: '✕', removeGroup: index => `Quitar grupo ${index + 1}`,
            add: '+ Agregar grupo', placeholder: 'Elegí un grupo',
          }} />
          <div className="nota-reparto__acciones">
            <button type="button" className="nota-reparto__principal" disabled={saving || !validSplit}
              onClick={() => saveSplit(saveAsRule)}>
              Guardar
            </button>
            <button type="button" onClick={() => setSplitting(false)}>Cancelar</button>
          </div>
        </fieldset>
      )}
      {error && <p className="nota-error" role="alert">{error}</p>}
    </li>
  )
}
