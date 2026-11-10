import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import ProfilePage from './ProfilePage'
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
    firstName: 'Facundo',
    login: vi.fn(),
    setFirstName: vi.fn(),
    sessionExpired: false, restoring: false,
    logout: mockLogout,
  })
})

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
  localStorage.removeItem('theme')
  vi.clearAllMocks()
})

function renderProfile() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  )
}

test('muestra el email del usuario', () => {
  renderProfile()
  expect(screen.getByText('facu@miga.uy')).toBeInTheDocument()
})

test('seleccionar Oscuro aplica data-theme="dark" en el html', () => {
  renderProfile()
  fireEvent.click(screen.getByLabelText('Oscuro'))
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
})

test('seleccionar Claro aplica data-theme="light" en el html', () => {
  renderProfile()
  fireEvent.click(screen.getByLabelText('Claro'))
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
})

test('seleccionar Automático elimina data-theme del html', () => {
  localStorage.setItem('theme', 'dark')
  document.documentElement.setAttribute('data-theme', 'dark')
  renderProfile()
  fireEvent.click(screen.getByLabelText('Automático'))
  expect(document.documentElement).not.toHaveAttribute('data-theme')
})

test('cerrar sesión llama a logout', () => {
  renderProfile()
  fireEvent.click(screen.getByText('Cerrar sesión'))
  expect(mockLogout).toHaveBeenCalled()
})


test('contraseña incorrecta muestra el error y mantiene la sesión', async () => {
  vi.mocked(deleteMe).mockRejectedValueOnce(new Error('Contraseña incorrecta. No se eliminó tu cuenta.'))
  renderProfile()
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }))
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
      token: null, email: null, firstName: null, sessionExpired: false, restoring: false,
      login: vi.fn(), setFirstName: vi.fn(), logout: mockLogout,
    })
  })
  render(<MemoryRouter initialEntries={['/perfil']}>
    <Routes>
      <Route path="/perfil" element={<ProfilePage />} />
      <Route path="/" element={<LandingPage />} />
    </Routes>
  </MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }))
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'correcta' } })
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta definitivamente' }))
  await waitFor(() => expect(deleteMe).toHaveBeenCalledWith('tok', 'correcta'))
  expect(await screen.findByRole('status')).toHaveTextContent('Tu cuenta y todos tus datos fueron eliminados')
  expect(mockLogout).toHaveBeenCalledTimes(1)
})

test('la eliminación está plegada y después de cerrar sesión', () => {
  renderProfile()
  const toggle = screen.getByRole('button', { name: 'Eliminar mi cuenta' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cerrar sesión' }).compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument()
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()
})


test('la primera tarjeta muestra nombre y email', () => {
  const { container } = renderProfile()
  const card = container.querySelector('.perfil-card')!
  expect(card).toHaveTextContent('Facundo')
  expect(card).toHaveTextContent('facu@miga.uy')
})

test('los accesos abren Semana con exportación y la página de privacidad', () => {
  render(<MemoryRouter initialEntries={['/perfil']}><Routes>
    <Route path="/perfil" element={<ProfilePage />} />
    <Route path="/semana" element={<p>Semana con exportación</p>} />
    <Route path="/privacidad" element={<p>Página de privacidad</p>} />
  </Routes></MemoryRouter>)
  expect(screen.getByRole('link', { name: /Exportar para tu nutri/ })).toHaveAttribute('href', '/semana?exportar=1')
  fireEvent.click(screen.getByRole('link', { name: 'Privacidad' }))
  expect(screen.getByText('Página de privacidad')).toBeInTheDocument()
})

test('el tema segmentado persiste y se recupera al volver a Perfil', () => {
  const view = renderProfile()
  expect(screen.getAllByRole('radio')).toHaveLength(3)
  fireEvent.click(screen.getByRole('radio', { name: 'Oscuro' }))
  expect(localStorage.getItem('theme')).toBe('dark')
  view.unmount()
  renderProfile()
  expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked()
  fireEvent.click(screen.getByRole('radio', { name: 'Claro' }))
  expect(localStorage.getItem('theme')).toBe('light')
  fireEvent.click(screen.getByRole('radio', { name: 'Automático' }))
  expect(localStorage.getItem('theme')).toBeNull()
})


test('el acceso a exportar navega a Semana', () => {
  render(<MemoryRouter initialEntries={['/perfil']}><Routes>
    <Route path="/perfil" element={<ProfilePage />} />
    <Route path="/semana" element={<p>Semana</p>} />
  </Routes></MemoryRouter>)
  fireEvent.click(screen.getByRole('link', { name: /Exportar para tu nutri/ }))
  expect(screen.getByText('Semana')).toBeInTheDocument()
})

test.each(['Claro', 'Oscuro'])('el acceso para eliminar la cuenta usa la clase de enlace en tema %s', theme => {
  renderProfile()
  fireEvent.click(screen.getByRole('radio', { name: theme }))
  expect(screen.getByRole('button', { name: 'Eliminar mi cuenta' })).toHaveClass('perfil-delete-link')
})
