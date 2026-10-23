import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, test, expect, afterEach } from 'vitest'
import AppLayout from './AppLayout'
import * as AuthContext from '../auth/AuthContext'

vi.mock('../auth/AuthContext')
vi.mocked(AuthContext.useAuth).mockReturnValue({ token: 'tok', email: 'u@test.com', firstName: null, login: vi.fn(), setFirstName: vi.fn(), logout: vi.fn() })

afterEach(() => {
  vi.clearAllMocks()
})

function renderConRuta(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/hoy"     element={<div>Hoy</div>}     />
          <Route path="/semana"  element={<div>Semana</div>}  />
          <Route path="/compras" element={<div>Compras</div>} />
          <Route path="/perfil"  element={<div>Perfil</div>}  />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

test('muestra los 4 ítems de navegación', () => {
  renderConRuta('/hoy')
  expect(screen.getByRole('link', { name: /hoy/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /semana/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /compras/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /perfil/i })).toBeInTheDocument()
})

test('marca con aria-current el ítem activo', () => {
  renderConRuta('/hoy')
  expect(screen.getByRole('link', { name: /hoy/i })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: /semana/i })).not.toHaveAttribute('aria-current')
})

test('navega a Semana al hacer clic', () => {
  renderConRuta('/hoy')
  fireEvent.click(screen.getByRole('link', { name: /semana/i }))
  expect(screen.getByRole('link', { name: /semana/i })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: /hoy/i })).not.toHaveAttribute('aria-current')
})

test('navega a Perfil al hacer clic', () => {
  renderConRuta('/hoy')
  fireEvent.click(screen.getByRole('link', { name: /perfil/i }))
  expect(screen.getByRole('link', { name: /perfil/i })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: /hoy/i })).not.toHaveAttribute('aria-current')
})
