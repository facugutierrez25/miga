import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import RegisterPage from './RegisterPage'
import * as usersApi from '../api/users'

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  )
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders email and password fields', () => {
    renderPage()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument()
  })

  it('calls register and redirects on success', async () => {
    const user = userEvent.setup()
    vi.spyOn(usersApi, 'register').mockResolvedValue()
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'facu@miga.uy')
    await user.type(screen.getByLabelText('Contraseña'), 'Segura1234!')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() => {
      expect(usersApi.register).toHaveBeenCalledWith('facu@miga.uy', 'Segura1234!')
    })
  })

  it('shows error message when email is already registered', async () => {
    const user = userEvent.setup()
    vi.spyOn(usersApi, 'register').mockRejectedValue(new Error('Este email ya está registrado.'))
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'duplicado@miga.uy')
    await user.type(screen.getByLabelText('Contraseña'), 'Segura1234!')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Este email ya está registrado.')
    })
  })

  it('shows error message on generic failure', async () => {
    const user = userEvent.setup()
    vi.spyOn(usersApi, 'register').mockRejectedValue(new Error('Error al registrarse. Revisá los datos.'))
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'facu@miga.uy')
    await user.type(screen.getByLabelText('Contraseña'), 'Segura1234!')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error al registrarse. Revisá los datos.')
    })
  })

  it('disables submit button while loading', async () => {
    const user = userEvent.setup()
    vi.spyOn(usersApi, 'register').mockImplementation(() => new Promise(() => {}))
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'facu@miga.uy')
    await user.type(screen.getByLabelText('Contraseña'), 'Segura1234!')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled()
  })
})
