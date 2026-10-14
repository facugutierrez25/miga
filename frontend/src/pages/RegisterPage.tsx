import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api/users'
import Brand from '../components/Brand'
import './RegisterPage.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await register(email, password)
      navigate('/login')
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
        <h1 className="register-title">Crear cuenta</h1>
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
              autoComplete="new-password"
            />
          </div>
          <p className="register-hint">Mínimo 10 caracteres, mayúscula, minúscula, número y carácter especial.</p>

          {error && <p role="alert" className="register-error">{error}</p>}

          <button type="submit" disabled={loading} className="register-submit">
            {loading ? 'Registrando…' : 'Crear cuenta'}
          </button>
        </form>
        <p className="register-footer">¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link></p>
      </div>
    </main>
  )
}
