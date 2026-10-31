import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'

export default function ComprasPage() {
  useTitle('Compras | Miga')
  return (
    <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Brand size={26} />
      </div>
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>Compras</h1>
      <p style={{ color: 'var(--muted)' }}>Muy pronto.</p>
    </div>
  )
}
