import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import OnboardingPage from './OnboardingPage'

vi.mock('../auth/authTypes', () => ({ useAuth: () => ({ firstName: 'Ana', token: 'token' }) }))

test('lleva el foco al título al avanzar y volver entre pasos', () => {
  render(<MemoryRouter><OnboardingPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Empezar' }))
  expect(screen.getByRole('heading', { name: '¿Cuántas comidas tiene tu plan?' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(screen.getByRole('heading', { name: '¿Cómo se llaman tus comidas?' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))
  expect(screen.getByRole('heading', { name: '¿Cuántas comidas tiene tu plan?' })).toHaveFocus()
})
