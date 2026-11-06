import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Migas from './Migas'
import { formatPortions, migaDifferenceLabel, migaSlots, MAX_PORCIONES_FICHA, type MigaRow } from './migaSlots'
import './FichaComida.css'

gsap.registerPlugin(useGSAP)

// Ficha de dominó de una comida (ver "Ficha" en docs/diseno/guia-de-estilo.md): a la izquierda
// las porciones que pide el plan, a la derecha las que se anotaron. Si las dos mitades coinciden,
// la comida va como el plan. El clavo del medio es el punto amarillo del logo.

// Posiciones de un dado en una grilla de 3 × 3 (0 arriba a la izquierda, 8 abajo a la derecha).
const DADO: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8], 7: [0, 2, 3, 4, 5, 6, 8], 8: [0, 1, 2, 3, 5, 6, 7, 8], 9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
}

// Hasta 9 porciones se dibujan como un dado y de 10 a 12 en una grilla de 4 × 3. Si un plan
// viejo tuviera más, se muestran las filas por grupo.

interface Pip { color: string; capacity: number; filled: number }

function pips(rows: MigaRow[]): Pip[] {
  return rows.flatMap(row => migaSlots(row.done, row.total).map(slot => ({ color: row.color, ...slot })))
}

function celdas<T>(lista: T[]): (T | null)[] {
  const n = lista.length
  if (n > 9) return Array.from({ length: 12 }, (_, i) => lista[i] ?? null)
  const pos = DADO[n] ?? []
  return Array.from({ length: 9 }, (_, i) => {
    const at = pos.indexOf(i)
    return at < 0 ? null : lista[at]
  })
}

const FULL = 'M9 1.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 1 1 0-15z'
const HALF = 'M9 1.5a7.5 7.5 0 0 0 0 15z'

function PipSvg({ pip, mitad }: { pip: Pip; mitad: 'plan' | 'anotado' }) {
  const outline = pip.capacity < 1 ? HALF : FULL
  const lleno = mitad === 'plan' ? pip.capacity : pip.filled
  return (
    <svg className={`ficha__pip${mitad === 'anotado' && lleno > 0 ? ' ficha__pip--on' : ''}`} viewBox="0 0 18 18" aria-hidden="true">
      <path d={outline} fill="none" stroke={pip.color} strokeWidth="2" />
      {lleno >= 1 && <path d={FULL} fill={pip.color} />}
      {lleno > 0 && lleno < 1 && <path d={HALF} fill={pip.color} />}
    </svg>
  )
}

function sumar(rows: MigaRow[], campo: 'done' | 'total'): number {
  return rows.reduce((s, r) => s + r[campo], 0)
}

export default function FichaComida({ nombre, rows }: { nombre: string; rows: MigaRow[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const lista = pips(rows)
  // Qué posiciones de la mitad "Anotaste" están llenas: al anotar se animan solo las que se suman.
  const firma = lista.map(p => (p.filled > 0 ? 1 : 0)).join('')
  const anterior = useRef<string | null>(null)

  // Al anotar, solo aparecen las porciones nuevas de esta comida, una tras otra. Al cargar la
  // pantalla no se anima nada, y con movimiento reducido el estado ya está dibujado.
  useGSAP(() => {
    const previo = anterior.current
    anterior.current = firma
    if (previo === null || !ref.current || typeof window.matchMedia !== 'function') return
    const sumadas = new Set([...firma].flatMap((v, i) => (v === '1' && previo[i] !== '1' ? [i] : [])))
    if (sumadas.size === 0) return
    const pips = Array.from(ref.current.querySelectorAll('.ficha__mitad--anotado .ficha__pip, .ficha__mitad--anotado .ficha__vacio'))
    const orden = celdas(lista.map((_, i) => i))
    const nuevos = pips.filter((_, k) => { const i = orden[k]; return i !== null && sumadas.has(i) })
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(nuevos, { scale: 0.25, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.06, transformOrigin: '50% 50%' })
    })
    return () => mm.revert()
  }, { dependencies: [firma], scope: ref })

  if (lista.length > MAX_PORCIONES_FICHA) return <Migas rows={rows} differencesOnly />

  const plan = sumar(rows, 'total')
  const anotado = sumar(rows, 'done')
  const grande = lista.length > 9
  const grilla = celdas(lista)
  return (
    <div className="ficha-wrap" ref={ref}>
      <div className="ficha" role="img"
        aria-label={`${nombre}: el plan pide ${formatPortions(plan)} ${plan === 1 ? 'porción' : 'porciones'}, anotaste ${formatPortions(anotado)}`}>
        {(['plan', 'anotado'] as const).map((mitad, i) => (
          <div key={mitad} className={`ficha__mitad ficha__mitad--${mitad}`} style={{ order: i * 2 }}>
            <span className="ficha__rotulo" aria-hidden="true">{mitad === 'plan' ? 'Tu plan' : 'Anotaste'}</span>
            <span className={`ficha__pips${grande ? ' ficha__pips--grande' : ''}`} aria-hidden="true">
              {grilla.map((pip, k) => pip
                ? <PipSvg key={k} pip={pip} mitad={mitad} />
                : <span key={k} className="ficha__vacio" />)}
            </span>
            <span className="ficha__num" aria-hidden="true">{formatPortions(mitad === 'plan' ? plan : anotado)}</span>
          </div>
        ))}
        <span className="ficha__lomo" style={{ order: 1 }} aria-hidden="true"><span className="ficha__clavo" /></span>
      </div>
      <ul className="ficha__leyenda">
        {rows.map(row => (
          <li key={row.id} role="img" aria-label={migaDifferenceLabel(row)}>
            <span className="ficha__punto" style={{ background: row.color }} aria-hidden="true" />
            <span aria-hidden="true">{row.name} {formatPortions(row.done)} de {formatPortions(row.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
