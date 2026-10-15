import { createContext, useContext, useState } from 'react'

interface AuthContextValue {
  token: string | null
  email: string | null
  login: (token: string) => void
  logout: () => void
}

function emailFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.sub ?? null
  } catch {
    return null
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token')
  )
  const [email, setEmail] = useState<string | null>(
    () => {
      const t = localStorage.getItem('token')
      return t ? emailFromToken(t) : null
    }
  )

  function login(newToken: string) {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setEmail(emailFromToken(newToken))
  }

  function logout() {
    localStorage.removeItem('token')
    setToken(null)
    setEmail(null)
  }

  return (
    <AuthContext.Provider value={{ token, email, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
