import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api/users'
import { useAuth } from '../auth/AuthContext'
import Brand from '../components/Brand'
import './RegisterPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const token = await login(email, password)
      auth.login(token)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="register-page">
      <div className="register-card">
        <div className="register-brand"><Brand size={30}/></div>
        <h1 className="register-title">Iniciar sesión</h1>
        <form onSubmit={handleSubmit} noValidate>
          <div className="register-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="register-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p role="alert" className="register-error">{error}</p>}

          <button type="submit" disabled={loading} className="register-submit">
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
        <p className="register-footer">¿No tenés cuenta? <Link to="/register">Registrate</Link></p>
      </div>
    </main>
  )
}
