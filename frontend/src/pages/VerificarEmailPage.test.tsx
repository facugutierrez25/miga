import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import * as users from '../api/users'
import VerificarEmailPage from './VerificarEmailPage'

afterEach(() => vi.restoreAllMocks())

test('anuncia el error de reenvío y permite reintentar', async () => {
  vi.spyOn(users, 'resendVerification')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(undefined)
  render(
    <MemoryRouter initialEntries={[{ pathname: '/verificar-email', state: { email: 'user@miga.uy' } }]}>
      <VerificarEmailPage />
    </MemoryRouter>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Reenviar link' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo reenviar')
  fireEvent.click(screen.getByRole('button', { name: 'Reenviar link' }))
  expect(await screen.findByText('Listo, revisá tu bandeja de entrada.')).toHaveAttribute('role', 'status')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('mantiene un título y anuncia la verificación en curso', () => {
  vi.spyOn(users, 'verifyEmail').mockReturnValue(new Promise(() => {}))
  render(
    <MemoryRouter initialEntries={['/verificar-email?token=token']}>
      <VerificarEmailPage />
    </MemoryRouter>
  )
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Verificá tu email')
  expect(screen.getByRole('status')).toHaveTextContent('Verificando tu email')
})
