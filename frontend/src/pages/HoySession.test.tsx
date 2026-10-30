import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { useAuth } from '../auth/authTypes'
import PrivateRoute from '../auth/PrivateRoute'
import HoyPage from './HoyPage'

afterEach(() => vi.unstubAllGlobals())

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  return <button onClick={() => { login('a.eyJzdWIiOiJhbmFAbWlnYS51eSJ9.b', 'Ana'); navigate('/today') }}>Entrar</button>
}

test('un 401 al guardar Hoy vence la sesión y redirige al login vía AuthContext', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return new Response('{}', { status: 401 })
    const data = input.includes('my-plan') ? { foodGroups: [], meals: [{ id: 1, name: 'Desayuno', displayOrder: 1, portions: [] }] }
      : input.includes('sugerencias') ? ['mate'] : { date: '2026-10-30', meals: [], summary: [] }
    return new Response(JSON.stringify(data), { status: 200 })
  }))
  render(<MemoryRouter><AuthProvider><Routes>
    <Route path="/" element={<Login />} />
    <Route path="/today" element={<PrivateRoute><HoyPage /></PrivateRoute>} />
    <Route path="/login" element={<p>Login</p>} />
  </Routes></AuthProvider></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByText('Desayuno')
  const toggle = screen.getByRole('button', { name: 'Anotar' })
  if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle)
  fireEvent.click(await screen.findByRole('button', { name: 'mate' }))
  expect(await screen.findByText('Login')).toBeInTheDocument()
})
