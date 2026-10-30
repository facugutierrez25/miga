import { createContext, useContext } from 'react'

export interface AuthContextValue {
  token: string | null
  email: string | null
  firstName: string | null
  login: (token: string, firstName: string | null) => void
  setFirstName: (name: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
