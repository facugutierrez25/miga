import InlineDelete from './InlineDelete'
import { useEditorFocus } from './useEditorFocus'
import { useState } from 'react'
import {
  createFood,
  adjustFromCatalog,
  updateFood,
  deleteFood,
  type FoodRule,
  type FoodInput,
} from '../../api/planRules'
import type { EditorProps } from './GroupsEditor'
import FoodRuleForm from './FoodRuleForm'
import CatalogSearch from './CatalogSearch'

export default function FoodRulesEditor(props: EditorProps) {
  const { token, plan, mutate, onDirtyChange } = props
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<FoodRule | 'new' | null>(null)
  const { rememberTrigger, restoreFocus } = useEditorFocus()
  function openEditor(value: FoodRule | 'new') {
    rememberTrigger()
    setEditing(value)
  }
  function closeEditor() {
    setEditing(null)
    restoreFocus()
  }
  async function save(input: FoodInput) {
    if (!editing) return false
    const body = { ...input, planVersion: plan.planVersion }
    const next = await mutate(() =>
      editing === 'new' ? createFood(token, body) : updateFood(token, editing.uid, body)
    )
    if (next) closeEditor()
    return !!next
  }
  async function confirmDelete(uid: string) {
    if (await mutate(() => deleteFood(token, uid, plan.planVersion))) {
      closeEditor()
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-add-rule]')?.focus())
    }
  }

  return (
    <section aria-label="Alimentos" onKeyDown={e => { if (e.key === 'Escape') closeEditor() }}>
      <button type="button" data-add-rule onClick={() => openEditor('new')}>
        Agregar alimento
      </button>
      {editing === 'new' && (
        <FoodRuleForm
          onDirtyChange={onDirtyChange}
          groups={plan.grupos}
          rule={editing === 'new' ? undefined : editing}
          onCancel={closeEditor}
          onSave={save}
        />
      )}
      <label>
        Buscar alimentos
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <h3>En tu plan</h3>
      {plan.alimentos
        .filter((rule) =>
          (editing !== 'new' && editing?.uid === rule.uid) || [rule.alimento, ...rule.sinonimos].some((s) =>
            s.toLocaleLowerCase().includes(query.toLocaleLowerCase())
          )
        )
        .map((rule) => (
          <article className="rules-card" key={rule.uid}>
            <button type="button" className="rules-item" aria-label={`Editar ${rule.alimento}`} onClick={() => openEditor(rule)}><strong>{rule.alimento}</strong>
            <span className="rules-secondary">{rule.textoRegla}</span></button>
            {editing !== 'new' && editing?.uid === rule.uid && rule.alcance === 'USUARIO' && (
              <FoodRuleForm
          onDirtyChange={onDirtyChange}
                groups={plan.grupos}
                rule={editing}
                onCancel={closeEditor}
                deleteAction={<InlineDelete name={rule.alimento} onDelete={() => confirmDelete(rule.uid)} />}
                onSave={save}
              />
            )}
            {editing !== 'new' && editing?.uid === rule.uid && rule.alcance !== 'USUARIO' && <div>
              <button autoFocus type="button" onClick={async () => {
                const next = await mutate(() => adjustFromCatalog(token, rule.uid, plan.planVersion))
                const adjusted = next?.alimentos.find(food => food.overridesRuleUid === rule.uid)
                if (adjusted) setEditing(adjusted)
              }}>Ajustar para mi plan</button>
              <button type="button" onClick={closeEditor}>Cancelar</button>
            </div>}
          </article>
        ))}
      <CatalogSearch {...props} query={query} onAdjusted={openEditor} />
    </section>
  )
}
