import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import './OnboardingPage.css'

const TOTAL_STEPS = 4

const NOMBRES_SUGERIDOS = [
  'Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Colación', 'Cena tardía', 'Media mañana',
]

interface MealDraft {
  name: string
  time: string
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="ob-progress">
      <div className="ob-progress__bar">
        <div className="ob-progress__fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>
      <span className="ob-progress__label">{step} de {TOTAL_STEPS}</span>
    </div>
  )
}

function Step1({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="ob-step">
      <div className="ob-step__content">
        <h1 className="ob-step__title">Vamos a cargar tu plan juntos</h1>
        <p className="ob-step__example">
          Te vamos a hacer 3 preguntas cortas para ayudarte a pasar el plan de tu nutricionista a la app. Tené el papel o la foto a mano.
        </p>
      </div>
      <div className="ob-step__actions">
        <button className="btn-primary ob-btn" onClick={onNext}>Empezar</button>
        <button className="btn-skip" onClick={onSkip}>Cargar yo solo</button>
      </div>
    </div>
  )
}

function Step2({
  count, onChange, onNext, onBack,
}: { count: number; onChange: (n: number) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div className="ob-step">
      <ProgressBar step={1} />
      <div className="ob-step__content">
        <h1 className="ob-step__title">¿Cuántas comidas tiene tu plan?</h1>
        <p className="ob-step__example">
          La mayoría tienen 4 o 5: desayuno, almuerzo, merienda y cena, más alguna colación.
        </p>
        <div className="ob-stepper">
          <button
            className="ob-stepper__btn"
            onClick={() => onChange(Math.max(2, count - 1))}
            disabled={count <= 2}
            aria-label="Menos comidas"
          >−</button>
          <span className="ob-stepper__value">{count}</span>
          <button
            className="ob-stepper__btn"
            onClick={() => onChange(Math.min(7, count + 1))}
            disabled={count >= 7}
            aria-label="Más comidas"
          >+</button>
        </div>
      </div>
      <div className="ob-step__actions">
        <button className="btn-primary ob-btn" onClick={onNext}>Siguiente</button>
        <button className="btn-secondary ob-btn" onClick={onBack}>Atrás</button>
      </div>
    </div>
  )
}

function Step3({
  meals, onChange, onNext, onBack,
}: {
  meals: MealDraft[]
  onChange: (i: number, field: keyof MealDraft, value: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const allNamed = meals.every(m => m.name.trim().length > 0)
  return (
    <div className="ob-step">
      <ProgressBar step={2} />
      <div className="ob-step__content">
        <h1 className="ob-step__title">¿Cómo se llaman tus comidas?</h1>
        <p className="ob-step__example">
          Usá los nombres que usa tu nutricionista. La hora es opcional.
        </p>
        <div className="ob-meals">
          {meals.map((m, i) => (
            <div key={i} className="ob-meal-row">
              <input
                className="ob-meal-row__name"
                type="text"
                value={m.name}
                placeholder={NOMBRES_SUGERIDOS[i] ?? `Comida ${i + 1}`}
                onChange={e => onChange(i, 'name', e.target.value)}
                aria-label={`Nombre de la comida ${i + 1}`}
              />
              <input
                className="ob-meal-row__time"
                type="time"
                value={m.time}
                onChange={e => onChange(i, 'time', e.target.value)}
                aria-label={`Hora de la comida ${i + 1}`}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="ob-step__actions">
        <button className="btn-primary ob-btn" onClick={onNext} disabled={!allNamed}>Siguiente</button>
        <button className="btn-secondary ob-btn" onClick={onBack}>Atrás</button>
      </div>
    </div>
  )
}

function Step4({ meals, onNext, onBack }: { meals: MealDraft[]; onNext: () => void; onBack: () => void }) {
  return (
    <div className="ob-step">
      <ProgressBar step={3} />
      <div className="ob-step__content">
        <h1 className="ob-step__title">¿Cuántas porciones tiene cada comida?</h1>
        <p className="ob-step__example">
          En el plan vas a cargar las porciones de cada grupo: proteínas, cereales, frutas, lácteos, grasas y verduras.
          <br /><br />
          Por ejemplo: 1 porción de proteína = 100&nbsp;g de pollo, 1 huevo o 1 taza de lentejas.
        </p>
        <ul className="ob-meal-preview">
          {meals.map((m, i) => (
            <li key={i} className="ob-meal-preview__item">
              <span className="ob-meal-preview__dot" />
              <span className="ob-meal-preview__name">{m.name || NOMBRES_SUGERIDOS[i]}</span>
              {m.time && <span className="ob-meal-preview__time">{m.time}</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="ob-step__actions">
        <button className="btn-primary ob-btn" onClick={onNext}>Cargar porciones</button>
        <button className="btn-secondary ob-btn" onClick={onBack}>Atrás</button>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  useTitle('Cargar mi plan | Miga')
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [mealCount, setMealCount] = useState(4)
  const [meals, setMeals] = useState<MealDraft[]>(() =>
    Array.from({ length: 4 }, (_, i) => ({ name: NOMBRES_SUGERIDOS[i] ?? '', time: '' }))
  )

  function handleCountChange(n: number) {
    setMealCount(n)
    setMeals(prev => {
      const next = Array.from({ length: n }, (_, i) => ({
        name: prev[i]?.name ?? NOMBRES_SUGERIDOS[i] ?? '',
        time: prev[i]?.time ?? '',
      }))
      return next
    })
  }

  function handleMealChange(i: number, field: keyof MealDraft, value: string) {
    setMeals(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  }

  function goToMiPlan() {
    navigate('/mi-plan', {
      state: {
        meals: meals.map((m, i) => ({
          name: m.name.trim() || NOMBRES_SUGERIDOS[i] || `Comida ${i + 1}`,
          suggestedTime: m.time || null,
        })),
      },
    })
  }

  return (
    <div className="ob-page">
      <div className="ob-header">
        <Brand size={22} />
      </div>
      <div className="ob-body">
        {step === 1 && (
          <Step1
            onNext={() => setStep(2)}
            onSkip={() => navigate('/mi-plan')}
          />
        )}
        {step === 2 && (
          <Step2
            count={mealCount}
            onChange={handleCountChange}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3
            meals={meals}
            onChange={handleMealChange}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <Step4
            meals={meals}
            onNext={goToMiPlan}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  )
}
