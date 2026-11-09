/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, test, expect, afterEach } from 'vitest'
import AppLayout from './AppLayout'
import * as AuthContext from '../auth/authTypes'

vi.mock('../auth/authTypes')
vi.mocked(AuthContext.useAuth).mockReturnValue({ token: 'tok', email: 'u@test.com', firstName: null, login: vi.fn(), setFirstName: vi.fn(),
    sessionExpired: false, restoring: false, logout: vi.fn() })

afterEach(() => {
  vi.clearAllMocks()
})

function renderWithRoute(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/hoy"     element={<div>Hoy</div>}     />
          <Route path="/semana"  element={<div>Semana</div>}  />
          <Route path="/mi-plan" element={<div>Mi plan</div>} />
          <Route path="/perfil"  element={<div>Perfil</div>}  />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

test('muestra los 4 ítems de navegación', () => {
  renderWithRoute('/hoy')
  expect(screen.getByRole('link', { name: /hoy/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /semana/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /mi plan/i })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /compras/i })).not.toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(4)
  expect(screen.getByRole('link', { name: /perfil/i })).toBeInTheDocument()
})

test('marca con aria-current el ítem activo', () => {
  renderWithRoute('/hoy')
  expect(screen.getByRole('link', { name: /hoy/i })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: /semana/i })).not.toHaveAttribute('aria-current')
})

test('navega a Semana al hacer clic', () => {
  renderWithRoute('/hoy')
  fireEvent.click(screen.getByRole('link', { name: /semana/i }))
  expect(screen.getByRole('link', { name: /semana/i })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: /hoy/i })).not.toHaveAttribute('aria-current')
})

test('navega a Perfil al hacer clic', () => {
  renderWithRoute('/hoy')
  fireEvent.click(screen.getByRole('link', { name: /perfil/i }))
  expect(screen.getByRole('link', { name: /perfil/i })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: /hoy/i })).not.toHaveAttribute('aria-current')
})

test('reserva espacio móvil según las dimensiones de la barra y lo libera en escritorio', async () => {
  const css = readFileSync('src/components/AppLayout.css', 'utf8')
  expect(css).toContain('padding-bottom: calc(var(--nav-clearance) + env(safe-area-inset-bottom, 0px))')
  expect(css).toContain('--nav-clearance: calc(var(--nav-item-height)')
  expect(css).toMatch(/@media \(min-width: 640px\)[\s\S]*padding-bottom: 0/)
})
