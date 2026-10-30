import { useEffect, useState, type ReactNode } from 'react'
import { onUnauthorizedResponse } from '../api/client'
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
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [firstName, setFirstNameState] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    if (!token) return
    return onUnauthorizedResponse(token, () => {
      setToken(null)
      setEmail(null)
      setFirstNameState(null)
      setSessionExpired(true)
    })
  }, [token])

  function login(newToken: string, newFirstName: string | null) {
    setToken(newToken)
    setSessionExpired(false)
    setEmail(emailFromToken(newToken))
    setFirstNameState(newFirstName)
  }

  function setFirstName(name: string) {
    setFirstNameState(name)
  }

  function logout() {
    setToken(null)
    setEmail(null)
    setFirstNameState(null)
  }

  const value: AuthContextValue = { token, email, firstName, sessionExpired, login, setFirstName, logout }
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
