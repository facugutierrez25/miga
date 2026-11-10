import { useEffect, useState } from 'react'

export function useDraftGuard(value: unknown, onDirtyChange?: (dirty: boolean) => void, busy = false) {
  const [initial] = useState(() => JSON.stringify(value))
  const dirty = JSON.stringify(value) !== initial
  const [discard, setDiscard] = useState(false)
  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])
  return {
    dirty,
    cancel: (close: () => void) => { if (busy) return; if (dirty) setDiscard(true); else close() },
    notice: (close: () => void) => discard && <div role="alert">
      <p>Tenés cambios sin guardar. ¿Querés descartarlos?</p>
      <button type="button" disabled={busy} onClick={close}>Descartar cambios</button>
      <button type="button" onClick={() => setDiscard(false)}>Seguir editando</button>
    </div>,
  }
}
