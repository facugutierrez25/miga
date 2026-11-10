import BottomSheet from '../../components/BottomSheet'
import Segmented from '../../components/Segmented'
import Miga from '../../components/Miga'
import { HabitCrumbs } from '../../components/TodayHabits'
import { useDraftGuard } from './useDraftGuard'
import InlineDelete from './InlineDelete'
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

interface HabitErrorProps {
  error?: { code?: string; message: string } | null
  onReload?: () => void
}

export default function HabitsEditor({ token, plan, mutate, onDirtyChange, disabled, error, onReload }: EditorProps & HabitErrorProps) {
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
    if (await mutate(() => deleteHabit(token, uid, plan.planVersion))) {
      closeEditor()
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-add-habit]')?.focus())
    }
  }

  return (
    <section aria-label="Hábitos">
      {plan.habitos.length === 0 && <p>Todavía no tenés hábitos. Sirven para registrar acciones y metas de tu día o semana. Tocá Agregar hábito para crear uno.</p>}
      {plan.habitos.map((habit) => (
        <article className="rules-card" key={habit.uid}>
          <button type="button" className="rules-item" aria-label={`Editar ${habit.name}`} onClick={() => openEditor(habit)}><strong><Miga aspect="empty" /> {habit.name}</strong>
          <span className="rules-secondary">{habitSummary(habit)}</span><span className="rules-secondary">{habit.countsFlexibleMeals ? 'Se ve en Semana' : 'Se anota en Hoy'}</span></button>
          {editing !== 'new' && editing?.uid === habit.uid && (
            <HabitForm
              error={error}
              onReload={onReload}
              disabled={disabled}
              onDirtyChange={onDirtyChange}
              habit={editing}
              onCancel={closeEditor}
              deleteAction={<InlineDelete name={habit.name} onDelete={() => confirmDelete(habit.uid)} hint="Si ya tiene registros, se archiva y deja de mostrarse; sus registros se conservan." />}
              onSave={async (input) => {
                await save(input)
              }}
            />
          )}
        </article>
      ))}
      <button type="button" data-add-habit onClick={() => openEditor('new')}>
        Agregar hábito
      </button>
      {editing === 'new' && (
        <HabitForm
          error={error}
          onReload={onReload}
          disabled={disabled}
          onDirtyChange={onDirtyChange}
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
  disabled = false,
  error,
  onReload,
  onSave,
  onCancel,
  deleteAction,
  onDirtyChange,
}: HabitErrorProps & {
  habit?: Habit
  disabled?: boolean
  onSave: (input: HabitInput) => Promise<void>
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  deleteAction?: React.ReactNode
}) {
  const [value, setValue] = useState<HabitInput>(
    habit ?? { name: '', habitType: 'CONTADOR', unit: null, goal: null, period: 'DIA', step: 1 }
  )
  const [previewValue, setPreviewValue] = useState(0)
  const automatic = habit?.countsFlexibleMeals === true
  const yesNo = value.habitType === 'SI_NO'
  const draft = useDraftGuard(value, onDirtyChange, disabled)
  const conflict = error?.code === 'VERSION_CONFLICT'
  const cancel = () => conflict ? onCancel() : draft.cancel(onCancel)
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    void onSave(automatic ? { ...habit, goal: value.goal } : { ...value, name: value.name.trim(), ...(yesNo ? { goal: null, step: 1 } : {}) })
  }

  return (
    <BottomSheet title={habit ? `Editar ${habit.name}` : 'Agregar hábito'} onClose={cancel}>
    <div className="plan-rules">
    <form className="rules-form" onSubmit={handleSubmit} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); cancel() } }}>
      {error && <div role="alert" className="plan-error">
        <p>{error.message}</p>
        {conflict && <button type="button" onClick={onReload}>Recargar</button>}
      </div>}
      <fieldset className="rules-editor" disabled={disabled}>
      {automatic && <p>Se cuenta sola con las comidas que marcás como flexibles. Solo se cambia la meta.</p>}
      <fieldset disabled={automatic}>
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
        <input type="checkbox" checked={value.countsFlexibleMeals ?? false}
          onChange={e => setValue({ ...value, countsFlexibleMeals: e.target.checked })} />
        Cuenta comidas flexibles
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
      </fieldset>
      {!yesNo && <label>
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
      }
      <fieldset disabled={automatic}>
      <div>
        <span>Período</span>
        <Segmented label="Período" value={value.period}
          options={[{ value: 'DIA', label: 'Por día' }, { value: 'SEMANA', label: 'Por semana' }]}
          onChange={period => setValue({ ...value, period })} />
      </div>
      {!yesNo && <label>
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
      }
      </fieldset>
      {!automatic && <section aria-label="Vista previa en Hoy" aria-live="polite">
        <p>Así se va a ver en Hoy{!yesNo && value.goal != null && value.goal / value.step > 6 ? ': son más de 6 pasos, así que va con número y botones' : ''}.</p>
        <HabitCrumbs habit={{ ...value, id: habit?.id ?? 0, displayOrder: habit?.displayOrder ?? 0, dailyGoal: value.goal }}
          value={previewValue} onChange={setPreviewValue} />
      </section>}
      {draft.notice(onCancel)}
      {deleteAction}
      <div className="rules-row">
        <button type="submit" disabled={!value.name.trim()}>
          Guardar hábito
        </button>
      </div>
      </fieldset>
      <button type="button" disabled={disabled && !conflict} onClick={cancel}>
        Cancelar
      </button>
    </form>
    </div>
    </BottomSheet>
  )
}

function habitSummary(habit: Habit) {
  const period = habit.period === 'DIA' ? 'por día' : 'por semana'
  if (habit.habitType === 'SI_NO') return `Sí o no · ${period}`
  const unit = habit.unit ? ` ${habit.unit}` : ''
  const goal = habit.goal == null ? 'Sin meta' : `Meta ${formatNumber(habit.goal)}${unit}`
  return `${goal} · de a ${formatNumber(habit.step)}${unit} · ${period}${habit.countsFlexibleMeals ? ' · se cuenta sola' : ''}`
}
