import { useId } from 'react'
import './Segmented.css'

export default function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void
}) {
  const name = useId()
  return <div className="segmented" role="radiogroup" aria-label={label}>
    {options.map(option => <label key={option.value} className="segmented__option">
      <input type="radio" name={name} value={option.value} checked={value === option.value}
        onChange={() => onChange(option.value)} onKeyDown={event => {
          const offset = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
          if (offset === undefined) return
          event.preventDefault()
          const index = options.findIndex(item => item.value === option.value)
          const nextIndex = (index + offset + options.length) % options.length
          onChange(options[nextIndex].value)
          event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll('input')[nextIndex]?.focus()
        }} />
      <span>{option.label}</span>
    </label>)}
  </div>
}
