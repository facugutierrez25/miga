import { validGroupPortions } from '../../lib/groupPortions'
import { GroupPortionsEditor } from '../../components/GroupPortionsEditor'
import { useState } from 'react'
import {
  resolveItem,
  type EntryItemDto,
  type ResolveItemRequest,
  type ResolveItemResultDto,
} from '../../api/records'
import { useCatalogSearch } from '../../lib/useCatalogSearch'

export default function ResolveFoodStep({ item, token, date, groups, onBack, onResolved, onSaving }: {
  item: EntryItemDto; token: string; date: string
  groups: Record<number, { name: string }>
  onBack: () => void
  onResolved: (result: ResolveItemResultDto, message: string, remembered: boolean) => void
  onSaving: (saving: boolean) => void
}) {
  const [query, setQuery] = useState(item.food)
  const { results, error: searchError, loading, debouncing, empty } = useCatalogSearch(token, query)
  const [remember, setRemember] = useState(true)
  const [editingGroups, setEditingGroups] = useState(false)
  const [rows, setRows] = useState([{ foodGroupId: Object.keys(groups)[0] || '', portions: '1' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  async function save(request: Omit<ResolveItemRequest, 'remember'>, name: string) {
    if (saving) return
    setSaving(true)
    onSaving(true)
    setError(false)
    try {
      const result = await resolveItem(token, date, item.id, { ...request, remember })
      onResolved(result, `Listo: «${item.originalText || item.food}» ahora cuenta como ${name}.${remember ? ' Lo voy a reconocer la próxima vez.' : ''}`, remember)
    } catch { setError(true) }
    finally { setSaving(false); onSaving(false) }
  }
  const validGroups = validGroupPortions(rows, groups)
  return <div className="resolve-food">
    <fieldset disabled={saving}>
      <label>Buscar algo parecido<input value={query} onChange={event => setQuery(event.target.value)} /></label>
      {query.trim().length < 2 && <p>Escribí al menos 2 caracteres para buscar en el catálogo.</p>}
      {(loading || debouncing) && <p role="status">Buscando…</p>}
      {searchError && <p role="alert">{searchError}</p>}
      {empty && <p>No encontré nada parecido.</p>}
      {results.map(result => <article key={result.uid}>
        <strong>{result.alimento}</strong><p>{result.textoRegla}</p>
        {result.alcance && <p>{result.alcance === 'USUARIO' ? 'Tus alimentos' : result.alcance === 'PLAN' ? 'De tu plan' : 'Catálogo'}</p>}
        <button type="button" className="resolve-primary" onClick={() => void save({ kind: 'SAME_AS', ruleUid: result.uid }, result.alimento)}>Es esto</button>
      </article>)}
      <p>¿No está? Elegí cómo cuenta</p>
      <button type="button" onClick={() => setEditingGroups(true)}>Elegir grupos y porciones</button>
      {editingGroups && <div className="resolve-groups">
        <GroupPortionsEditor groups={groups} rows={rows} onChange={setRows} variant="resolve" labels={{
          group: index => `Grupo ${index + 1}`, portions: index => `Porciones ${index + 1}`,
          remove: 'Quitar', removeGroup: index => `Quitar grupo ${index + 1}`,
          add: '+ Agregar grupo',
        }} />
        <button type="button" className="resolve-primary" disabled={!validGroups} onClick={() => void save({ kind: 'GROUPS', groups: rows.map(row => ({ foodGroupId: Number(row.foodGroupId), portions: Number(row.portions) })) }, 'lo que elegiste')}>Guardar</button>
      </div>}
      <button type="button" onClick={() => void save({ kind: 'FLEXIBLE' }, 'comida flexible')}>Comida flexible</button>
      <button type="button" onClick={() => void save({ kind: 'NOT_COUNTED' }, 'algo que no cuenta para el plan')}>No cuenta</button>
      <label className="resolve-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />Reconocerlo siempre que lo escriba</label>
      <button type="button" className="nota-link" onClick={onBack}>Dejarlo así para mi nutri</button>
    </fieldset>
    {error && <p role="alert">No se pudo guardar. Probá de nuevo.</p>}
  </div>
}
