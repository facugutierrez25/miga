import { useState, type ReactNode } from 'react'
import type { AuthContextValue } from './authTypes'
import { AuthContext } from './authTypes'

function emailFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.sub ?? null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
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

  const value: AuthContextValue = { token, email, firstName, login, setFirstName, logout }
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
