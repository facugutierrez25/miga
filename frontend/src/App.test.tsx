import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('muestra la landing cuando no hay sesión', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /Anotá lo que comiste. Miga te dice cómo vas con tu plan/ })).toBeInTheDocument()
  })
})
