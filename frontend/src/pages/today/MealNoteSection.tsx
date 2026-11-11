import { MealQuestions } from './MealQuestions'
import { FlexibleQuestions } from './FlexibleQuestions'
import {
  ItemOrigin,
  NoteConflictError,
  saveNote,
  deleteNote,
  removeItem,
  saveAnswer,
  getSuggestions,
  type DayRecordDto,
  type MealDayDto,
  type EntryItemDto,
  type NoteInterpretationDto,
  type PatchItemResultDto,
} from '../../api/records'
import { NoteEditor } from './NoteEditor'
import { UnderstoodSheet, UnderstoodItems } from './UnderstoodSheet'
import { fmt, type GroupInfo } from './helpers'
import { mealStatus } from '../../lib/mealStatus'
import { useEffect, useLayoutEffect, useRef, useState, memo } from 'react'
import { type MealDto } from '../../api/plans'
// El borrador vive fuera del editor para conservarse al cambiar de comida.
export interface Draft {
  text: string
  baseVersion: number | null
  dirty: boolean
  conflict: boolean
}

export type DraftStore = Map<string, Draft>

export interface MealNoteSectionProps {
  meal: MealDto
  drafts: DraftStore
  mealDay: MealDayDto | undefined
  date: string
  token: string
  groupsMap: Record<number, GroupInfo>
  onToast?: (message: string | null) => void
  onNoteSaved: (interp: NoteInterpretationDto, mealId: number, submittedText?: string) => void
  onItemPatched: (mealId: number, result: PatchItemResultDto) => void
  onNoteDeleted: (mealId: number, version: number | null, submittedText: string) => void
  onReload: () => Promise<DayRecordDto>
  onAnswerSaved: (mealId: number) => Promise<void>
}

