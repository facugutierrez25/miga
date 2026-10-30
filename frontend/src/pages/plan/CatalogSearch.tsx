import { useEffect, useState } from 'react'
import { searchCatalog, adjustFromCatalog, type CatalogItem, type FoodRule } from '../../api/planRules'
import type { EditorProps } from './GroupsEditor'
export default function CatalogSearch({ token, plan, mutate, onAdjusted }: EditorProps & { onAdjusted: (rule: FoodRule) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      if (query.trim().length < 2) { setResults([]); return }
      setLoading(true); setError('')
      searchCatalog(token, query.trim()).then(data => { if (active) setResults(data) }).catch(() => { if (active) setError('No se pudo buscar. Intentá de nuevo.') }).finally(() => { if (active) setLoading(false) })
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [token, query])
  return <section aria-label="Catálogo"><h3>Buscá en el catálogo</h3><label>Buscar en catálogo<input value={query} onChange={e => { setQuery(e.target.value); setResults([]) }} /></label>
    {loading && <p role="status">Buscando…</p>}{error && <p role="alert">{error}</p>}
    {results.map(item => { const adjusted = item.ajustadoPorUid || plan.alimentos.some(r => r.overridesRuleUid === item.uid); return <article className="rules-card" key={item.uid}><h4>{item.alimento}</h4><p>{item.textoRegla}</p><button type="button" disabled={!!adjusted} onClick={async () => { const next = await mutate(() => adjustFromCatalog(token, item.uid, plan.planVersion)); const rule = next?.alimentos.find(r => r.overridesRuleUid === item.uid); if (rule) onAdjusted(rule) }}>{adjusted ? 'Ya ajustado' : 'Ajustar para mi plan'}</button></article> })}
  </section>
}
