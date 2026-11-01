import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import PerfilPage from './PerfilPage'
import * as AuthContext from '../auth/authTypes'

vi.mock('../auth/authTypes')
import { deleteMe } from '../api/users'
import LandingPage from './LandingPage'
vi.mock('../api/users')

const mockLogout = vi.fn()

beforeEach(() => {
  vi.mocked(AuthContext.useAuth).mockReturnValue({
    token: 'tok',
    email: 'facu@miga.uy',
    firstName: null,
    login: vi.fn(),
    setFirstName: vi.fn(),
    sessionExpired: false,
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


test('contraseña incorrecta muestra el error y mantiene la sesión', async () => {
  vi.mocked(deleteMe).mockRejectedValueOnce(new Error('Contraseña incorrecta. No se eliminó tu cuenta.'))
  renderPerfil()
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'incorrecta' } })
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta definitivamente' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Contraseña incorrecta')
  expect(mockLogout).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Contraseña actual')).toHaveValue('')
})

test('elimina la cuenta, cierra sesión y vuelve al inicio con mensaje', async () => {
  vi.mocked(deleteMe).mockResolvedValueOnce(undefined)
  mockLogout.mockImplementationOnce(() => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      token: null, email: null, firstName: null, sessionExpired: false,
      login: vi.fn(), setFirstName: vi.fn(), logout: mockLogout,
    })
  })
  render(<MemoryRouter initialEntries={['/perfil']}>
    <Routes>
      <Route path="/perfil" element={<PerfilPage />} />
      <Route path="/" element={<LandingPage />} />
    </Routes>
  </MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'correcta' } })
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta definitivamente' }))
  await waitFor(() => expect(deleteMe).toHaveBeenCalledWith('tok', 'correcta'))
  expect(await screen.findByRole('status')).toHaveTextContent('Tu cuenta y todos tus datos fueron eliminados')
  expect(mockLogout).toHaveBeenCalledTimes(1)
})
