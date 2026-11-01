import { useState, type FormEvent } from 'react'
import { deleteMe } from '../api/users'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import { useTheme, type Theme } from '../hooks/useTheme'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import './PerfilPage.css'

const TEMAS: { value: Theme; label: string }[] = [
  { value: 'auto',  label: 'Automático' },
  { value: 'light', label: 'Claro'      },
  { value: 'dark',  label: 'Oscuro'     },
]

export default function PerfilPage() {
  useTitle('Perfil | Miga')
  const { token, email, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deletionError, setDeletionError] = useState('')

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || deleting) return
    setDeleting(true)
    setDeletionError('')
    try {
      await deleteMe(token, password)
      logout()
      navigate('/', { replace: true, state: { accountDeleted: true } })
    } catch (error) {
      setDeletionError(error instanceof Error ? error.message : 'No se pudo eliminar tu cuenta.')
      setPassword('')
    } finally {
      setDeleting(false)
    }
  }

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

        <section className="perfil-card account-deletion" aria-labelledby="delete-account-title">
          <h2 id="delete-account-title">Eliminar mi cuenta</h2>
          <p id="delete-account-description">
            Se borrarán tu cuenta, todos tus planes y versiones, reglas propias, notas,
            registros de comidas, hábitos y sus registros. No se puede deshacer.
            Escribí tu contraseña para confirmar.
          </p>
          <form onSubmit={deleteAccount} aria-busy={deleting}>
            <label htmlFor="delete-password">Contraseña actual</label>
            <input id="delete-password" type="password" autoComplete="current-password"
              required value={password} disabled={deleting}
              aria-describedby={`delete-account-description${deletionError ? ' delete-account-error' : ''}`}
              aria-invalid={Boolean(deletionError)}
              onChange={event => setPassword(event.target.value)} />
            {deletionError && <p id="delete-account-error" role="alert">{deletionError}</p>}
            <button type="submit" className="btn-cerrar-sesion" disabled={deleting || !password}>
              {deleting ? 'Eliminando cuenta…' : 'Eliminar mi cuenta definitivamente'}
            </button>
          </form>
        </section>

        <button disabled={deleting} className="btn-cerrar-sesion" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
