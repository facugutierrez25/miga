import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import Segmented from './Segmented'

function Example() {
  const [value, setValue] = useState('a')
  return <><Segmented label="Vista" options={[{ value: 'a', label: 'Uno' }, { value: 'b', label: 'Dos' }, { value: 'c', label: 'Tres' }]}
    value={value} onChange={setValue} /><button>Salir</button></>
}

test('elige con clic y recorre las opciones con flechas en ambos sentidos', async () => {
  const user = userEvent.setup()
  render(<Example />)
  expect(screen.getByRole('radiogroup', { name: 'Vista' })).toBeInTheDocument()
  const first = screen.getByRole('radio', { name: 'Uno' })
  const last = screen.getByRole('radio', { name: 'Tres' })
  await user.tab()
  expect(first).toHaveFocus()
  await user.keyboard('{ArrowLeft}')
  expect(last).toBeChecked()
  expect(last).toHaveFocus()
  await user.keyboard('{ArrowRight}{ArrowDown}')
  expect(screen.getByRole('radio', { name: 'Dos' })).toBeChecked()
  await user.keyboard('{ArrowUp}')
  expect(first).toBeChecked()
  await user.click(last)
  expect(last).toBeChecked()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Salir' })).toHaveFocus()
})
