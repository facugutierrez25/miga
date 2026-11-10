import { Fragment, useState } from 'react'
import Miga from '../../components/Miga'
import StatusChip from '../../components/StatusChip'
import { HabitCrumbs } from '../../components/TodayHabits'
import type { HabitDto } from '../../api/week'
import type { MigaAspect } from '../../lib/mealStatus'

const OPTIONS = [
  { text: 'Milanesa con ensalada', aspect: 'half', status: 'CASI', detail: 'Faltó 1 porción de Grasas', understood: 'Milanesa: 1 Proteínas y 1 Cereales. Ensalada: 2 Verduras.' },
  { text: 'Pollo con arroz, ensalada y aceite de oliva', aspect: 'full', status: 'EN_PLAN', detail: '', understood: 'Pollo: 1 Proteínas. Arroz: 1 Cereales. Ensalada: 2 Verduras. Aceite: 1 Grasas.' },
  { text: 'Pizza con amigos', aspect: 'flexible', status: 'FLEXIBLE', detail: '', understood: 'Pizza cuenta como comida flexible: se anota y no se compara con el plan.' },
] as const

function Portions() {
  return <p className="land-portions" aria-label="Te toca">
    {(['protein', 'grain', 'fat', 'vegetable'] as const).map((group, index) => <span key={group}>
      <i className={`land-dot land-dot--${group}`} aria-hidden="true" />{index === 3 ? 2 : 1} {['Proteínas', 'Cereales', 'Grasas', 'Verduras'][index]}
    </span>)}
  </p>
}

export function LandingDemo() {
  const [selected, setSelected] = useState<number | null>(null)
  const result = selected === null ? null : OPTIONS[selected]
  return <div className="land-demo" aria-label="Probá cómo se anota una comida">
    <div className="land-demo__heading"><strong>Hoy</strong><span className="land-muted land-small">Probalo: ¿qué almorzaste?</span></div>
    <div className="land-card land-strip" aria-hidden="true">
      <span className="land-strip__selection" />
      {['Desayuno', 'Almuerzo', 'Merienda', 'Cena'].map((meal, index) => <div className="land-strip__meal" key={meal}>
        <Miga aspect={index === 0 ? 'full' : index === 1 ? result?.aspect ?? 'empty' : 'empty'} />
        <b>{meal}</b><span className="land-number">{['09:00', '13:00', '17:00', '21:00'][index]}</span>
      </div>)}
    </div>
    <div className="land-card land-panel" aria-live="polite" aria-atomic="true">
      <div className={result ? 'land-result' : 'land-initial'} key={selected}>
        <div className="land-panel__heading"><h3>Almuerzo</h3><span className="land-muted land-small land-number">13:00</span>
          {result ? <StatusChip status={result.status} /> : <span className="land-next">Sigue</span>}
        </div>
        {result ? <>
          <p>{result.text}</p>
          {result.detail && <ul className="land-difference"><li><i className="land-dot land-dot--fat" aria-hidden="true" />{result.detail}</li></ul>}
          <p className="land-understood">Así lo entendí: {result.understood}</p>
          <button type="button" className="land-reset" onClick={() => setSelected(null)}>Probar con otra comida</button>
        </> : <>
          <Portions />
          <div className="land-options"><p>¿Qué comiste?</p>{OPTIONS.map((option, index) => <button type="button" key={option.text} onClick={() => setSelected(index)}>{option.text}</button>)}</div>
        </>}
      </div>
    </div>
    <p className="land-demo__footer">Así se ve Miga por dentro. Los ejemplos son de muestra.</p>
  </div>
}

const STAMP_ROWS = [['Desayuno', 'ffhffff'], ['Almuerzo', 'fhfffhx'], ['Merienda', 'ffefhff'], ['Cena', 'hfffxfe'], null, ['Agua', 'fhffhfh']] as const
const STAMP_ASPECTS: Record<string, MigaAspect> = { f: 'full', h: 'half', x: 'flexible', e: 'empty' }

export function StampGrid() {
  return <div className="land-stamps__grid" aria-hidden="true">
    <span />{[...'LMMJVSD'].map((letter, index) => <span className="land-stamps__day" key={index}>{letter}<b className="land-number">{index + 2}</b></span>)}
    <span className="land-stamps__divider" />
    {STAMP_ROWS.map((row, index) => row ? <Fragment key={row[0]}>
      <span className="land-stamps__name">{row[0]}</span>{[...row[1]].map((state, column) => <span className="land-stamps__cell" key={column}><Miga aspect={STAMP_ASPECTS[state]} /></span>)}
    </Fragment> : <span className="land-stamps__divider" key={index} />)}
  </div>
}

const HABITS: HabitDto[] = [
  { id: 1, name: 'Agua', habitType: 'CANTIDAD', unit: 'Lt', dailyGoal: 2, step: 0.5, period: 'DIA', displayOrder: 1 },
  { id: 2, name: 'Entrenamiento', habitType: 'SI_NO', unit: null, dailyGoal: 1, step: 1, period: 'DIA', displayOrder: 2 },
]

export function LandingHabits() {
  const [values, setValues] = useState([1, 0])
  return <ul className="land-card land-list">{HABITS.map((habit, index) => <li key={habit.id}>
    <HabitCrumbs habit={habit} value={values[index]} onChange={value => setValues(previous => previous.map((current, position) => position === index ? value : current))} />
  </li>)}</ul>
}
