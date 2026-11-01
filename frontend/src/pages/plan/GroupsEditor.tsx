import { GROUP_PALETTE, groupColor, nextGroupColor } from '../../groupColors'
import type { MealDto } from '../../api/plans'
import { useEditorFocus } from './useEditorFocus'
import { formatNumber } from './formatNumber'
import { useState, type FormEvent } from 'react'
import * as api from '../../api/planRules'

export interface EditorProps {
  token: string
  plan: api.PlanRules
  mutate: (operation: () => Promise<api.PlanRules>) => Promise<api.PlanRules | null>
}
const KEY_LABELS = [
  'Proteínas',
  'Cereales y tubérculos',
  'Panificados',
  'Verduras',
  'Frutas',
  'Lácteos',
  'Huevos',
  'Aceites y grasas',
  'Dulces',
]
const KEYS = [
  'proteinas',
  'cereales_tuberculos',
  'panificados',
  'verduras',
  'frutas',
  'lacteos',
  'huevos',
  'aceites_grasas',
  'dulces',
]
export default function GroupsEditor({ token, plan, mutate, meals = [] }: EditorProps & { meals?: Pick<MealDto, 'portions'>[] }) {
  const [editing, setEditing] = useState<api.PlanGroup | 'new' | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const groupTotals: Record<number, number> = {}
  for (const meal of meals) {
    for (const portion of meal.portions) {
      groupTotals[portion.foodGroupId] = (groupTotals[portion.foodGroupId] ?? 0) + portion.portions
    }
  }
  const groups = [...plan.grupos].sort((a, b) => a.displayOrder - b.displayOrder)
  async function move(index: number, delta: number) {
    const uids = groups.map((g) => g.uid)
    ;[uids[index], uids[index + delta]] = [uids[index + delta], uids[index]]
    await mutate(() => api.reorderGroups(token, { planVersion: plan.planVersion, uids }))
  }
  const { rememberTrigger, restoreFocus } = useEditorFocus()
  function openEditor(value: api.PlanGroup | 'new') {
    rememberTrigger()
    setEditing(value)
  }
  function closeEditor() {
    setEditing(null)
    restoreFocus()
  }
  async function save(input: api.GroupInput) {
    if (!editing) return false
    const body = { ...input, planVersion: plan.planVersion }
    const next = await mutate(() =>
      editing === 'new' ? api.createGroup(token, body) : api.updateGroup(token, editing.uid, body)
    )
    if (next) closeEditor()
    return !!next
  }
  async function confirmDelete(uid: string) {
    if (await mutate(() => api.deleteGroup(token, uid, plan.planVersion))) setConfirm(null)
  }

  return (
    <section aria-label="Grupos">
      <h2>Grupos</h2>
      <ol className="rules-list">
        {groups.map((group, index) => (
          <li className="rules-card" key={group.uid}>
            <h3>
              <span className="rules-dot" style={{ background: groupColor(group, index) }} />
              {group.name}
            </h3>
            <p>
              {groupTotals[group.id] ? `Total del día: ${formatNumber(groupTotals[group.id])}` : 'No está en ninguna comida'}
            </p>
            <div className="rules-row">
              {group.preguntarSiFalta && <span className="rules-chip">Preguntar si falta</span>}
              {group.opcional && <span className="rules-chip">Opcional</span>}
            </div>
            <div className="rules-row">
              <button
                type="button"
                aria-label={`Subir ${group.name}`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rules-icon-button"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <polyline
                    points="6 14 12 8 18 14"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                aria-label={`Bajar ${group.name}`}
                disabled={index === groups.length - 1}
                onClick={() => move(index, 1)}
                className="rules-icon-button"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <polyline
                    points="6 10 12 16 18 10"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                aria-label={`Editar ${group.name}`}
                onClick={() => openEditor(group)}
              >
                Editar
              </button>
              <button
                type="button"
                aria-label={`Borrar ${group.name}`}
                onClick={() => setConfirm(group.uid)}
              >
                Borrar
              </button>
            </div>
            {confirm === group.uid && (
              <div>
                <p>¿Borrar {group.name}?</p>
                <button type="button" onClick={() => confirmDelete(group.uid)}>
                  Confirmar borrado
                </button>
                <button type="button" onClick={() => setConfirm(null)}>
                  Cancelar
                </button>
              </div>
            )}
            {editing !== 'new' && editing?.uid === group.uid && (
              <GroupForm
                group={editing}
                initialColor={GROUP_PALETTE[index % GROUP_PALETTE.length].hex}
                onCancel={closeEditor}
                onSave={async (input) => {
                  await save(input)
                }}
              />
            )}
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => openEditor('new')}>
        Agregar grupo
      </button>
      {editing === 'new' && (
        <GroupForm
          initialColor={nextGroupColor(groups)}
          onCancel={closeEditor}
          onSave={async (input) => {
            await save(input)
          }}
        />
      )}
    </section>
  )
}
function GroupForm({
  group,
  initialColor,
  onSave,
  onCancel,
}: {
  group?: api.PlanGroup
  initialColor: string
  onSave: (value: api.GroupInput) => Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState<api.GroupInput>(
    group ? { ...group, color: group.color ?? initialColor } : {
      name: '',
      color: initialColor,
      clave: null,
      preguntarSiFalta: false,
      opcional: false,
    }
  )
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void onSave({ ...value, name: value.name.trim() })
  }

  return (
    <form className="rules-form" onSubmit={handleSubmit}>
      <label>
        Nombre del grupo
        <input
          autoFocus
          required
          maxLength={60}
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />
      </label>
      <fieldset>
        <legend>Color</legend>
        <div className="rules-row">
          {GROUP_PALETTE.map(color => (
            <label key={color.hex}>
              <input type="radio" name="group-color" aria-label={color.name}
                value={color.hex} checked={value.color?.toLowerCase() === color.hex.toLowerCase()}
                onChange={() => setValue({ ...value, color: color.hex })} />
              <span className="rules-dot" style={{ background: groupColor({ color: color.hex }, 0) }} aria-hidden="true" />
              {color.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        <input
          type="checkbox"
          checked={value.preguntarSiFalta}
          onChange={(e) => setValue({ ...value, preguntarSiFalta: e.target.checked })}
        />
        Preguntar si falta
      </label>
      <label>
        <input
          type="checkbox"
          checked={value.opcional}
          onChange={(e) => setValue({ ...value, opcional: e.target.checked })}
        />
        Opcional
      </label>
      <label>
        Clave estándar
        <select
          value={value.clave ?? ''}
          onChange={(e) => setValue({ ...value, clave: e.target.value || null })}
        >
          <option value="">Ninguna</option>
          {KEYS.map((key, index) => (
            <option key={key} value={key}>
              {KEY_LABELS[index]}
            </option>
          ))}
        </select>
      </label>
      <div className="rules-row">
        <button type="submit" disabled={!value.name.trim()}>
          Guardar grupo
        </button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
