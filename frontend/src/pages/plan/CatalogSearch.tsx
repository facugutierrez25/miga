import {
  adjustFromCatalog,
  type CatalogItem,
  type FoodRule,
} from '../../api/planRules'
import { useCatalogSearch } from '../../lib/useCatalogSearch'
import type { EditorProps } from './GroupsEditor'

export default function CatalogSearch({
  token,
  plan,
  mutate,
  onAdjusted,
  query,
}: EditorProps & { query: string; onAdjusted: (rule: FoodRule) => void }) {
  const { results, error, loading } = useCatalogSearch(token, query)

  async function adjust(item: CatalogItem, row: HTMLElement | null) {
    const next = await mutate(() => adjustFromCatalog(token, item.uid, plan.planVersion))
    const rule = next?.alimentos.find((r) => r.overridesRuleUid === item.uid)
    if (rule) {
      row?.focus()
      onAdjusted(rule)
    }
  }

  return (
    <section aria-label="Catálogo">
      <h3>Del catálogo</h3>
      {query.trim().length < 2 && <p>Escribí al menos 2 caracteres para buscar en el catálogo.</p>}
      {loading && <p role="status">Buscando…</p>}
      {error && <p role="alert">{error}</p>}
      {results.map((item) => {
        const adjusted =
          item.ajustadoPorUid || plan.alimentos.some((r) => r.overridesRuleUid === item.uid)
        return (
          <article className="rules-card" tabIndex={-1} key={item.uid}>
            <h4>{item.alimento}</h4>
            <p>{item.textoRegla}</p>
            <button type="button" disabled={!!adjusted} onClick={event => adjust(item, event.currentTarget.closest('article'))}>
              {adjusted ? 'Ya ajustado' : 'Ajustar para mi plan'}
            </button>
          </article>
        )
      })}
    </section>
  )
}
