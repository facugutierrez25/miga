import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import StatusChip from './StatusChip'
import { mealStatus } from '../lib/mealStatus'

test.each(['EN_PLAN', 'CASI', 'DE_MAS', 'MIXED', 'PREGUNTAR', 'REGISTRADA', 'SIN_ANOTAR', 'FLEXIBLE'])(
  'comparte la etiqueta de %s', status => {
    render(<StatusChip status={status} />)
    expect(screen.getByText(mealStatus({ status, noteText: null }).label)).toHaveClass('status-chip')
  },
)

test('flexible usa el acento', () => {
  render(<StatusChip status="FLEXIBLE" />)
  expect(screen.getByText('Flexible')).toHaveClass('status-chip--flexible')
})
