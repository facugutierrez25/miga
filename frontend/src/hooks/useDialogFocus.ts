import { useEffect, useRef } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Ciclo de foco de un diálogo modal: al abrir enfoca el primer control, Tab y Shift+Tab
// quedan dentro del diálogo, Escape lo cierra y al cerrar el foco vuelve al disparador.
export function useDialogFocus<T extends HTMLElement>(onClose: () => void, active = true) {
  const dialogRef = useRef<T>(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!active) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (!dialog) return
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')].filter(dialog => {
        for (let element: HTMLElement | null = dialog; element; element = element.parentElement) {
          const style = getComputedStyle(element)
          if (element.hidden || element.inert || style.display === 'none' || style.visibility === 'hidden') return false
        }
        return true
      })
      if (dialogs.length > 0 && dialogs[dialogs.length - 1] !== dialog) return
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      // Con el foco en el título (tabIndex -1) o fuera de los controles, el ciclo sigue dentro del diálogo.
      if (!items.includes(document.activeElement as HTMLElement)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      trigger?.focus()
    }
  }, [active])

  return dialogRef
}
