import { useState } from 'react'
import { createFood, updateFood, deleteFood, type FoodRule } from '../../api/planRules'
import type { EditorProps } from './GroupsEditor'
import FoodRuleForm from './FoodRuleForm'
import CatalogSearch from './CatalogSearch'
export default function FoodRulesEditor(props: EditorProps) {
  const { token, plan, mutate } = props
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<FoodRule | 'new' | null>(null)
  return <section aria-label="Alimentos"><h2>Alimentos</h2><label>Buscar en tu plan<input value={query} onChange={e => setQuery(e.target.value)} /></label><button type="button" onClick={() => setEditing('new')}>Agregar alimento</button>
    {plan.alimentos.filter(rule => [rule.alimento, ...rule.sinonimos].some(s => s.toLocaleLowerCase().includes(query.toLocaleLowerCase()))).map(rule => <article className="rules-card" key={rule.uid}><h3>{rule.alimento}</h3><p>{rule.textoRegla}</p>{rule.alcance === 'USUARIO' && <div className="rules-row"><button type="button" onClick={() => setEditing(rule)}>Editar {rule.alimento}</button><button type="button" onClick={() => mutate(() => deleteFood(token, rule.uid, plan.planVersion))}>Borrar {rule.alimento}</button></div>}</article>)}
    {editing && <FoodRuleForm key={editing === 'new' ? 'new' : editing.uid} groups={plan.grupos} rule={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSave={async input => { const body = { ...input, planVersion: plan.planVersion }; const next = await mutate(() => editing === 'new' ? createFood(token, body) : updateFood(token, editing.uid, body)); if (next) setEditing(null); return !!next }} />}
    <CatalogSearch {...props} onAdjusted={setEditing} />
  </section>
}
