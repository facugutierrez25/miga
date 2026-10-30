import { useState } from 'react'
import { createHabit, updateHabit, deleteHabit, type Habit, type HabitInput } from '../../api/planRules'
import type { EditorProps } from './GroupsEditor'
export default function HabitsEditor({ token, plan, mutate }: EditorProps) {
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  return <section aria-label="Hábitos"><h2>Hábitos</h2>{plan.habitos.map(habit => <article className="rules-card" key={habit.uid}><h3>{habit.name}</h3><p>{habit.goal ?? 'Sin meta'} {habit.unit} · {habit.period === 'DIA' ? 'Por día' : 'Por semana'}</p><div className="rules-row"><button type="button" onClick={() => setEditing(habit)}>Editar {habit.name}</button><button type="button" onClick={() => mutate(() => deleteHabit(token, habit.uid, plan.planVersion))}>Borrar {habit.name}</button></div></article>)}
    <button type="button" onClick={() => setEditing('new')}>Agregar hábito</button>
    {editing && <HabitForm key={editing === 'new' ? 'new' : editing.uid} habit={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSave={async input => { const body = { ...input, planVersion: plan.planVersion }; if (await mutate(() => editing === 'new' ? createHabit(token, body) : updateHabit(token, editing.uid, body))) setEditing(null) }} />}
  </section>
}
function HabitForm({ habit, onSave, onCancel }: { habit?: Habit; onSave: (input: HabitInput) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState<HabitInput>(habit ?? { name: '', habitType: 'CONTADOR', unit: null, goal: null, period: 'DIA', step: 1 })
  return <form className="rules-card rules-form" onSubmit={e => { e.preventDefault(); void onSave({ ...value, name: value.name.trim() }) }}>
    <label>Nombre del hábito<input required maxLength={100} value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} /></label>
    <label>Tipo<select value={value.habitType} onChange={e => setValue({ ...value, habitType: e.target.value as HabitInput['habitType'] })}><option value="CONTADOR">Contador</option><option value="SI_NO">Sí o no</option><option value="CANTIDAD">Cantidad</option></select></label>
    <label>Unidad<input maxLength={40} value={value.unit ?? ''} onChange={e => setValue({ ...value, unit: e.target.value || null })} /></label>
    <label>Meta<input type="number" min="0.01" step="any" value={value.goal ?? ''} onChange={e => setValue({ ...value, goal: e.target.value ? Number(e.target.value) : null })} /></label>
    <label>Período<select value={value.period} onChange={e => setValue({ ...value, period: e.target.value as HabitInput['period'] })}><option value="DIA">Por día</option><option value="SEMANA">Por semana</option></select></label>
    <label>Paso<input type="number" min="0.01" step="any" required value={value.step} onChange={e => setValue({ ...value, step: Number(e.target.value) })} /></label>
    <div className="rules-row"><button type="submit" disabled={!value.name.trim()}>Guardar hábito</button><button type="button" onClick={onCancel}>Cancelar</button></div>
  </form>
}
