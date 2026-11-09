import { expect, test } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useDialogFocus } from './useDialogFocus'

function Dialog() {
  const ref = useDialogFocus<HTMLDivElement>(() => {})
  return <>
    <button type="button">Detrás</button>
    <div ref={ref} role="dialog" aria-modal="true">
      <h2 tabIndex={-1}>Título</h2>
      <button type="button">Primero</button>
      <button type="button">Último</button>
    </div>
  </>
}

test.each([[true, 'Último'], [false, 'Primero']])('con el foco en el título, Tab sigue dentro del diálogo (shift: %s)', (shiftKey, expected) => {
  render(<Dialog />)
  screen.getByRole('heading', { name: 'Título' }).focus()
  fireEvent.keyDown(document, { key: 'Tab', shiftKey })
  expect(screen.getByRole('button', { name: expected })).toHaveFocus()
})
