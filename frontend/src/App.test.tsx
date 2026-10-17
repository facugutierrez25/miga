import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('muestra la landing cuando no hay sesión', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /Cumplí el plan/ })).toBeInTheDocument()
  })
})
