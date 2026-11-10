import { type DraftStore, MealNoteSection } from './MealNoteSection'
import { type GroupInfo, mealCrumbs } from './helpers'
import { memo } from 'react'
import Crumbs from '../../components/Crumbs'
import MealCard from '../../components/MealCard'
import { type MealDto } from '../../api/plans'
import {
  type DayRecordDto,
  type MealDayDto,
  type NoteInterpretationDto,
  type PatchItemResultDto,
} from '../../api/records'

export interface MealProps {
  meal: MealDto
  drafts: DraftStore
  mealDay: MealDayDto | undefined
  date: string
  token: string
  groupsMap: Record<number, GroupInfo>
  onNoteSaved: (interp: NoteInterpretationDto, mealId: number) => void
  onItemPatched: (mealId: number, result: PatchItemResultDto) => void
  onNoteDeleted: (mealId: number, version: number | null, submittedText: string) => void
  onReload: () => Promise<DayRecordDto>
  onAnswerSaved: (mealId: number) => Promise<void>
}

export const MealDetail = memo(function MealDetail(props: MealProps & { showCard?: boolean }) {
  const { meal, mealDay, date, token, groupsMap, showCard = false } = props
  const rows = mealCrumbs(meal, mealDay, groupsMap)
  return (
    <>
      {showCard && rows.length > 0
        ? <MealCard name={meal.name} rows={rows} />
        : <Crumbs rows={rows} differencesOnly />}
      {meal.id !== undefined && (
        <MealNoteSection
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

