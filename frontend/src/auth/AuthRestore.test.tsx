import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { useAuth } from './authTypes'

// Sesión persistente (ADR 0004, issue #296): al abrir la app se restaura la sesión
// con el refresh token de la cookie HttpOnly; nunca se guarda un token en el navegador.
const RESTORED = 'a.eyJzdWIiOiJhbmFAbWlnYS51eSJ9.b'
const TYPED = 'c.eyJzdWIiOiJsdWNpYUBtaWdhLnV5In0.d'

function Consumer() {
  const auth = useAuth()
  return (
    <>
      <p>{auth.restoring ? 'restaurando' : auth.token ? `con sesión ${auth.email} ${auth.firstName}` : 'sin sesión'}</p>
      <button type="button" onClick={() => auth.login(TYPED, 'Lucía')}>Ingresar</button>
      <button type="button" onClick={() => auth.logout()}>Salir</button>
    </>
  )
}

let fetchMock: ReturnType<typeof vi.fn>

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('restaura la sesión con la cookie al abrir la app', async () => {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/api/v1/auth/refresh')) return json({ token: RESTORED })
    if (url.endsWith('/api/v1/users/me')) return json({ email: 'ana@miga.uy', firstName: 'Ana', lastName: null, birthDate: null })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<AuthProvider><Consumer /></AuthProvider>)
  expect(screen.getByText('restaurando')).toBeInTheDocument()

  expect(await screen.findByText('con sesión ana@miga.uy Ana')).toBeInTheDocument()
  const [, init] = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/v1/auth/refresh'))!
  expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
  expect(Object.keys(localStorage)).toHaveLength(0)
  expect(Object.keys(sessionStorage)).toHaveLength(0)
})

test('sin cookie válida queda sin sesión y deja de restaurar', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))

  render(<AuthProvider><Consumer /></AuthProvider>)

  expect(await screen.findByText('sin sesión')).toBeInTheDocument()
})

test('si la persona inicia sesión mientras se restaura, gana su sesión', async () => {
  let resolveRefresh: (r: Response) => void = () => {}
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    if (String(input).endsWith('/api/v1/auth/refresh')) return new Promise<Response>(r => { resolveRefresh = r })
    return Promise.resolve(json({ email: 'ana@miga.uy', firstName: 'Ana', lastName: null, birthDate: null }))
  }))

  render(<AuthProvider><Consumer /></AuthProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  await act(async () => { resolveRefresh(json({ token: RESTORED })) })

  await waitFor(() => expect(screen.getByText('con sesión lucia@miga.uy Lucía')).toBeInTheDocument())
})

test('cerrar sesión revoca el refresh token del dispositivo', async () => {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/api/v1/auth/refresh')) return json({ token: RESTORED })
    if (url.endsWith('/api/v1/users/me')) return json({ email: 'ana@miga.uy', firstName: 'Ana', lastName: null, birthDate: null })
    return new Response(null, { status: 204 })
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<AuthProvider><Consumer /></AuthProvider>)
  await screen.findByText('con sesión ana@miga.uy Ana')
  fireEvent.click(screen.getByRole('button', { name: 'Salir' }))

  expect(screen.getByText('sin sesión')).toBeInTheDocument()
  await waitFor(() => {
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/v1/auth/logout'))
    expect(call?.[1]).toMatchObject({ method: 'POST', credentials: 'include' })
  })
})
