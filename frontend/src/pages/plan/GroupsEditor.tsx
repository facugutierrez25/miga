import { useState } from 'react'
import * as api from '../../api/planRules'
export interface EditorProps { token: string; plan: api.PlanRules; mutate: (operation: () => Promise<api.PlanRules>) => Promise<api.PlanRules | null> }
const KEYS = ['proteinas', 'cereales_tuberculos', 'panificados', 'verduras', 'frutas', 'lacteos', 'huevos', 'aceites_grasas', 'dulces']
export default function GroupsEditor({ token, plan, mutate }: EditorProps) {
  const [editing, setEditing] = useState<api.PlanGroup | 'new' | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const groups = [...plan.grupos].sort((a, b) => a.displayOrder - b.displayOrder)
  async function move(index: number, delta: number) {
    const uids = groups.map(g => g.uid)
    ;[uids[index], uids[index + delta]] = [uids[index + delta], uids[index]]
    await mutate(() => api.reorderGroups(token, { planVersion: plan.planVersion, uids }))
  }
  return <section aria-label="Grupos"><h2>Grupos</h2><ol className="rules-list">{groups.map((group, index) => <li className="rules-card" key={group.uid}>
    <h3><span className="rules-dot" style={{ background: group.color ?? 'var(--primary)' }} />{group.name}</h3>
    <p>Meta diaria: {group.metaDiaria ?? 'Sin meta'}</p><div className="rules-row">{group.preguntarSiFalta && <span className="rules-chip">Preguntar si falta</span>}{group.opcional && <span className="rules-chip">Opcional</span>}</div>
    <div className="rules-row"><button type="button" aria-label={`Subir ${group.name}`} disabled={index === 0} onClick={() => move(index, -1)}>Subir</button><button type="button" aria-label={`Bajar ${group.name}`} disabled={index === groups.length - 1} onClick={() => move(index, 1)}>Bajar</button><button type="button" onClick={() => setEditing(group)}>Editar {group.name}</button><button type="button" onClick={() => setConfirm(group.uid)}>Borrar {group.name}</button></div>
    {confirm === group.uid && <div><p>¿Borrar {group.name}?</p><button type="button" onClick={async () => { if (await mutate(() => api.deleteGroup(token, group.uid, plan.planVersion))) setConfirm(null) }}>Confirmar borrado</button><button type="button" onClick={() => setConfirm(null)}>Cancelar</button></div>}
  </li>)}</ol><button type="button" onClick={() => setEditing('new')}>Agregar grupo</button>
  {editing && <GroupForm key={editing === 'new' ? 'new' : editing.uid} group={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSave={async input => { const body = { ...input, planVersion: plan.planVersion }; if (await mutate(() => editing === 'new' ? api.createGroup(token, body) : api.updateGroup(token, editing.uid, body))) setEditing(null) }} />}
  </section>
}
function GroupForm({ group, onSave, onCancel }: { group?: api.PlanGroup; onSave: (value: api.GroupInput) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState<api.GroupInput>(group ?? { name: '', color: '#0e6e6b', clave: null, metaDiaria: null, preguntarSiFalta: false, opcional: false })
  return <form className="rules-card rules-form" onSubmit={e => { e.preventDefault(); void onSave({ ...value, name: value.name.trim() }) }}>
    <label>Nombre del grupo<input required maxLength={60} value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} /></label>
    <label>Color<input type="color" value={value.color ?? '#0e6e6b'} onChange={e => setValue({ ...value, color: e.target.value })} /></label>
    <label>Meta diaria<input type="number" min="0" step="0.5" value={value.metaDiaria ?? ''} onChange={e => setValue({ ...value, metaDiaria: e.target.value ? Number(e.target.value) : null })} /></label>
    <label><input type="checkbox" checked={value.preguntarSiFalta} onChange={e => setValue({ ...value, preguntarSiFalta: e.target.checked })} />Preguntar si falta</label>
    <label><input type="checkbox" checked={value.opcional} onChange={e => setValue({ ...value, opcional: e.target.checked })} />Opcional</label>
    <label>Clave estándar<select value={value.clave ?? ''} onChange={e => setValue({ ...value, clave: e.target.value || null })}><option value="">Ninguna</option>{KEYS.map(key => <option key={key}>{key}</option>)}</select></label>
    <div className="rules-row"><button type="submit" disabled={!value.name.trim()}>Guardar grupo</button><button type="button" onClick={onCancel}>Cancelar</button></div>
  </form>
}
