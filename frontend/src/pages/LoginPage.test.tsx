import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import * as users from '../api/users'
import LoginPage from './LoginPage'

vi.mock('../auth/authTypes', () => ({ useAuth: () => ({ login: vi.fn(), sessionExpired: false }) }))
afterEach(() => vi.restoreAllMocks())

test('anuncia el fallo de reenvío y el éxito al reintentar', async () => {
  vi.spyOn(users, 'login').mockRejectedValue(new Error('EMAIL_NOT_VERIFIED'))
  vi.spyOn(users, 'resendVerification')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(undefined)
  render(<MemoryRouter><LoginPage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@miga.uy' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Reenviar link de verificación' }))
  expect(await screen.findByText('No se pudo reenviar el link. Probá de nuevo.')).toHaveAttribute('role', 'alert')
  fireEvent.click(screen.getByRole('button', { name: 'Reenviar link de verificación' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Link reenviado')
})
