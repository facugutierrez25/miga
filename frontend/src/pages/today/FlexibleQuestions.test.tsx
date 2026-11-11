import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { FlexibleQuestions } from './FlexibleQuestions'
import { answerFlexible, type EntryItemDto } from '../../api/records'

vi.mock('../../api/records', () => ({ answerFlexible: vi.fn() }))

const item: EntryItemDto = {
  id: 7, food: 'jamón', quantity: 60, unit: 'g', foodGroupId: 1, portions: 1,
  origin: 'REGLA', uncertain: false, ruleType: 'PREGUNTAR', ruleSource: 'CATALOGO',
}

test.each([true, false])('guarda la respuesta flexible y actualiza los ítems (%s)', async flexible => {
  const result = { replacedItemIds: [7], items: [{ ...item, ruleType: flexible ? 'FLEXIBLE' as const : 'NORMAL' as const,
    ruleSource: 'USUARIO' as const }], status: flexible ? 'FLEXIBLE' as const : 'REGISTRADA' as const }
  vi.mocked(answerFlexible).mockResolvedValue(result)
  const onSaved = vi.fn()
  const view = render(<FlexibleQuestions items={[item]} token="token" date="2026-11-11" onSaved={onSaved} />)
  expect(screen.getByText('¿Tu plan cuenta «jamón» como comida flexible?')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: flexible ? 'Sí' : 'No' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(result))
  expect(answerFlexible).toHaveBeenLastCalledWith('token', '2026-11-11', 7, flexible)
  view.rerender(<FlexibleQuestions items={result.items} token="token" date="2026-11-11" onSaved={onSaved} />)
  expect(screen.queryByText(/¿Tu plan cuenta/)).not.toBeInTheDocument()
})

test('permite reintentar cuando falla la respuesta', async () => {
  vi.mocked(answerFlexible).mockRejectedValue(new Error('offline'))
  render(<FlexibleQuestions items={[item]} token="token" date="2026-11-11" onSaved={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Sí' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la respuesta')
  expect(screen.getByRole('button', { name: 'Sí' })).toBeEnabled()
})
