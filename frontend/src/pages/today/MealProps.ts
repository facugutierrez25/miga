import { type DraftStore } from './MealNoteSection'
import { type GroupInfo } from './helpers'
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

