import { createContext, useContext, useState } from 'react'

interface AuthContextValue {
  token: string | null
  email: string | null
  firstName: string | null
  login: (token: string, firstName: string | null) => void
  setFirstName: (name: string) => void
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
  const [firstName, setFirstNameState] = useState<string | null>(
    () => localStorage.getItem('firstName')
  )

  function login(newToken: string, newFirstName: string | null) {
    localStorage.setItem('token', newToken)
    if (newFirstName) {
      localStorage.setItem('firstName', newFirstName)
    } else {
      localStorage.removeItem('firstName')
    }
    setToken(newToken)
    setEmail(emailFromToken(newToken))
    setFirstNameState(newFirstName)
  }

  function setFirstName(name: string) {
    localStorage.setItem('firstName', name)
    setFirstNameState(name)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('firstName')
    setToken(null)
    setEmail(null)
    setFirstNameState(null)
  }

  return (
    <AuthContext.Provider value={{ token, email, firstName, login, setFirstName, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
