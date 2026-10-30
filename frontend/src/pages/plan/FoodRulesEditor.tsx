import { useEditorFocus } from './useEditorFocus'
import { useState } from 'react'
import {
  createFood,
  updateFood,
  deleteFood,
  type FoodRule,
  type FoodInput,
} from '../../api/planRules'
import type { EditorProps } from './GroupsEditor'
import FoodRuleForm from './FoodRuleForm'
import CatalogSearch from './CatalogSearch'

export default function FoodRulesEditor(props: EditorProps) {
  const { token, plan, mutate } = props
  const [query, setQuery] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
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
    if (await mutate(() => deleteFood(token, uid, plan.planVersion))) setConfirm(null)
  }

  return (
    <section aria-label="Alimentos">
      <h2>Alimentos</h2>
      <button type="button" onClick={() => openEditor('new')}>
        Agregar alimento
      </button>
      {editing === 'new' && (
        <FoodRuleForm
          groups={plan.grupos}
          rule={editing === 'new' ? undefined : editing}
          onCancel={closeEditor}
          onSave={save}
        />
      )}
      <CatalogSearch {...props} onAdjusted={openEditor} />
      <label>
        Buscar en tu plan
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {plan.alimentos
        .filter((rule) =>
          [rule.alimento, ...rule.sinonimos].some((s) =>
            s.toLocaleLowerCase().includes(query.toLocaleLowerCase())
          )
        )
        .map((rule) => (
          <article className="rules-card" key={rule.uid}>
            <h3>{rule.alimento}</h3>
            <p>{rule.textoRegla}</p>
            {rule.alcance === 'USUARIO' && (
              <div className="rules-row">
                <button
                  type="button"
                  aria-label={`Editar ${rule.alimento}`}
                  onClick={() => openEditor(rule)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  aria-label={`Borrar ${rule.alimento}`}
                  onClick={() => setConfirm(rule.uid)}
                >
                  Borrar
                </button>
              </div>
            )}
            {editing !== 'new' && editing?.uid === rule.uid && (
              <FoodRuleForm
                groups={plan.grupos}
                rule={editing}
                onCancel={closeEditor}
                onSave={save}
              />
            )}
            {confirm === rule.uid && (
              <div>
                <p>¿Borrar {rule.alimento}?</p>
                <button type="button" onClick={() => confirmDelete(rule.uid)}>
                  Confirmar borrado
                </button>
                <button type="button" onClick={() => setConfirm(null)}>
                  Cancelar
                </button>
              </div>
            )}
          </article>
        ))}
    </section>
  )
}
