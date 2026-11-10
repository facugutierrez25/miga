import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import BottomSheet from './BottomSheet'

function Example() {
  const [open, setOpen] = useState(false)
  return <><button onClick={() => setOpen(true)}>Abrir</button>{open && <BottomSheet title="Detalle" onClose={() => setOpen(false)}>
    <button>Acción</button><button disabled>Deshabilitado</button>
  </BottomSheet>}</>
}

test('atrapa el foco y Escape lo devuelve al disparador', async () => {
  const user = userEvent.setup()
  render(<Example />)
  const trigger = screen.getByRole('button', { name: 'Abrir' })
  await user.click(trigger)
  expect(screen.getByRole('dialog', { name: 'Detalle' })).toHaveAttribute('aria-modal', 'true')
  const close = screen.getByRole('button', { name: 'Cerrar' })
  expect(close).toHaveFocus()
  await user.tab({ shift: true })
  expect(screen.getByRole('button', { name: /Acci/ })).toHaveFocus()
  await user.tab()
  expect(close).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

test('cierra con el fondo y el bot\u00f3n, conserva clics internos', async () => {
  const user = userEvent.setup()
  render(<Example />)
  const trigger = screen.getByRole('button', { name: 'Abrir' })
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: /Acci/ }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await user.click(screen.getByRole('dialog').parentElement!)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})
