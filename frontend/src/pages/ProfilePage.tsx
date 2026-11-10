import Segmented from '../components/Segmented'
import { useState, type FormEvent } from 'react'
import { deleteMe } from '../api/users'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import { useTheme, type Theme } from '../hooks/useTheme'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import './ProfilePage.css'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'auto',  label: 'Automático' },
  { value: 'light', label: 'Claro'      },
  { value: 'dark',  label: 'Oscuro'     },
]

export default function ProfilePage() {
  useTitle('Perfil | Miga')
  const { token, email, firstName, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const [deletionOpen, setDeletionOpen] = useState(false)
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

  function logOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="perfil-page">
      <header className="perfil-header">
        <Brand size={22} />
        <h1 className="perfil-title">Perfil</h1>
      </header>

      <div className="perfil-body">
        <ul className="perfil-card perfil-list">
          <li><span><strong>{firstName || 'Tu cuenta'}</strong><br />
            <span className="perfil-muted">{email}</span></span></li>
        </ul>

        <h2>Tema</h2>
        <Segmented label="Tema de la aplicación" options={THEMES} value={theme} onChange={setTheme} />

        <h2>Tus datos</h2>
        <ul className="perfil-card perfil-list">
          <li><Link to="/semana?exportar=1">
            <span><strong>Exportar para tu nutri</strong><br />
              <span className="perfil-muted">Se hace por semana, desde Semana</span></span>
            <span className="perfil-arrow" aria-hidden="true">›</span>
          </Link></li>
          <li><Link to="/privacidad"><strong>Privacidad</strong>
            <span className="perfil-arrow" aria-hidden="true">›</span>
          </Link></li>
        </ul>

        <button disabled={deleting} className="btn-cerrar-sesion" onClick={logOut}>
          Cerrar sesión
        </button>

        <section className="account-deletion" aria-labelledby="delete-account-title">
          <h2 id="delete-account-title"><button type="button" className="perfil-delete-link"
            aria-expanded={deletionOpen} aria-controls="delete-account-panel" disabled={deleting}
            onClick={() => { setDeletionOpen(!deletionOpen); setPassword(''); setDeletionError('') }}>
            Eliminar mi cuenta
          </button></h2>
          {deletionOpen && <div id="delete-account-panel">

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
          </div>}
        </section>


      </div>
    </div>
  )
}
