import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useTheme, type Theme } from '../hooks/useTheme'
import Brand from '../components/Brand'
import './PerfilPage.css'

const TEMAS: { value: Theme; label: string }[] = [
  { value: 'auto',  label: 'Automático' },
  { value: 'light', label: 'Claro'      },
  { value: 'dark',  label: 'Oscuro'     },
]

export default function PerfilPage() {
  const { email, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  function cerrarSesion() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="perfil-page">
      <header className="perfil-header">
        <Brand size={26} />
        <h1 className="perfil-title">Perfil</h1>
      </header>

      <div className="perfil-body">
        <div className="perfil-card">
          <p className="perfil-card__label">Email</p>
          <p className="perfil-card__value">{email}</p>
        </div>

        <div className="perfil-card">
          <p className="perfil-card__label">Tema</p>
          <div className="tema-selector" role="radiogroup" aria-label="Tema de la aplicación">
            {TEMAS.map(op => (
              <label
                key={op.value}
                className={`tema-opcion${theme === op.value ? ' tema-opcion--activa' : ''}`}
              >
                <input
                  type="radio"
                  name="tema"
                  value={op.value}
                  checked={theme === op.value}
                  onChange={() => setTheme(op.value)}
                  className="sr-only"
                />
                {op.label}
              </label>
            ))}
          </div>
        </div>

        <button className="btn-cerrar-sesion" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
