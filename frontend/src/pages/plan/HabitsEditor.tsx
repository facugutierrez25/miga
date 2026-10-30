import { useEditorFocus } from './useEditorFocus'
import { formatNumber } from './formatNumber'
import { useState, type FormEvent } from 'react'
import {
  createHabit,
  updateHabit,
  deleteHabit,
  type Habit,
  type HabitInput,
} from '../../api/planRules'
import type { EditorProps } from './GroupsEditor'

export default function HabitsEditor({ token, plan, mutate }: EditorProps) {
  const [confirm, setConfirm] = useState<string | null>(null)
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const { rememberTrigger, restoreFocus } = useEditorFocus()
  function openEditor(value: Habit | 'new') {
    rememberTrigger()
    setEditing(value)
  }
  function closeEditor() {
    setEditing(null)
    restoreFocus()
  }
  async function save(input: HabitInput) {
    if (!editing) return false
    const body = { ...input, planVersion: plan.planVersion }
    const next = await mutate(() =>
      editing === 'new' ? createHabit(token, body) : updateHabit(token, editing.uid, body)
    )
    if (next) closeEditor()
    return !!next
  }
  async function confirmDelete(uid: string) {
    if (await mutate(() => deleteHabit(token, uid, plan.planVersion))) setConfirm(null)
  }

  return (
    <section aria-label="Hábitos">
      <h2>Hábitos</h2>
      {plan.habitos.map((habit) => (
        <article className="rules-card" key={habit.uid}>
          <h3>{habit.name}</h3>
          <p>{habitSummary(habit)}</p>
          <div className="rules-row">
            <button
              type="button"
              aria-label={`Editar ${habit.name}`}
              onClick={() => openEditor(habit)}
            >
              Editar
            </button>
            <button
              type="button"
              aria-label={`Borrar ${habit.name}`}
              onClick={() => setConfirm(habit.uid)}
            >
              Borrar
            </button>
          </div>
          {editing !== 'new' && editing?.uid === habit.uid && (
            <HabitForm
              habit={editing}
              onCancel={closeEditor}
              onSave={async (input) => {
                await save(input)
              }}
            />
          )}
          {confirm === habit.uid && (
            <div>
              <p>¿Borrar {habit.name}?</p>
              <p>
                Si ya tiene registros, se archiva y deja de mostrarse; sus registros se conservan.
              </p>
              <button type="button" onClick={() => confirmDelete(habit.uid)}>
                Confirmar borrado
              </button>
              <button type="button" onClick={() => setConfirm(null)}>
                Cancelar
              </button>
            </div>
          )}
        </article>
      ))}
      <button type="button" onClick={() => openEditor('new')}>
        Agregar hábito
      </button>
      {editing === 'new' && (
        <HabitForm
          habit={editing === 'new' ? undefined : editing}
          onCancel={closeEditor}
          onSave={async (input) => {
            await save(input)
          }}
        />
      )}
    </section>
  )
}
function HabitForm({
  habit,
  onSave,
  onCancel,
}: {
  habit?: Habit
  onSave: (input: HabitInput) => Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState<HabitInput>(
    habit ?? { name: '', habitType: 'CONTADOR', unit: null, goal: null, period: 'DIA', step: 1 }
  )
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void onSave({ ...value, name: value.name.trim() })
  }

  return (
    <form className="rules-form" onSubmit={handleSubmit}>
      <label>
        Nombre del hábito
        <input
          autoFocus
          required
          maxLength={100}
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />
      </label>
      <label>
        Tipo
        <select
          value={value.habitType}
          onChange={(e) =>
            setValue({ ...value, habitType: e.target.value as HabitInput['habitType'] })
          }
        >
          <option value="CONTADOR">Contador</option>
          <option value="SI_NO">Sí o no</option>
          <option value="CANTIDAD">Cantidad</option>
        </select>
      </label>
      <label>
        Unidad
        <input
          maxLength={40}
          value={value.unit ?? ''}
          onChange={(e) => setValue({ ...value, unit: e.target.value || null })}
        />
      </label>
      <label>
        Meta
        <input
          type="number"
          min="0.01"
          step="any"
          value={value.goal ?? ''}
          onChange={(e) =>
            setValue({ ...value, goal: e.target.value ? Number(e.target.value) : null })
          }
        />
      </label>
      <label>
        Período
        <select
          value={value.period}
          onChange={(e) => setValue({ ...value, period: e.target.value as HabitInput['period'] })}
        >
          <option value="DIA">Por día</option>
          <option value="SEMANA">Por semana</option>
        </select>
      </label>
      <label>
        Paso
        <input
          type="number"
          min="0.01"
          step="any"
          required
          value={value.step}
          onChange={(e) => setValue({ ...value, step: Number(e.target.value) })}
        />
      </label>
      <div className="rules-row">
        <button type="submit" disabled={!value.name.trim()}>
          Guardar hábito
        </button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function habitSummary(habit: Habit) {
  const type = { CANTIDAD: 'Cantidad', CONTADOR: 'Contador', SI_NO: 'Sí o no' }[habit.habitType]
  const period = habit.period === 'DIA' ? 'por día' : 'por semana'
  if (habit.habitType === 'SI_NO') return `${type} · ${period}`
  if (habit.goal == null) return `${type} · Sin meta`
  return `${type} · ${formatNumber(habit.goal)}${habit.unit ? ` ${habit.unit}` : ''} ${period}`
}
