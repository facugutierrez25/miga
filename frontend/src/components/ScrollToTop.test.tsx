import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import ScrollToTop from './ScrollToTop'

test('lleva el foco al título al navegar y al main si no hay título', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  render(
    <MemoryRouter initialEntries={['/first']}>
      <ScrollToTop />
      <Link to="/second">Segunda pantalla</Link>
      <Routes>
        <Route path="/first" element={<main>
          <header style={{ display: 'none' }}><h1>Título de celular</h1></header>
          <h1>Primera</h1>
        </main>} />
        <Route path="/second" element={<main>Segunda</main>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByRole('heading')).toHaveFocus()
  fireEvent.click(screen.getByRole('link'))
  expect(screen.getByRole('main')).toHaveFocus()
  vi.restoreAllMocks()
})
