import type { GroupPortionRow } from '../lib/groupPortions'

interface Props {
  groups: Record<number, { name: string }>
  rows: GroupPortionRow[]
  onChange: (rows: GroupPortionRow[]) => void
  variant: 'split' | 'resolve'
  portionButtons?: boolean
  labels: {
    group: (index: number) => string
    portions: (index: number) => string
    remove: string
    removeGroup: (index: number) => string
    add: string
    placeholder?: string
  }
}

export function GroupPortionsEditor({ groups, rows, onChange, variant, portionButtons = false, labels }: Props) {
  const resolving = variant === 'resolve'
  function update(index: number, patch: Partial<GroupPortionRow>) {
    onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  }
  return <>
    {rows.map((row, index) => <div className={resolving ? 'resolve-group' : 'nota-reparto__fila'} key={index}>
      <label>
        {resolving ? labels.group(index) : <span className="sr-only">{labels.group(index)}</span>}
        <select value={row.foodGroupId} onChange={event => update(index, { foodGroupId: event.target.value })}>
          {!resolving && <option value="">{labels.placeholder}</option>}
          {Object.entries(groups).map(([id, group]) => <option key={id} value={id}
            disabled={resolving ? rows.some((value, i) => i !== index && value.foodGroupId === id) : undefined}>{group.name}</option>)}
        </select>
      </label>
      {portionButtons && <button type="button" className="paso" aria-label={`Menos ${labels.portions(index).toLowerCase()}`}
        disabled={Number(row.portions) <= 0.5}
        onClick={() => update(index, { portions: String(Math.max(0.5, Number(row.portions) - 0.5)) })}>−</button>}
      <label>
        {resolving ? labels.portions(index) : <span className="sr-only">{labels.portions(index)}</span>}
        <input type="number" step="0.5" min="0.5" value={row.portions}
          onChange={event => update(index, { portions: event.target.value })} />
      </label>
      {portionButtons && <button type="button" className="paso" aria-label={`Más ${labels.portions(index).toLowerCase()}`}
        onClick={() => update(index, { portions: String(Number(row.portions) + 0.5) })}>+</button>}
      {rows.length > (resolving ? 1 : 2) && <button type="button" aria-label={labels.removeGroup(index)}
        onClick={() => onChange(rows.filter((_, i) => i !== index))}>{labels.remove}</button>}
    </div>)}
    <button type="button" disabled={resolving ? rows.length >= Math.min(10, Object.keys(groups).length) : undefined}
      onClick={() => onChange([...rows, {
        foodGroupId: resolving ? Object.keys(groups).find(id => !rows.some(row => row.foodGroupId === id)) || '' : '',
        portions: '1',
      }])}>{labels.add}</button>
  </>
}