export const MealNoteSection = memo(function MealNoteSection({
  meal, drafts, mealDay, date, token, groupsMap,
  onNoteSaved, onItemPatched, onNoteDeleted, onAnswerSaved, onReload, onToast,
}: MealNoteSectionProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [resolveTarget, setResolveTarget] = useState<EntryItemDto | null>(null)
  const [expandedMentions, setExpandedMentions] = useState<Set<string>>(() => new Set())
  const draftKey = `${date}-${meal.id}`
  const [saved] = useState(() => drafts.get(draftKey))
  const [text, setText] = useState(saved?.dirty ? saved.text : mealDay?.noteText ?? '')
  const dirty = useRef(saved?.dirty ?? false)
  const [editing, setEditing] = useState(saved?.dirty ?? false)
  const draftRevision = useRef(0)
  // Versión de la nota sobre la que se empezó el borrador: una recarga automática
  // no la cambia, así guardar un borrador viejo sigue dando conflicto.
  const baseVersion = useRef<number | null>(saved ? saved.baseVersion : mealDay?.noteVersion ?? null)
  const [conflict, setConflict] = useState(saved?.conflict ?? false)

  useEffect(() => {
    drafts.set(draftKey, { text, baseVersion: baseVersion.current, dirty: dirty.current, conflict })
  })
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const [saving, setSaving] = useState(false)
  const showToast = (message: string | null) => onToast?.(message)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [confirming, setConfirming] = useState(false)
  const deleteRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const understoodRef = useRef<HTMLHeadingElement>(null)
  const pendingFocus = useRef<'confirmar' | 'borrar' | 'textarea' | 'understood' | null>(null)

  const hasNote = !!mealDay?.noteText
  const items = mealDay?.items ?? []
  const comparison = mealDay?.comparison ?? []
  const hasRecordedPortions = comparison.some(group => group.recorded > 0)
  // Las respuestas guardadas se ocultan hasta que llega la comparación nueva, aunque falle la recarga.
  const [answered, setAnswered] = useState<{ source: unknown; groupIds: number[] }>({ source: null, groupIds: [] })
  const answeredGroups = answered.source === mealDay?.comparison ? answered.groupIds : []
  const answerPending = useRef(false)
  const [answerSaving, setAnswerSaving] = useState(false)
  const questions = comparison.filter(s => s.status === 'PREGUNTAR' && !answeredGroups.includes(s.foodGroupId))
  const differences = comparison.filter(group =>
    (['CASI', 'SIN_ANOTAR'].includes(group.status) && group.expected > group.recorded)
    || (group.status === 'DE_MAS' && group.recorded > group.expected))
    .sort((a, b) => Number(a.status === 'DE_MAS') - Number(b.status === 'DE_MAS'))


  useLayoutEffect(() => {
    if (!dirty.current) {
      setText(mealDay?.noteText ?? '')
      baseVersion.current = mealDay?.noteVersion ?? null
    } else if (drafts.get(draftKey)?.baseVersion === mealDay?.noteVersion) {
      // Adoptar la reconciliación antes de persistir las refs de este editor.
      const shared = drafts.get(draftKey)!
      baseVersion.current = shared.baseVersion
      dirty.current = shared.dirty
      setText(shared.text)
      setEditing(shared.dirty)
    }
  }, [mealDay?.noteText, mealDay?.noteVersion, drafts, draftKey])

  useEffect(() => {
    if (!meal.id) return
    const controller = new AbortController()
    getSuggestions(token, meal.id!, controller.signal)
      .then(s => { if (!controller.signal.aborted) setSuggestions(s) })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoadingSuggestions(false) })
    return () => controller.abort()
  }, [meal.id, token])

  const saveInFlight = useRef(false)
  // Cada edición del borrador (teclado o dictado) sube la revisión: si cambia mientras se
  // guarda, el borrador sigue marcado como modificado y la respuesta no lo reemplaza.
  function editDraft(update: (current: string) => string) {
    setEditing(true)
    dirty.current = true
    draftRevision.current += 1
    showToast(null)
    setText(update)
  }

  // El foco se consume después de actualizar el DOM, sin efectos pendientes del render anterior.
  useLayoutEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    if (target === 'confirmar') confirmRef.current?.focus()
    else if (target === 'borrar') deleteRef.current?.focus()
    else if (target === 'understood') understoodRef.current?.focus()
    else textareaRef.current?.focus()
  })

  async function handleRemove(item: EntryItemDto) {
    if (saveInFlight.current || conflict) return
    saveInFlight.current = true
    setSaving(true)
    setError(null)
    showToast(null)
    try {
      const updated = await removeItem(token, date, item.id, baseVersion.current)
      baseVersion.current = updated.noteVersion
      if (!dirty.current) setText(updated.noteText ?? '')
      setConflict(false)
      pendingFocus.current = updated.items.length ? 'understood' : 'textarea'
      if (updated.items.length === 0) setDetailOpen(false)
      onNoteSaved({ status: updated.status, noteId: updated.noteId!, version: updated.noteVersion!, text: updated.noteText ?? '',
        date, mealId: updated.mealId, items: [], entries: updated.items, comparison: updated.comparison }, updated.mealId)
      showToast(`Quitaste ${item.food}.`)
    } catch (err) {
      setConflict(err instanceof NoteConflictError)
      setError(err instanceof NoteConflictError ? err.message : 'No se pudo quitar. Intentá de nuevo.')
    } finally {
      saveInFlight.current = false
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!meal.id || saveInFlight.current) return
    saveInFlight.current = true
    setSaving(true)
    setError(null)
    showToast(null)
    const submittedRevision = draftRevision.current
    const submittedText = text
    try {
      const version = await deleteNote(token, date, meal.id, baseVersion.current)
      baseVersion.current = version
      // Lo que se escribió mientras se borraba es un borrador nuevo y se conserva.
      if (draftRevision.current === submittedRevision) {
        dirty.current = false
        draftRevision.current += 1
        setText('')
      }
      setConflict(false)
      setConfirming(false)
      showToast(`Borraste lo anotado en ${meal.name}.`)
      pendingFocus.current = 'textarea'
      onNoteDeleted(meal.id, version, submittedText)
    } catch (err) {
      setConfirming(false)
      setConflict(err instanceof NoteConflictError)
      setError(err instanceof NoteConflictError ? err.message : 'No se pudo borrar. Intentá de nuevo.')
    } finally {
      saveInFlight.current = false
      setSaving(false)
    }
  }

  async function handleSave(value = text) {
    if (!meal.id || !value.trim() || saveInFlight.current || conflict) return
    saveInFlight.current = true
    dirty.current = true
    const submittedRevision = draftRevision.current
    setText(value)
    setSaving(true)
    showToast(null)
    setError(null)
    try {
      const interp = await saveNote(token, date, meal.id, value.trim(), baseVersion.current)
      dirty.current = draftRevision.current !== submittedRevision
      baseVersion.current = interp.version
      setConflict(false)
      if (!dirty.current) setEditing(false)
      onNoteSaved(interp, meal.id, value.trim())
      const status = mealStatus({
        status: interp.status, noteText: interp.text, comparison: interp.comparison,
      })
      showToast(`Guardado. ${status.text}.`)
    } catch (err) {
      setConflict(err instanceof NoteConflictError)
      setError(err instanceof NoteConflictError ? err.message : 'No se pudo guardar. Intentá de nuevo.')
    } finally {
      saveInFlight.current = false
      setSaving(false)
    }
  }

  async function handleAnswer(foodGroupId: number, consumed: boolean) {
    if (!meal.id || answerPending.current) return
    answerPending.current = true
    setAnswerSaving(true)
    setError(null)
    const source = mealDay?.comparison
    setAnswered({ source, groupIds: [...answeredGroups, foodGroupId] })
    try {
      await saveAnswer(token, date, meal.id, { foodGroupId, consumed })
    } catch {
      setAnswered(prev => ({ ...prev, groupIds: prev.groupIds.filter(id => id !== foodGroupId) }))
      setError('No se pudo guardar la respuesta. Intentá de nuevo.')
      return
    } finally {
      answerPending.current = false
      setAnswerSaving(false)
    }
    await onAnswerSaved(meal.id).catch(() => {})
  }
  const feedback = (<>
      {error && <p id={`nota-error-${meal.id}`} className="nota-error" role="alert">{error}</p>}
      {conflict && (
        <button type="button" className="nota-btn-recargar" disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              // Recargar desde el aviso es aceptar la versión actual como base del borrador.
              const day = await onReload()
              baseVersion.current = day.meals.find(m => m.mealId === meal.id)?.noteVersion ?? null
              setConflict(false)
              setError(null)
            } catch {
              setError('No se pudo recargar. Intentá de nuevo.')
            } finally {
              setSaving(false)
            }
          }}>
          Recargar
        </button>
      )}

  </>)

  const textareaId = `nota-${meal.id}`

  return (
    <div className="nota-body">
      {(!hasNote || editing) && <p className="toca" aria-label="Te toca">
        {meal.portions.some(p => p.portions > 0) ? meal.portions.filter(p => p.portions > 0).map(p =>
          <span key={p.foodGroupId}>
            <i className="nota-item__dot" style={{ background: groupsMap[p.foodGroupId]?.token }} aria-hidden="true" />
            {fmt(p.portions)} {groupsMap[p.foodGroupId]?.name}
          </span>)
          : 'Para lo que comas fuera de las comidas de tu plan.'}
      </p>}
      {hasNote && !editing ? <>
        <p className="comida__texto">{mealDay?.noteText}</p>
        {(mealDay?.status !== 'FLEXIBLE' || hasRecordedPortions) && differences.length > 0 && <ul className="dif">
          {differences.map(group => {
            const extra = group.status === 'DE_MAS'
            const amount = extra ? group.recorded - group.expected : group.expected - group.recorded
            return <li key={group.foodGroupId}>
              <i className="nota-item__dot" style={{ background: groupsMap[group.foodGroupId]?.token ?? 'var(--muted)' }} aria-hidden="true" />
              {extra ? 'De más: ' : 'Faltó '}{fmt(amount)} {amount === 1 ? 'porción' : 'porciones'} de {group.name.trim() || groupsMap[group.foodGroupId]?.name || 'un grupo del plan'}
            </li>
          })}
        </ul>}
        {mealDay?.status === 'FLEXIBLE' && !hasRecordedPortions && <p className="muted sm">Cuenta como comida flexible: no se compara con el plan.</p>}
      </> : <NoteEditor onCancelEdit={() => {
        dirty.current = false
        setText(mealDay?.noteText ?? '')
        baseVersion.current = mealDay?.noteVersion ?? null
        setConflict(false)
        setError(null)
        setConfirming(false)
        setEditing(false)
      }} meal={meal} textareaId={textareaId} textareaRef={textareaRef} text={text}
        editDraft={editDraft} error={error} loadingSuggestions={loadingSuggestions} suggestions={suggestions}
        hasNote={hasNote} saving={saving} conflict={conflict} handleSave={handleSave}
        deleteRef={deleteRef} confirming={confirming}
        onConfirmDelete={() => { setConfirming(true); pendingFocus.current = 'confirmar' }}
        onCancelDelete={() => { setConfirming(false); pendingFocus.current = 'borrar' }}
        confirmRef={confirmRef} handleDelete={handleDelete} />}

      {!detailOpen && feedback}

      <MealQuestions questions={questions} answerSaving={answerSaving} handleAnswer={handleAnswer} />
      <FlexibleQuestions items={items} token={token} date={date} onSaved={result => onItemPatched(meal.id!, result)} />
      {items.filter(item => item.origin === ItemOrigin.UNKNOWN).map(item => <div className="pregunta" key={item.id}>
        <span>No reconocí <strong>«{item.originalText || item.food}»</strong></span>
        <button type="button" className="nota-mini" onClick={() => { setResolveTarget(item); setDetailOpen(true) }}>Decime qué es</button>
      </div>)}
      {(hasNote || items.length > 0) && (
        <>
          <div className="fila-links">
          {hasNote && !editing && <button type="button" className="nota-link" onClick={() => { setEditing(true); pendingFocus.current = 'textarea' }}>Editar</button>}
          <button type="button" className="nota-link" aria-haspopup="dialog"
            aria-expanded={detailOpen} aria-controls={`entendido-dialog-${meal.id}`}
            onClick={event => { event.currentTarget.focus(); setResolveTarget(null); setDetailOpen(true) }}>
            Así lo entendí
          </button>
          </div>
          <UnderstoodSheet open={detailOpen} onClose={() => { setDetailOpen(false); setResolveTarget(null) }}
            selected={resolveTarget} onSelect={setResolveTarget} headingRef={understoodRef} mealId={meal.id} items={items} token={token} date={date} groups={groupsMap}
            onPatched={result => onItemPatched(meal.id!, result)}>
            <UnderstoodItems meal={meal} items={items} date={date} token={token}
              groupsMap={groupsMap} detailOpen={detailOpen} feedback={feedback}
              expandedMentions={expandedMentions} setExpandedMentions={setExpandedMentions}
              saving={saving} conflict={conflict} handleRemove={handleRemove} onItemPatched={onItemPatched} />
          </UnderstoodSheet>
        </>
      )}
    </div>
  )
})

// ── Resumen diario ────────────────────────────────────────────────────────

