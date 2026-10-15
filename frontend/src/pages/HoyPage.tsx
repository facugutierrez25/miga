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

  return (
    <div className="hoy-page">
      <header className="hoy-header">
        <div className="hoy-header__top">
          <Brand size={24} />
          <p className="hoy-header__fecha">{fechaHoy()}</p>
        </div>
        <h1 className="hoy-header__titulo">{saludo()}, {nombre}.</h1>
      </header>

      <div className="hoy-body">
        {cargando ? (
          <p className="hoy-loading">Cargando tu día…</p>
        ) : sinPlan ? (
          <div className="hoy-sin-plan">
            <p className="hoy-sin-plan__texto">Todavía no cargaste tu plan.</p>
            <Link to="/mi-plan" className="btn-cargar-plan">Cargar mi plan</Link>
          </div>
        ) : (
          plan?.meals
            .slice()
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((meal, i) => {
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
                      {noVacias.map(p => {
                        const g = GRUPOS[p.foodGroup]
                        return (
                          <span key={p.foodGroup} className="grupo-chip">
                            <span className="grupo-chip__dot" style={{ background: g.dot }} />
                            <span className="grupo-chip__label">{g.label}</span>
                            <span className="grupo-chip__valor">{p.portions}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}
