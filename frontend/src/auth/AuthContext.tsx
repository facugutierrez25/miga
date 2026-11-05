import { useEffect, useRef, useState, type ReactNode } from 'react'
import { onUnauthorizedResponse } from '../api/client'
import { getMe, logoutSession, refreshSession } from '../api/users'
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

// Varias pestañas que abren a la vez usan el mismo refresh token: se serializa el
// refresh para que cada una use la cookie ya rotada por la anterior.
async function restoreSession(): Promise<string | null> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (locks?.request) return locks.request('miga-refresh', () => refreshSession())
  return refreshSession()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [firstName, setFirstNameState] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [restoring, setRestoring] = useState(true)
  // Si la persona inicia sesión mientras se restaura, gana su sesión.
  const touched = useRef(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const restored = await restoreSession()
        if (!restored || !active || touched.current) return
        let name: string | null = null
        try {
          name = (await getMe(restored)).firstName
        } catch {
          return
        }
        if (!active || touched.current) return
        setToken(restored)
        setEmail(emailFromToken(restored))
        setFirstNameState(name)
      } finally {
        if (active) setRestoring(false)
      }
    })()
    return () => { active = false }
  }, [])

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
    touched.current = true
    setRestoring(false)
    setToken(newToken)
    setSessionExpired(false)
    setEmail(emailFromToken(newToken))
    setFirstNameState(newFirstName)
  }

  function setFirstName(name: string) {
    setFirstNameState(name)
  }

  function logout() {
    touched.current = true
    setToken(null)
    setEmail(null)
    setFirstNameState(null)
    void logoutSession()
  }

  const value: AuthContextValue = { token, email, firstName, sessionExpired, restoring, login, setFirstName, logout }
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
