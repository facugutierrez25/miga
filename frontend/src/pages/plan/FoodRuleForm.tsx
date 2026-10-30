import { useState } from 'react'
import type { FoodInput, FoodRule, PlanGroup, RuleType } from '../../api/planRules'
import CompoundComponentsField from './CompoundComponentsField'
const TYPES: [RuleType, string][] = [['NORMAL', 'Suma a un grupo'], ['COMPUESTO', 'Suma a varios grupos'], ['LIBRE', 'Se anota pero no suma'], ['FLEXIBLE', 'Cuenta como comida flexible'], ['NO_CUENTA', 'No suma ni cuenta']]
export default function FoodRuleForm({ groups, rule, onSave, onCancel }: { groups: PlanGroup[]; rule?: FoodRule; onSave: (input: FoodInput) => Promise<boolean>; onCancel: () => void }) {
  const [input, setInput] = useState<FoodInput>(rule ?? { alimento: '', sinonimos: [], tipo: 'NORMAL', groupUid: '', cantidadPorPorcion: null, unidad: null, porcionPorDefecto: 1, componentes: [], overridesRuleUid: null })
  const [synonyms, setSynonyms] = useState(rule?.sinonimos.join(', ') ?? '')
  const compoundValid = input.componentes.length >= 2 && new Set(input.componentes.map(c => c.groupUid)).size === input.componentes.length && input.componentes.every(c => c.groupUid && c.porciones > 0)
  const valid = input.alimento.trim() && (input.tipo !== 'COMPUESTO' || compoundValid) && (input.tipo !== 'NORMAL' || (input.groupUid && (!!input.cantidadPorPorcion === !!input.unidad)))
  return <form className="rules-card rules-form" onSubmit={async e => { e.preventDefault(); if (!valid) return; await onSave({ ...input, alimento: input.alimento.trim(), sinonimos: synonyms.split(',').map(s => s.trim()).filter(Boolean), groupUid: input.tipo === 'NORMAL' ? input.groupUid : null, cantidadPorPorcion: input.tipo === 'NORMAL' ? input.cantidadPorPorcion : null, unidad: input.tipo === 'NORMAL' ? input.unidad : null, componentes: input.tipo === 'COMPUESTO' ? input.componentes : [] }) }}>
    <h3>{rule ? 'Editar alimento' : 'Agregar alimento'}</h3>
    <label>Alimento<input required maxLength={200} value={input.alimento} onChange={e => setInput({ ...input, alimento: e.target.value })} /></label>
    <label>Sinónimos separados por comas<input value={synonyms} onChange={e => setSynonyms(e.target.value)} /></label>
    <fieldset><legend>Tipo de alimento</legend>{TYPES.map(([type, text]) => <label key={type}><input type="radio" name="foodType" checked={input.tipo === type} onChange={() => setInput({ ...input, tipo: type })} />{type} · {text}</label>)}</fieldset>
    {input.tipo === 'NORMAL' && <>
      <label>Grupo<select required value={input.groupUid ?? ''} onChange={e => setInput({ ...input, groupUid: e.target.value })}><option value="">Elegí un grupo</option>{groups.map(g => <option key={g.uid} value={g.uid}>{g.name}</option>)}</select></label>
      <label>Cantidad por porción<input type="number" min="0.01" step="any" value={input.cantidadPorPorcion ?? ''} onChange={e => setInput({ ...input, cantidadPorPorcion: e.target.value ? Number(e.target.value) : null })} /></label>
      <label>Unidad<select value={input.unidad ?? ''} onChange={e => setInput({ ...input, unidad: e.target.value || null })}><option value="">Sin unidad</option>{['g', 'ml', 'unidad', 'taza', 'cda', 'cdta', 'rebanada', 'lata'].map(u => <option key={u}>{u}</option>)}</select></label>
      <label>Porción por defecto<input type="number" required min="0.01" step="any" value={input.porcionPorDefecto ?? ''} onChange={e => setInput({ ...input, porcionPorDefecto: Number(e.target.value) })} /></label>
    </>}
    {input.tipo === 'COMPUESTO' && <><CompoundComponentsField groups={groups} value={input.componentes} onChange={componentes => setInput({ ...input, componentes })} foodName={input.alimento} />{!compoundValid && <p>Elegí al menos dos grupos distintos con porciones mayores a cero.</p>}</>}
    <div className="rules-row"><button type="submit" disabled={!valid}>Guardar alimento</button><button type="button" onClick={onCancel}>Cancelar</button></div>
  </form>
}
