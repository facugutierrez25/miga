import type { MealDto } from '../../api/plans'
import { useCallback, useEffect, useState } from 'react'
import { getPlanRules, type PlanRules } from '../../api/planRules'
import GroupsEditor from './GroupsEditor'
import FoodRulesEditor from './FoodRulesEditor'
import HabitsEditor from './HabitsEditor'
import './PlanRules.css'

export default function PlanRulesSection({
  token,
  onChanged,
  meals,
  initialSection = 'groups',
}: {
  initialSection?: string
  meals?: Pick<MealDto, 'portions'>[]
  token: string | null
  onChanged?: (plan: PlanRules) => void
}) {
  const [plan, setPlan] = useState<PlanRules | null>(null)

  const [error, setError] = useState<{ code?: string; message: string } | null>(null)

  const [busy, setBusy] = useState(false)

  const [section, setSection] = useState(initialSection)

  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!token) return

    let active = true

    getPlanRules(token)
      .then((data) => {
        if (active) {
          setPlan(data)
          onChanged?.(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (active) setError({ message: err.error ?? 'No se pudieron cargar las reglas.' })
      })

    return () => {
      active = false
    }
  }, [token, reload, onChanged])

  const mutate = useCallback(
    async (operation: () => Promise<PlanRules>) => {
      if (busy || error?.code === 'VERSION_CONFLICT') return null

      setBusy(true)
      setError(null)

      try {
        const data = await operation()
        setPlan(data)
        onChanged?.(data)
        return data
      } catch (err) {
        const failure = err as { code?: string; error?: string }
        setError({
          code: failure.code,
          message:
            failure.code === 'VERSION_CONFLICT'
              ? 'El plan cambió en otra sesión.'
              : failure.error ?? 'No se pudo guardar. Intentá de nuevo.',
        })
        return null
      } finally {
        setBusy(false)
      }
    },
    [busy, error?.code, onChanged]
  )

  function reloadPlan() {
    setPlan(null)
    setError(null)
    setReload((value) => value + 1)
  }

  const props = plan && token ? { token, plan, mutate } : null

  return (
    <div className="plan-rules">
      {error && (
        <div role="alert" className="plan-error">
          <p>{error.message}</p>
          <button type="button" onClick={reloadPlan}>
            Recargar
          </button>
        </div>
      )}

      {!plan && !error && <p role="status">Cargando reglas…</p>}

      {props && (
        <>
          <div className="rules-row" aria-label="Secciones de reglas">
            {[
              ['groups', 'Grupos'],
              ['foods', 'Alimentos'],
              ['habits', 'Hábitos'],
            ].map(([key, label]) => (
              <button
                type="button"
                key={key}
                aria-pressed={section === key}
                onClick={() => setSection(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {busy && <p role="status">Guardando…</p>}

          <fieldset className="rules-editor" disabled={busy || error?.code === 'VERSION_CONFLICT'}>
            {section === 'groups' && <GroupsEditor {...props} meals={meals} />}
            {section === 'foods' && <FoodRulesEditor {...props} />}
            {section === 'habits' && <HabitsEditor {...props} />}
          </fieldset>
        </>
      )}
    </div>
  )
}
