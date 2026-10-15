import { Link } from 'react-router-dom'
import Brand from '../components/Brand'
import { useAuth } from '../auth/AuthContext'

export default function HoyPage() {
  const { email } = useAuth()
  const nombre = email?.split('@')[0] ?? ''

  return (
    <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Brand size={26} />
      </div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Hola, {nombre}</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Acá vas a ver tu día. Próximamente.
      </p>
      <Link
        to="/mi-plan"
        style={{
          display: 'inline-block',
          padding: '12px 20px',
          borderRadius: 'var(--radius-control)',
          background: 'var(--primary)',
          color: 'var(--on-primary)',
          fontWeight: 700,
          textDecoration: 'none',
          fontSize: 15,
        }}
      >
        Ver mi plan
      </Link>
    </div>
  )
}
