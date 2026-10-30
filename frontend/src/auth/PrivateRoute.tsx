import { Navigate } from 'react-router-dom'
import { useAuth } from './authTypes'

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/login" replace />
}
