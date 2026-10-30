import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import PerfilPage from './PerfilPage'
import * as AuthContext from '../auth/authTypes'

vi.mock('../auth/authTypes')

const mockLogout = vi.fn()

beforeEach(() => {
  vi.mocked(AuthContext.useAuth).mockReturnValue({
    token: 'tok',
    email: 'facu@miga.uy',
    firstName: null,
    login: vi.fn(),
    setFirstName: vi.fn(),
    logout: mockLogout,
  })
})

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
  localStorage.removeItem('theme')
  vi.clearAllMocks()
})

function renderPerfil() {
  return render(
    <MemoryRouter>
      <PerfilPage />
    </MemoryRouter>
  )
}

test('muestra el email del usuario', () => {
  renderPerfil()
  expect(screen.getByText('facu@miga.uy')).toBeInTheDocument()
})

test('seleccionar Oscuro aplica data-theme="dark" en el html', () => {
  renderPerfil()
  fireEvent.click(screen.getByLabelText('Oscuro'))
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
})

test('seleccionar Claro aplica data-theme="light" en el html', () => {
  renderPerfil()
  fireEvent.click(screen.getByLabelText('Claro'))
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
})

test('seleccionar Automático elimina data-theme del html', () => {
  localStorage.setItem('theme', 'dark')
  document.documentElement.setAttribute('data-theme', 'dark')
  renderPerfil()
  fireEvent.click(screen.getByLabelText('Automático'))
  expect(document.documentElement).not.toHaveAttribute('data-theme')
})

test('cerrar sesión llama a logout', () => {
  renderPerfil()
  fireEvent.click(screen.getByText('Cerrar sesión'))
  expect(mockLogout).toHaveBeenCalled()
})
