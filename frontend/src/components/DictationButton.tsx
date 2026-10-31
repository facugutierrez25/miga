import { useEffect, useRef, useState } from 'react'

interface Recognition {
  lang: string
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}
export default function DictationButton({ disabled, onTranscript }: {
  disabled: boolean
  onTranscript: (text: string) => void
}) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(false)
  const recognition = useRef<Recognition | null>(null)
  const browser = window as SpeechWindow
  const RecognitionClass = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
  useEffect(() => () => {
    const current = recognition.current
    if (current) {
      current.onresult = current.onend = current.onerror = null
      current.abort()
    }
  }, [])
  if (!RecognitionClass) return null
  function toggle() {
    if (recognition.current) {
      recognition.current.stop()
      return
    }
    const current = new RecognitionClass!()
    recognition.current = current
    current.lang = 'es-UY'
    current.interimResults = false
    current.onresult = event => {
      const text = event.results[0]?.[0]?.transcript.trim()
      if (text) onTranscript(text)
    }
    current.onend = () => { recognition.current = null; setListening(false) }
    current.onerror = () => { recognition.current = null; setListening(false); setError(true) }
    setError(false)
    setListening(true)
    try {
      current.start()
    } catch {
      recognition.current = null
      setListening(false)
      setError(true)
    }
  }
  return <>
    <button type="button" className="dictation-button" disabled={disabled} aria-pressed={listening} onClick={toggle}>
      {listening ? 'Dejar de dictar' : 'Dictar'}
    </button>
    {error && <p role="alert">No se pudo dictar. Podés seguir escribiendo.</p>}
  </>
}
