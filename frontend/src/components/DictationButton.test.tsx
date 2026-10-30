import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import DictationButton from './DictationButton'

afterEach(() => vi.unstubAllGlobals())

test('dictado agrega texto, informa escucha y se limpia al desmontar', () => {
  const transcript = vi.fn()
  const start = vi.fn()
  const stop = vi.fn()
  const abort = vi.fn()
  let recognition!: { onresult: (event: unknown) => void; onend: () => void }
  class SpeechRecognition {
    start = start
    stop = stop
    abort = abort
    constructor() { recognition = this as unknown as typeof recognition }
  }
  vi.stubGlobal('SpeechRecognition', SpeechRecognition)
  const { unmount } = render(<DictationButton disabled={false} onTranscript={transcript} />)
  fireEvent.click(screen.getByRole('button', { name: 'Dictar', pressed: false }))
  expect(start).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { pressed: true })).toHaveAccessibleName('Dejar de dictar')
  act(() => recognition.onresult({ results: [[{ transcript: 'pan con queso' }]] }))
  expect(transcript).toHaveBeenCalledWith('pan con queso')
  fireEvent.click(screen.getByRole('button', { pressed: true }))
  expect(stop).toHaveBeenCalledOnce()
  unmount()
  expect(abort).toHaveBeenCalledOnce()
})

test('sin reconocimiento disponible no ofrece dictado', () => {
  vi.stubGlobal('SpeechRecognition', undefined)
  vi.stubGlobal('webkitSpeechRecognition', undefined)
  render(<DictationButton disabled={false} onTranscript={vi.fn()} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('webkit y error de permisos permiten seguir escribiendo', () => {
  let fail!: () => void
  vi.stubGlobal('SpeechRecognition', undefined)
  vi.stubGlobal('webkitSpeechRecognition', class {
    set onerror(handler: () => void) { fail = handler }
    start() { fail() }
    abort() {}
  })
  render(<DictationButton disabled={false} onTranscript={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Dictar' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Podés seguir escribiendo')
  expect(screen.getByRole('button', { name: 'Dictar', pressed: false })).toBeEnabled()
})
