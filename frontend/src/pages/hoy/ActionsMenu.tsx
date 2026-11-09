import { useEffect, useId, useRef, useState } from 'react'

export function ActionsMenu({ label, actions, buttonRef, disabled = false }: {
  label: string
  actions: { label: string; onClick: () => void; disabled?: boolean }[]
  buttonRef?: React.RefObject<HTMLButtonElement | null>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const localRef = useRef<HTMLButtonElement>(null)
  const triggerRef = buttonRef ?? localRef
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [open])
  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }
  return <div className="nota-menu" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close() }
    if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
      buttons[next]?.focus()
    }
  }}>
    <button type="button" className="nota-menu__trigger" ref={triggerRef} aria-label={label}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      disabled={disabled} onClick={() => setOpen(value => !value)}>⋯</button>
    {open && <div className="nota-menu__items" ref={menuRef} id={menuId} role="menu" aria-label={label}>
      {actions.map(action => <button key={action.label} type="button" role="menuitem"
        // Safari (iPhone) no enfoca un botón al tocarlo: sin esto el menú se cierra por blur
        // antes del click y la opción elegida no hace nada.
        onMouseDown={event => event.preventDefault()}
        disabled={action.disabled} onClick={() => { close(); action.onClick() }}>{action.label}</button>)}
    </div>}
  </div>
}

