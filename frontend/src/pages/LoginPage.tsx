import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login, resendVerification } from '../api/users'
import { useAuth } from '../auth/AuthContext'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import './RegisterPage.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  useTitle('Iniciar sesión | Miga')
  const navigate = useNavigate()
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [notVerified, setNotVerified] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  function validateEmail(v: string) {
    if (!v) return 'El email es obligatorio.'
    if (!EMAIL_RE.test(v)) return 'Ingresá un email válido.'
    return null
  }

  function validatePassword(v: string) {
    if (!v) return 'La contraseña es obligatoria.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const eErr = validateEmail(email)
    const pErr = validatePassword(password)
    setEmailError(eErr)
    setPasswordError(pErr)
    if (eErr || pErr) return

    setError(null)
    setNotVerified(false)
    setResendDone(false)
    setLoading(true)
    try {
      const token = await login(email, password)
      auth.login(token)
      navigate('/hoy')
    } catch (err) {
      if (err instanceof Error && err.message === 'EMAIL_NOT_VERIFIED') {
        setNotVerified(true)
      } else {
        setError(err instanceof Error ? err.message : 'Error desconocido.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    await resendVerification(email)
    setResendDone(true)
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
                autoComplete="current-password"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : undefined}
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
            {passwordError && <span id="password-error" className="register-field-error" role="alert">{passwordError}</span>}
          </div>

          {error && <p role="alert" className="register-error">{error}</p>}

          <button type="submit" disabled={loading} className="register-submit">
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        {notVerified && (
          <div role="alert" className="login-unverified">
            <p className="login-unverified__msg">
              Verificá tu email antes de ingresar.
            </p>
            {resendDone
              ? <p className="login-unverified__ok">Link reenviado, revisá tu bandeja.</p>
              : <button type="button" className="login-unverified__resend" onClick={handleResend}>
                  Reenviar link de verificación
                </button>
            }
          </div>
        )}

        <p className="register-footer">
          <Link to="/recuperar-contrasena" className="register-footer__forgot">¿Olvidaste tu contraseña?</Link>
        </p>
        <p className="register-footer">¿No tenés cuenta? <Link to="/register">Registrate</Link></p>
      </div>
    </main>
  )
}
