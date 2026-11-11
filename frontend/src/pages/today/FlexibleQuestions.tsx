import { useRef, useState } from 'react'
import { answerFlexible, type EntryItemDto, type PatchItemResultDto } from '../../api/records'

interface Props {
  items: EntryItemDto[]
  token: string
  date: string
  onSaved: (result: PatchItemResultDto) => void
}

export function FlexibleQuestions({ items, token, date, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const questions = items.filter((item, index) => item.ruleType === 'PREGUNTAR' && item.ruleSource === 'CATALOGO'
    && items.findIndex(other => other.food === item.food && other.ruleType === 'PREGUNTAR' && other.ruleSource === 'CATALOGO') === index)

  async function handleAnswer(item: EntryItemDto, flexible: boolean) {
    if (pending.current) return
    pending.current = true
    setSaving(true)
    setError(null)
    try {
      onSaved(await answerFlexible(token, date, item.id, flexible))
    } catch {
      setError('No se pudo guardar la respuesta. Intentá de nuevo.')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return <>
    {questions.map(item => <div key={item.id} className="nota-pregunta pregunta">
      <span className="nota-pregunta__texto">¿Tu plan cuenta «{item.food}» como comida flexible?</span>
      <div className="nota-pregunta__acciones">
        <button disabled={saving} className="nota-pregunta__si" onClick={() => handleAnswer(item, true)}>Sí</button>
        <button disabled={saving} className="nota-pregunta__no" onClick={() => handleAnswer(item, false)}>No</button>
      </div>
    </div>)}
    {error && <p className="nota-error" role="alert">{error}</p>}
  </>
}
