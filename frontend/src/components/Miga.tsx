import type { MigaAspect } from '../lib/mealStatus'
import './Miga.css'

export default function Miga({ aspect, label, className = '' }: { aspect: MigaAspect; label?: string; className?: string }) {
  return <span className={`meal-crumb meal-crumb--${aspect} ${className}`} role={label ? 'img' : undefined}
    aria-label={label} aria-hidden={label ? undefined : true}>{aspect === 'plus' ? '+' : null}</span>
}
