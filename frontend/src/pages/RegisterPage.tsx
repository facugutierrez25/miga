import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api/users'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import './RegisterPage.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PWD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{10,}$/

export default function RegisterPage() {
  useTitle('Crear cuenta | Miga')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function validateEmail(v: string) {
    if (!v) return 'El email es obligatorio.'
    if (!EMAIL_RE.test(v)) return 'Ingresá un email válido.'
    return null
  }

  function validatePassword(v: string) {
    if (!v) return 'La contraseña es obligatoria.'
    if (!PWD_RE.test(v)) return 'Mínimo 10 caracteres, mayúscula, minúscula, número y carácter especial.'
    return null
  }

  function validateConfirm(v: string) {
    if (!v) return 'Repetí la contraseña.'
    if (v !== password) return 'Las contraseñas no coinciden.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const eErr = validateEmail(email)
    const pErr = validatePassword(password)
    const cErr = validateConfirm(confirm)
    setEmailError(eErr)
    setPasswordError(pErr)
    setConfirmError(cErr)
    if (eErr || pErr || cErr) return

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
              onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(validateEmail(e.target.value)) }}
              onBlur={e => setEmailError(validateEmail(e.target.value))}
              required
              autoComplete="email"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
            {emailError && <span id="email-error" className="register-field-error" role="alert">{emailError}</span>}
          </div>

          <div className="register-field">
            <label htmlFor="password">Contraseña</label>
            <div className="register-input-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); if (passwordError) setPasswordError(validatePassword(e.target.value)) }}
                onBlur={e => setPasswordError(validatePassword(e.target.value))}
                required
                autoComplete="new-password"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : 'password-hint'}
              />
              <button
                type="button"
                className="register-eye"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M2 9s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M3 3l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M2 9s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.4"/>
                  </svg>
                )}
              </button>
            </div>
            {passwordError
              ? <span id="password-error" className="register-field-error" role="alert">{passwordError}</span>
              : <p id="password-hint" className="register-hint">Mínimo 10 caracteres, mayúscula, minúscula, número y carácter especial.</p>
            }
          </div>

          <div className="register-field">
            <label htmlFor="confirm">Repetir contraseña</label>
            <div className="register-input-wrap">
              <input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={e => { setConfirm(e.target.value); if (confirmError) setConfirmError(validateConfirm(e.target.value)) }}
                onBlur={e => setConfirmError(validateConfirm(e.target.value))}
                required
                autoComplete="new-password"
                aria-invalid={!!confirmError}
                aria-describedby={confirmError ? 'confirm-error' : undefined}
              />
              <button
                type="button"
                className="register-eye"
                onClick={() => setShowConfirm(s => !s)}
                aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showConfirm ? (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M2 9s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M3 3l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M2 9s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.4"/>
                  </svg>
                )}
              </button>
            </div>
            {confirmError && <span id="confirm-error" className="register-field-error" role="alert">{confirmError}</span>}
          </div>

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
