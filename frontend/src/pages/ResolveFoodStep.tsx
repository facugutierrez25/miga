import { useEffect, useState } from 'react'
import { searchCatalog, type CatalogItem } from '../api/planRules'
import { resolveItem, type EntryItemDto, type ResolveItemRequest, type ResolveItemResultDto } from '../api/registro'
import { useDebouncedValue } from '../lib/useDebouncedValue'

export default function ResolveFoodStep({ item, token, date, groups, onBack, onResolved, onSaving }: {
  item: EntryItemDto; token: string; date: string
  groups: Record<number, { name: string }>
  onBack: () => void
  onResolved: (result: ResolveItemResultDto, message: string, remembered: boolean) => void
  onSaving: (saving: boolean) => void
}) {
  const [query, setQuery] = useState(item.food)
  const debouncedQuery = useDebouncedValue(query)
  const [response, setResponse] = useState<{ query: string; items: CatalogItem[] }>({ query: '', items: [] })
  const [failure, setFailure] = useState({ query: '', message: '' })
  const searchError = failure.query === query ? failure.message : ''
  const [loadingQuery, setLoadingQuery] = useState<string | null>(null)
  const loading = loadingQuery === query && query.trim().length >= 2
  const [remember, setRemember] = useState(true)
  const [editingGroups, setEditingGroups] = useState(false)
  const [rows, setRows] = useState([{ foodGroupId: Object.keys(groups)[0] || '', portions: '1' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (query !== debouncedQuery || query.trim().length < 2) return
    let active = true
    Promise.resolve().then(async () => {
      if (!active) return
      setLoadingQuery(query)
      setFailure({ query, message: '' })
      try {
        const items = await searchCatalog(token, query.trim())
        if (active) setResponse({ query, items })
      } catch {
        if (active) setFailure({ query, message: 'No se pudo buscar. Intentá de nuevo.' })
      } finally {
        if (active) setLoadingQuery(null)
      }
    })
    return () => { active = false }
  }, [token, query, debouncedQuery])
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
  const results = response.query === query ? response.items : []
  const validGroups = rows.length >= 1 && rows.length <= 10 && new Set(rows.map(row => row.foodGroupId)).size === rows.length
    && rows.every(row => groups[Number(row.foodGroupId)] && Number(row.portions) >= 0.5 && Number.isFinite(Number(row.portions)) && Number(row.portions) % 0.5 === 0)
  return <div className="resolve-food">
    <fieldset disabled={saving}>
      <label>Buscar algo parecido<input value={query} onChange={event => setQuery(event.target.value)} /></label>
      {query.trim().length < 2 && <p>Escribí al menos 2 caracteres para buscar en el catálogo.</p>}
      {(loading || query !== debouncedQuery) && <p role="status">Buscando…</p>}
      {searchError && <p role="alert">{searchError}</p>}
      {!loading && query === debouncedQuery && !searchError && query.trim().length >= 2 && response.query === query && results.length === 0 && <p>No encontré nada parecido.</p>}
      {results.map(result => <article key={result.uid}>
        <strong>{result.alimento}</strong><p>{result.textoRegla}</p>
        {result.alcance && <p>{result.alcance === 'USUARIO' ? 'Tus alimentos' : result.alcance === 'PLAN' ? 'De tu plan' : 'Catálogo'}</p>}
        <button type="button" className="resolve-primary" onClick={() => void save({ kind: 'SAME_AS', ruleUid: result.uid }, result.alimento)}>Es esto</button>
      </article>)}
      <p>¿No está? Elegí cómo cuenta</p>
      <button type="button" onClick={() => setEditingGroups(true)}>Elegir grupos y porciones</button>
      {editingGroups && <div className="resolve-groups">
        {rows.map((row, index) => <div className="resolve-group" key={index}>
          <label>Grupo {index + 1}<select value={row.foodGroupId} onChange={event => setRows(rows.map((value, i) => i === index ? { ...value, foodGroupId: event.target.value } : value))}>
            {Object.entries(groups).map(([id, group]) => <option key={id} value={id} disabled={rows.some((value, i) => i !== index && value.foodGroupId === id)}>{group.name}</option>)}
          </select></label>
          <label>Porciones {index + 1}<input type="number" step="0.5" min="0.5" value={row.portions} onChange={event => setRows(rows.map((value, i) => i === index ? { ...value, portions: event.target.value } : value))} /></label>
          {rows.length > 1 && <button type="button" aria-label={`Quitar grupo ${index + 1}`} onClick={() => setRows(rows.filter((_, i) => i !== index))}>Quitar</button>}
        </div>)}
        <button type="button" disabled={rows.length >= Math.min(10, Object.keys(groups).length)} onClick={() => setRows([...rows, { foodGroupId: Object.keys(groups).find(id => !rows.some(row => row.foodGroupId === id)) || '', portions: '1' }])}>+ Agregar grupo</button>
        <button type="button" className="resolve-primary" disabled={!validGroups} onClick={() => void save({ kind: 'GROUPS', groups: rows.map(row => ({ foodGroupId: Number(row.foodGroupId), portions: Number(row.portions) })) }, 'lo que elegiste')}>Guardar</button>
      </div>}
      <button type="button" onClick={() => void save({ kind: 'FLEXIBLE' }, 'comida flexible')}>Comida flexible</button>
      <button type="button" onClick={() => void save({ kind: 'NOT_COUNTED' }, 'algo que no cuenta para el plan')}>No cuenta para el plan</button>
      <label className="resolve-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />Reconocerlo siempre que lo escriba</label>
      <button type="button" className="nota-link" onClick={onBack}>Dejarlo así para mi nutri</button>
    </fieldset>
    {error && <p role="alert">No se pudo guardar. Probá de nuevo.</p>}
  </div>
}
