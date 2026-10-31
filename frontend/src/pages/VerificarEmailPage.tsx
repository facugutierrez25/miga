import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import { verifyEmail, resendVerification } from '../api/users'
import './RegisterPage.css'
import './VerificarEmailPage.css'

type Estado = 'pendiente' | 'verificando' | 'verificado' | 'error'

export default function VerificarEmailPage() {
  useTitle('Verificá tu email | Miga')
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const token = searchParams.get('token')
  const emailInicial = (location.state as { email?: string } | null)?.email ?? ''

  const [estado, setEstado] = useState<Estado>(token ? 'verificando' : 'pendiente')
  const [email, setEmail] = useState(emailInicial)
  const [reenviando, setReenviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)
  const [resendError, setResendError] = useState('')
  const verificado = useRef(false)

  useEffect(() => {
    if (!token || verificado.current) return
    verificado.current = true
    verifyEmail(token)
      .then(() => setEstado('verificado'))
      .catch(() => setEstado('error'))
  }, [token])

  async function handleResend(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setReenviando(true)
    setResendError('')
    try {
      await resendVerification(email)
      setReenviado(true)
    } catch {
      setResendError('No se pudo reenviar el link. Probá de nuevo.')
    } finally {
      setReenviando(false)
    }
  }

  return (
    <main className="register-page">
      <div className="register-card">
        <div className="register-brand"><Brand size={30} /></div>

        {resendError && <p role="alert" className="register-error">{resendError}</p>}
        {estado === 'verificando' && (
          <>
            <div className="vmail-spinner" aria-label="Verificando…" />
            <h1 className="register-title">Verificá tu email</h1>
            <p role="status" className="vmail-subtitle">Verificando tu email…</p>
          </>
        )}

        {estado === 'verificado' && (
          <>
            <div className="vmail-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="var(--primary)" strokeWidth="1.8"/>
                <path d="M8 14l4.5 4.5 7.5-8" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="register-title">Email verificado</h1>
            <p role="status" className="vmail-subtitle">Tu cuenta está lista. Ya podés iniciar sesión.</p>
            <Link to="/login" className="register-submit vmail-link-btn">Iniciar sesión</Link>
          </>
        )}

        {estado === 'error' && (
          <>
            <div className="vmail-icon vmail-icon--err" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="var(--error)" strokeWidth="1.8"/>
                <path d="M9 9l10 10M19 9L9 19" stroke="var(--error)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="register-title">El link expiró</h1>
            <p role="status" className="vmail-subtitle">Este link ya no es válido. Pedí uno nuevo:</p>
            <ResendForm email={email} onChange={setEmail} onSubmit={handleResend}
              reenviando={reenviando} reenviado={reenviado} />
            <p className="register-footer"><Link to="/login">Volver al inicio de sesión</Link></p>
          </>
        )}

        {estado === 'pendiente' && (
          <>
            <div className="vmail-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="3" y="7" width="22" height="15" rx="2.5" stroke="var(--primary)" strokeWidth="1.8"/>
                <path d="M3 10l11 7.5L25 10" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="register-title">Revisá tu email</h1>
            <p role="status" className="vmail-subtitle">
              {emailInicial
                ? <>Te mandamos un link a <strong>{emailInicial}</strong>. Hacé clic para confirmar tu cuenta.</>
                : 'Te mandamos un link de verificación. Hacé clic para confirmar tu cuenta.'}
            </p>
            <p className="vmail-hint">¿No llegó? Revisá spam o pedí uno nuevo:</p>
            <ResendForm email={email} onChange={setEmail} onSubmit={handleResend}
              reenviando={reenviando} reenviado={reenviado} />
            <p className="register-footer"><Link to="/login">Volver al inicio de sesión</Link></p>
          </>
        )}
      </div>
    </main>
  )
}

function ResendForm({ email, onChange, onSubmit, reenviando, reenviado }: {
  email: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  reenviando: boolean
  reenviado: boolean
}) {
  if (reenviado) {
    return <p role="status" className="vmail-reenviado">Listo, revisá tu bandeja de entrada.</p>
  }
  return (
    <form className="vmail-resend" onSubmit={onSubmit}>
      <div className="register-field">
        <label htmlFor="resend-email">Email</label>
        <input
          id="resend-email"
          type="email"
          value={email}
          onChange={e => onChange(e.target.value)}
          placeholder="tu@email.com"
          required
          autoComplete="email"
        />
      </div>
      <button type="submit" disabled={reenviando} className="register-submit">
        {reenviando ? 'Enviando…' : 'Reenviar link'}
      </button>
    </form>
  )
}
