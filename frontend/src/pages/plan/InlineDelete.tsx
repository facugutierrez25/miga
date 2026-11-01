import { useRef, useState } from 'react'

export default function InlineDelete({ name, onDelete, hint }: {
  name: string
  onDelete: () => Promise<void>
  hint?: string
}) {
  const [confirm, setConfirm] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  function cancel() {
    setConfirm(false)
    trigger.current?.focus()
  }
  return <div onKeyDown={event => {
    if (confirm && event.key === 'Escape') { event.stopPropagation(); cancel() }
  }}>
    <button ref={trigger} type="button" aria-label={`Borrar ${name}`} onClick={() => setConfirm(true)}>Borrar</button>
    {confirm && <div role="group" aria-label="Confirmar borrado">
      <p>¿Borrar {name}?</p>
      {hint && <p>{hint}</p>}
      <button autoFocus type="button" onClick={() => void onDelete()}>Confirmar borrado</button>
      <button type="button" onClick={cancel}>Conservar</button>
    </div>}
  </div>
}
