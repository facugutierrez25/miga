import type { GroupStatusDto } from '../../api/records'

interface Props {
  questions: GroupStatusDto[]
  answerSaving: boolean
  handleAnswer: (foodGroupId: number, consumed: boolean) => Promise<void>
}

export function MealQuestions({ questions, answerSaving, handleAnswer }: Props) {
  return <>
    {questions.map(p => (
      <div key={p.foodGroupId} className="nota-pregunta">
        <span className="nota-pregunta__texto">
          ¿Consumiste <strong>{p.name}</strong>?
        </span>
        <div className="nota-pregunta__acciones">
          <button disabled={answerSaving} className="nota-pregunta__si" onClick={() => handleAnswer(p.foodGroupId, true)}>Sí</button>
          <button disabled={answerSaving} className="nota-pregunta__no" onClick={() => handleAnswer(p.foodGroupId, false)}>No</button>
        </div>
      </div>
    ))}
  </>
}
