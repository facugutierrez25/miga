import { type DraftStore, NotaMealSection } from './NotaMealSection'
import { type GroupInfo, mealCrumbs } from './helpers'
import { memo } from 'react'
import Migas from '../../components/Migas'
import FichaComida from '../../components/FichaComida'
import { type MealDto } from '../../api/plans'
import {
  type DayRegistroDto,
  type MealDayDto,
  type NoteInterpretationDto,
  type PatchItemResultDto,
} from '../../api/registro'

export interface MealProps {
  meal: MealDto
  drafts: DraftStore
  mealDay: MealDayDto | undefined
  date: string
  token: string
  groupsMap: Record<number, GroupInfo>
  onNoteSaved: (interp: NoteInterpretationDto, mealId: number) => void
  onItemPatched: (mealId: number, result: PatchItemResultDto) => void
  onNoteDeleted: (mealId: number, version: number | null) => void
  onReload: () => Promise<DayRegistroDto>
  onAnswerSaved: (mealId: number) => Promise<void>
}

export const MealDetail = memo(function MealDetail(props: MealProps & { showCard?: boolean }) {
  const { meal, mealDay, date, token, groupsMap, showCard = false } = props
  const rows = mealCrumbs(meal, mealDay, groupsMap)
  return (
    <>
      {showCard && rows.length > 0
        ? <FichaComida nombre={meal.name} rows={rows} />
        : <Migas rows={rows} differencesOnly />}
      {meal.id !== undefined && (
        <NotaMealSection
          key={date}
          meal={meal}
          drafts={props.drafts}
          mealDay={mealDay}
          date={date}
          token={token}
          groupsMap={groupsMap}
          onNoteSaved={props.onNoteSaved}
          onItemPatched={props.onItemPatched}
          onNoteDeleted={props.onNoteDeleted}
          onReload={props.onReload}
          onAnswerSaved={props.onAnswerSaved}
        />
      )}
    </>
  )
})

