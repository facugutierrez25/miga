import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { useAuth } from './authTypes'

const TOKEN = 'a.eyJzdWIiOiJ4QG1pZ2EudXkifQ.b'
const OTHER_TOKEN = 'c.eyJzdWIiOiJ4QG1pZ2EudXkifQ.d'

function Consumer() {
  const auth = useAuth()
  return (
    <>
      <p>{auth.token ? 'con sesión' : auth.sessionExpired ? 'sesión vencida' : 'sin sesión'}</p>
      <button type="button" onClick={() => auth.login(TOKEN, 'Ana')}>Ingresar</button>
      <button type="button" onClick={() => auth.login(OTHER_TOKEN, 'Ana')}>Ingresar otra vez</button>
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

async function authenticatedFetch(path: string, token = TOKEN) {
  await act(async () => {
    await window.fetch(path, { headers: { Authorization: `Bearer ${token}` } })
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

test('un 401 de una petición con el token anterior no cierra la sesión nueva', async () => {
  renderWithSession()
  responses.push(401)
  await authenticatedFetch('/api/v1/my-plan')
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar otra vez' }))
  responses.push(401)

  await authenticatedFetch('/api/v1/registro/2025-01-01', TOKEN)

  expect(screen.getByText('con sesión')).toBeInTheDocument()
})

test('un 401 que llega después de volver a ingresar no cierra la sesión nueva', async () => {
  let resolveLate: (res: Response) => void = () => {}
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { resolveLate = resolve })))
  renderWithSession()

  const pending = window.fetch('/api/v1/my-plan', { headers: { Authorization: `Bearer ${TOKEN}` } })
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar otra vez' }))
  await act(async () => {
    resolveLate(new Response(null, { status: 401 }))
    await pending
  })

  expect(screen.getByText('con sesión')).toBeInTheDocument()
})
