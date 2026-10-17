import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Brand from '../components/Brand'
import { getMyPlan, type FoodGroup, type PlanDto } from '../api/plans'
import './HoyPage.css'

const GRUPOS: Record<FoodGroup, { label: string; dot: string }> = {
  PROTEINS:   { label: 'Proteínas', dot: 'var(--g-prot)' },
  GRAINS:     { label: 'Cereales',  dot: 'var(--g-cer)'  },
  FRUITS:     { label: 'Frutas',    dot: 'var(--g-frut)' },
  DAIRY:      { label: 'Lácteos',   dot: 'var(--g-lac)'  },
  FATS:       { label: 'Grasas',    dot: 'var(--g-gras)' },
  VEGETABLES: { label: 'Verduras',  dot: 'var(--g-verd)' },
}

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function fechaHoy(): string {
  return new Date().toLocaleDateString('es-UY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function HoyPage() {
  const { token, email } = useAuth()
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [sinPlan, setSinPlan] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!token) return
    getMyPlan(token)
      .then(setPlan)
      .catch(err => { if (err.message === 'sin-plan') setSinPlan(true) })
      .finally(() => setCargando(false))
  }, [token])

  const nombre = email?.split('@')[0] ?? ''
  const meals = plan?.meals.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? []

  return (
    <div className="hoy-page">
      {/* Header visible solo en mobile — AppLayout lo oculta en desktop */}
      <header className="hoy-header">
        <div className="hoy-header__meta">
          <Brand size={20} />
          <p className="hoy-header__fecha">{fechaHoy()}</p>
        </div>
        <h1 className="hoy-header__titulo">{saludo()}, {nombre}.</h1>
      </header>

      <div className="hoy-body">
        {/* Greeting visible solo en desktop — complementa el app-header */}
        <div className="hoy-desktop-saludo">
          <p className="hoy-desktop-saludo__fecha">{fechaHoy()}</p>
          <h1 className="hoy-desktop-saludo__titulo">{saludo()}, {nombre}.</h1>
        </div>

        {cargando ? (
          <p className="hoy-loading">Cargando tu día…</p>
        ) : sinPlan ? (
          <div className="hoy-sin-plan">
            <p className="hoy-sin-plan__titulo">Todavía no tenés un plan</p>
            <p className="hoy-sin-plan__texto">
              Cargá el plan que te dio tu nutricionista y organizá tu día.
            </p>
            <Link to="/onboarding" className="btn-cargar-plan">Cargar mi plan</Link>
            <Link to="/mi-plan" className="btn-cargar-plan-manual">Cargar yo solo</Link>
          </div>
        ) : (
          <div className="hoy-cards">
            {meals.map((meal, i) => {
              const noVacias = meal.portions.filter(p => p.portions > 0)
              return (
                <div key={i} className="comida-hoy">
                  <div className="comida-hoy__encabezado">
                    <span className="comida-hoy__nombre">{meal.name}</span>
                    {meal.suggestedTime && (
                      <span className="comida-hoy__hora">
                        {meal.suggestedTime.slice(0, 5)}
                      </span>
                    )}
                  </div>
                  {noVacias.length > 0 && (
                    <div className="comida-hoy__grupos">
                      {noVacias.map(p => (
                        <span key={p.foodGroup} className={`grupo-badge grupo-badge--${p.foodGroup}`}>
                          <span className="grupo-badge__numero">{p.portions}</span>
                          <span className="grupo-badge__label">{GRUPOS[p.foodGroup].label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
