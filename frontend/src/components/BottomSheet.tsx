import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDialogFocus } from '../hooks/useDialogFocus'
import './BottomSheet.css'

export default function BottomSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const titleId = useId()
  const ref = useDialogFocus<HTMLDivElement>(onClose)
  return createPortal(
    <div className="bottom-sheet-overlay" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="bottom-sheet" ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="bottom-sheet__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="bottom-sheet__close" onClick={onClose} aria-label="Cerrar">{'\u2715'}</button>
        </div>
        {children}
      </div>
    </div>, document.body,
  )
}
