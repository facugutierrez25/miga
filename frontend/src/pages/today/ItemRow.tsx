import { validGroupPortions } from '../../lib/groupPortions'
import {
  ItemOrigin,
  patchItem,
  type EntryItemDto,
  type PatchItemResultDto,
  type PatchItemRequest,
} from '../../api/records'
import { GroupPortionsEditor } from '../../components/GroupPortionsEditor'
import { type GroupInfo, fmt } from './helpers'
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
  const [portions, setPortions] = useState(item.portions ?? 1)
  const [portionsTouched, setPortionsTouched] = useState(false)
  const [saveAsRule, setSaveAsRule] = useState(false)
  const [splitRows, setSplitRows] = useState<{ foodGroupId: string; portions: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const info = item.foodGroupId !== null ? groupsMap[item.foodGroupId] : null
  const editable = item.id > 0 && !([ItemOrigin.MENTION, ItemOrigin.UNKNOWN] as readonly string[]).includes(item.origin ?? '')

  const removable = !!onRemove && item.id > 0 && item.origin !== ItemOrigin.ANSWER
  const minimumPortions = removable ? 0 : 0.5
  const busy = saving || !!removing

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

  function saveCorrection() {
    if (portions === 0 && removable) {
      onRemove?.()
      return
    }
    submit({ ...(portionsTouched && item.foodGroupId !== null ? { portions } : {}), saveAsRule })
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
        <div className="nota-item__contenido">
          <strong className="nota-item__food">{item.food}</strong>
          {item.uncertain && <> <span className="understood-tag tag">cantidad estimada</span></>}
          <p className="nota-item__regla">
            {item.portions !== null && <>{fmt(item.portions)} {item.portions === 1 ? 'porción' : 'porciones'}{label && ` de ${label}`} · </>}
            {item.appliedRule ? readableRule(item.appliedRule) : 'Sin regla: queda anotado para tu nutri.'}
          </p>
        </div>
      {editing && !splitting && (
        <span className="understood-correction fin">
          {item.foodGroupId !== null && <>
          <button type="button" className="paso" autoFocus aria-label={`Menos porciones de ${item.food}`} disabled={busy || portions <= minimumPortions} onClick={() => { setPortions(value => Math.max(minimumPortions, value - 0.5)); setPortionsTouched(true) }}>−</button>
          <b className="num" aria-label={`Porciones de ${item.food}`}>{fmt(portions)}</b>
          <button type="button" className="paso" aria-label={`Más porciones de ${item.food}`} disabled={saving} onClick={() => { setPortions(value => value + 0.5); setPortionsTouched(true) }}>+</button>
          </>}
          <button type="button" className="link" disabled={busy} onClick={saveCorrection}>Listo</button>
        </span>
      )}
        {!editing && <>
            {!editable && item.origin !== ItemOrigin.UNKNOWN && removable ? (
              <button type="button" className="nota-item__edit" disabled={busy} onClick={onRemove} aria-label={`Quitar ${item.food}`}>
                Quitar
              </button>
            ) : editable && (
              <button type="button" className="nota-item__edit" ref={editButtonRef} onClick={() => { setPortions(item.portions ?? 1); setPortionsTouched(false); setSaveAsRule(false); setSplitting(false); setEditing(true) }} aria-label={`Corregir ${item.food}`}>
                Corregir
              </button>
            )}
        </>}

      </div>
      {editing && <div className="nota-item__secondary">
        {(portions !== 0 || splitting) && <label className="resolve-remember"><input type="checkbox" checked={saveAsRule} disabled={saving} onChange={event => setSaveAsRule(event.target.checked)} />Usar siempre</label>}
        <button type="button" aria-expanded={splitting} disabled={saving} onClick={() => splitting ? setSplitting(false) : openSplit()}>Repartir en varios grupos</button>
        {item.foodGroupId === null && removable && <button type="button" className="link" disabled={busy} onClick={onRemove}>Quitar</button>}
      </div>}
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
