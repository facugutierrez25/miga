import { useRef } from 'react'

export function useEditorFocus() {
  const trigger = useRef<HTMLElement | null>(null)

  function rememberTrigger() {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }

  function restoreFocus() {
    requestAnimationFrame(() => trigger.current?.focus())
  }

  return { rememberTrigger, restoreFocus }
}
