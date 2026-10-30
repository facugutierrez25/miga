import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { useAuth } from './authTypes'

const TOKEN = 'a.eyJzdWIiOiJ4QG1pZ2EudXkifQ.b'

function Consumer() {
  const auth = useAuth()
  return (
    <>
      <p>{auth.token ? 'con sesión' : auth.sessionExpired ? 'sesión vencida' : 'sin sesión'}</p>
      <button type="button" onClick={() => auth.login(TOKEN, 'Ana')}>Ingresar</button>
    </>
  )
}

const responses: number[] = []

beforeEach(() => {
  responses.length = 0
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: responses.shift() ?? 200 })))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderWithSession() {
  render(<AuthProvider><Consumer /></AuthProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

async function authenticatedFetch(path: string) {
  await act(async () => {
    await window.fetch(path, { headers: { Authorization: 'Bearer x' } })
  })
}

test('un 401 en una petición autenticada cierra la sesión una sola vez', async () => {
  renderWithSession()
  responses.push(401, 401)

  await authenticatedFetch('/api/v1/registro/2025-01-01')
  await authenticatedFetch('/api/v1/my-plan')

  expect(screen.getByText('sesión vencida')).toBeInTheDocument()
})

test('un 401 sin token (por ejemplo, el login) no cierra la sesión', async () => {
  renderWithSession()
  responses.push(401)

  await act(async () => {
    await window.fetch('/api/v1/users/login', { method: 'POST' })
  })

  expect(screen.getByText('con sesión')).toBeInTheDocument()
})

test('un 403 o un 409 no cierran la sesión', async () => {
  renderWithSession()
  responses.push(403, 409)

  await authenticatedFetch('/actuator/metrics')
  await authenticatedFetch('/api/v1/my-plan')

  expect(screen.getByText('con sesión')).toBeInTheDocument()
})

test('volver a ingresar limpia el aviso de sesión vencida', async () => {
  renderWithSession()
  responses.push(401)
  await authenticatedFetch('/api/v1/my-plan')
  expect(screen.getByText('sesión vencida')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

  expect(screen.getByText('con sesión')).toBeInTheDocument()
})
