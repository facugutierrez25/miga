import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Crumbs from './Crumbs'
import { formatPortions, crumbDifferenceLabel, crumbSlots, MAX_CARD_PORTIONS, type CrumbRow } from './crumbSlots'
import './MealCard.css'

gsap.registerPlugin(useGSAP)

// Ficha de dominó de una comida (ver "Ficha" en docs/diseno/guia-de-estilo.md): a la izquierda
// las porciones que pide el plan, a la derecha las que se anotaron. Si las dos mitades coinciden,
// la comida va como el plan. El clavo del medio es el punto amarillo del logo.

// Posiciones de un dado en una grilla de 3 × 3 (0 arriba a la izquierda, 8 abajo a la derecha).
const DICE_POSITIONS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8], 7: [0, 2, 3, 4, 5, 6, 8], 8: [0, 1, 2, 3, 5, 6, 7, 8], 9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
}

// Hasta 9 porciones se dibujan como un dado y de 10 a 12 en una grilla de 4 × 3. Si un plan
// viejo tuviera más, se muestran las filas por grupo.

interface Pip { color: string; capacity: number; filled: number }

function pips(rows: CrumbRow[]): Pip[] {
  return rows.flatMap(row => crumbSlots(row.done, row.total).map(slot => ({ color: row.color, ...slot })))
}

function cells<T>(list: T[]): (T | null)[] {
  const n = list.length
  if (n > 9) return Array.from({ length: 12 }, (_, i) => list[i] ?? null)
  const pos = DICE_POSITIONS[n] ?? []
  return Array.from({ length: 9 }, (_, i) => {
    const at = pos.indexOf(i)
    return at < 0 ? null : list[at]
  })
}

const FULL = 'M9 1.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 1 1 0-15z'
const HALF = 'M9 1.5a7.5 7.5 0 0 0 0 15z'

function PipSvg({ pip, half }: { pip: Pip; half: 'plan' | 'anotado' }) {
  const outline = pip.capacity < 1 ? HALF : FULL
  const full = half === 'plan' ? pip.capacity : pip.filled
  return (
    <svg className={`ficha__pip${half === 'anotado' && full > 0 ? ' ficha__pip--on' : ''}`} viewBox="0 0 18 18" aria-hidden="true">
      <path d={outline} fill="none" stroke={pip.color} strokeWidth="2" />
      {full >= 1 && <path d={FULL} fill={pip.color} />}
      {full > 0 && full < 1 && <path d={HALF} fill={pip.color} />}
    </svg>
  )
}

function sum(rows: CrumbRow[], field: 'done' | 'total'): number {
  return rows.reduce((s, r) => s + r[field], 0)
}

export default function MealCard({ name, rows }: { name: string; rows: CrumbRow[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const list = pips(rows)
  // Qué posiciones de la mitad "Anotaste" están llenas: al anotar se animan solo las que se suman.
  const signature = list.map(p => (p.filled > 0 ? 1 : 0)).join('')
  const previous = useRef<string | null>(null)

  // Al anotar, solo aparecen las porciones nuevas de esta comida, una tras otra. Al cargar la
  // pantalla no se anima nada, y con movimiento reducido el estado ya está dibujado.
  useGSAP(() => {
    const previousValue = previous.current
    previous.current = signature
    if (previousValue === null || !ref.current || typeof window.matchMedia !== 'function') return
    const summed = new Set([...signature].flatMap((v, i) => (v === '1' && previousValue[i] !== '1' ? [i] : [])))
    if (summed.size === 0) return
    const pips = Array.from(ref.current.querySelectorAll('.ficha__mitad--anotado .ficha__pip, .ficha__mitad--anotado .ficha__vacio'))
    const order = cells(list.map((_, i) => i))
    const newItems = pips.filter((_, k) => { const i = order[k]; return i !== null && summed.has(i) })
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(newItems, { scale: 0.25, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.06, transformOrigin: '50% 50%' })
    })
    return () => mm.revert()
  }, { dependencies: [signature], scope: ref })

  if (list.length > MAX_CARD_PORTIONS) return <Crumbs rows={rows} differencesOnly />

  const plan = sum(rows, 'total')
  const logged = sum(rows, 'done')
  const large = list.length > 9
  const grid = cells(list)
  return (
    <div className="ficha-wrap" ref={ref}>
      <div className="ficha" role="img"
        aria-label={`${name}: el plan pide ${formatPortions(plan)} ${plan === 1 ? 'porción' : 'porciones'}, anotaste ${formatPortions(logged)}`}>
        {(['plan', 'anotado'] as const).map((half, i) => (
          <div key={half} className={`ficha__mitad ficha__mitad--${half}`} style={{ order: i * 2 }}>
            <span className="ficha__rotulo" aria-hidden="true">{half === 'plan' ? 'Tu plan' : 'Anotaste'}</span>
            <span className={`ficha__pips${large ? ' ficha__pips--grande' : ''}`} aria-hidden="true">
              {grid.map((pip, k) => pip
                ? <PipSvg key={k} pip={pip} half={half} />
                : <span key={k} className="ficha__vacio" />)}
            </span>
            <span className="ficha__num" aria-hidden="true">{formatPortions(half === 'plan' ? plan : logged)}</span>
          </div>
        ))}
        <span className="ficha__lomo" style={{ order: 1 }} aria-hidden="true"><span className="ficha__clavo" /></span>
      </div>
      <ul className="ficha__leyenda">
        {rows.map(row => (
          <li key={row.id} role="img" aria-label={crumbDifferenceLabel(row)}>
            <span className="ficha__punto" style={{ background: row.color }} aria-hidden="true" />
            <span aria-hidden="true">{row.name} {formatPortions(row.done)} de {formatPortions(row.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
