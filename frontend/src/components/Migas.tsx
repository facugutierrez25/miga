import { formatPortions, migaSlots, migasLabel, type MigaRow } from './migaSlots'
import './Migas.css'

// Cada porción del plan es una miga: llena si se comió, contorno si falta y medio círculo
// para media porción (ver "Concepto miga" en docs/diseno/guia-de-estilo.md).

const FULL = 'M6 1.25a4.75 4.75 0 1 1 0 9.5a4.75 4.75 0 1 1 0-9.5z'
const HALF = 'M6 1.25a4.75 4.75 0 0 0 0 9.5z'

function Miga({ color, capacity, filled }: { color: string; capacity: number; filled: number }) {
  const outline = capacity < 1 ? HALF : FULL
  return (
    <svg className="miga" viewBox="0 0 12 12" aria-hidden="true">
      <path d={outline} fill="none" stroke={color} strokeWidth="1.5" />
      {filled >= 1 && <path d={FULL} fill={color} />}
      {filled > 0 && filled < 1 && <path d={HALF} fill={color} />}
    </svg>
  )
}

export default function Migas({ rows }: { rows: MigaRow[] }) {
  return (
    <div className="migas">
      {rows.map(row => (
        <div key={row.id} className="migas__row" role="img" aria-label={migasLabel(row)}>
          <span className="migas__name" aria-hidden="true">{row.name}</span>
          <span className="migas__dots" aria-hidden="true">
            {migaSlots(row.done, row.total).map((slot, i) => (
              <Miga key={i} color={row.color} capacity={slot.capacity} filled={slot.filled} />
            ))}
          </span>
          <span className={`migas__count${row.done > row.total ? ' migas__count--over' : ''}`} aria-hidden="true">
            {formatPortions(row.done)} de {formatPortions(row.total)}
          </span>
        </div>
      ))}
    </div>
  )
}
