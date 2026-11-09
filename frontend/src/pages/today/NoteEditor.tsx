import DictationButton from '../../components/DictationButton'
import { ActionsMenu } from './ActionsMenu'

interface Props {
  meal: { id?: number; name: string }
  textareaId: string
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  text: string
  editDraft: (update: (current: string) => string) => void
  error: string | null
  loadingSuggestions: boolean
  suggestions: string[]
  hasNote: boolean
  saving: boolean
  conflict: boolean
  handleSave: (value?: string) => Promise<void>
  deleteRef: React.RefObject<HTMLButtonElement | null>
  onConfirmDelete: () => void
  onCancelDelete: () => void
  confirming: boolean
  confirmRef: React.RefObject<HTMLButtonElement | null>
  handleDelete: () => Promise<void>
}

export function NoteEditor({ meal, textareaId, textareaRef, text, editDraft, error, loadingSuggestions,
  suggestions, hasNote, saving, conflict, handleSave, deleteRef, onConfirmDelete, onCancelDelete,
  confirming, confirmRef, handleDelete }: Props) {
  return <>
    <label className="nota-label" htmlFor={textareaId}>¿Qué comiste?</label>
    <textarea
      id={textareaId}
      ref={textareaRef}
      className="nota-textarea"
      maxLength={2000}
      placeholder="Por ejemplo: tarta de zapallitos y ensalada"
      value={text}
      onChange={e => { const value = e.target.value; editDraft(() => value) }}
      rows={2}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `nota-error-${meal.id}` : undefined}
    />

    {!loadingSuggestions && suggestions.length > 0 && !hasNote && (
      <section className="nota-sugerencias" aria-labelledby={`sugerencias-${meal.id}`}>
        <h3 id={`sugerencias-${meal.id}`} className="nota-sugerencias__titulo">Lo de siempre</h3>
        {suggestions.map((s, i) => (
          <button
            key={i}
            className="nota-sugerencia"
            type="button"
            aria-label={`Anotar: ${s}`}
            disabled={saving || conflict}
            onClick={() => void handleSave(s)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            <span>{s}</span>
          </button>
        ))}
      </section>
    )}

    <div className="nota-acciones">
      <button
        className="nota-btn-guardar"
        onClick={() => void handleSave()}
        disabled={saving || conflict || !text.trim()}
      >
        {saving ? 'Guardando…' : hasNote ? 'Guardar cambios' : 'Guardar'}
      </button>
      <DictationButton iconOnly disabled={saving} onTranscript={transcript => {
        editDraft(current => current.trim() ? `${current.trimEnd()} ${transcript}` : transcript)
      }} />
      {hasNote && <ActionsMenu label={`Más opciones de ${meal.name}`} buttonRef={deleteRef} disabled={saving}
        actions={[{ label: 'Borrar lo anotado', onClick: onConfirmDelete }]} />}

    </div>

    {confirming && (
      <div className="nota-confirmar" role="group" aria-labelledby={`confirmar-${meal.id}`}>
        <p id={`confirmar-${meal.id}`}>
          ¿Borrar todo lo anotado en {meal.name}? Se quita la nota y lo que sumó al día.
        </p>
        <div className="nota-confirmar__acciones">
          <button type="button" ref={confirmRef} className="nota-btn-confirmar" disabled={saving}
            onClick={() => void handleDelete()}>
            Borrar
          </button>
          <button type="button" className="nota-btn-cancelar"
            onClick={onCancelDelete}>
            Cancelar
          </button>
        </div>
      </div>
    )}

  </>
}
