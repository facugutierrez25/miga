import type { Component, PlanGroup } from '../../api/planRules'
import { formatNumber } from './formatNumber'

interface Props {
  groups: PlanGroup[]
  value: Component[]
  onChange: (value: Component[]) => void
  foodName: string
}

export default function CompoundComponentsField({ groups, value, onChange, foodName }: Props) {
  return (
    <fieldset>
      <legend>Grupos del alimento</legend>

      {value.map((item, index) => (
        <div className="rules-row" key={index}>
          <label>
            Grupo {index + 1}
            <select
              value={item.groupUid}
              onChange={(e) =>
                onChange(
                  value.map((v, i) => (i === index ? { ...v, groupUid: e.target.value } : v))
                )
              }
            >
              <option value="">Elegí un grupo</option>
              {groups.map((g) => (
                <option key={g.uid} value={g.uid}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Porciones {index + 1}
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={item.porciones}
              onChange={(e) =>
                onChange(
                  value.map((v, i) =>
                    i === index ? { ...v, porciones: Number(e.target.value) } : v
                  )
                )
              }
            />
          </label>

          {value.length > 2 && (
            <button
              type="button"
              aria-label={`Quitar grupo ${index + 1}`}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              Quitar
            </button>
          )}
        </div>
      ))}

      <button type="button" onClick={() => onChange([...value, { groupUid: '', porciones: 1 }])}>
        + Agregar grupo
      </button>

      <p aria-live="polite">
        1 {foodName || 'alimento'} ={' '}
        {value
          .filter((v) => v.groupUid)
          .map(
            (v) =>
              `${formatNumber(v.porciones)} ${groups.find((g) => g.uid === v.groupUid)?.name ?? ''}`
          )
          .join(' + ')}
      </p>
    </fieldset>
  )
}
