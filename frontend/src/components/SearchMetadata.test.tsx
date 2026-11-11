import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Link } from 'react-router-dom'
import { expect, test } from 'vitest'
import SearchMetadata from './SearchMetadata'

test('mantiene la canónica solo en portada al navegar sin recargar', () => {
  render(<MemoryRouter><SearchMetadata /><Link to="/login">Ingreso</Link><Link to="/">Inicio</Link></MemoryRouter>)
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://miga.uy/')
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index,follow')
  fireEvent.click(screen.getByText('Ingreso'))
  expect(document.querySelector('link[rel="canonical"]')).toBeNull()
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  fireEvent.click(screen.getByText('Inicio'))
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://miga.uy/')
  document.querySelector('link[rel="canonical"]')?.remove()
  document.querySelector('meta[name="robots"]')?.remove()
})
