import { CompoundRows } from './CompoundRows'
import { ItemOrigin, type EntryItemDto, type MealDayDto, type PatchItemResultDto } from '../../api/records'
import { mealStatus } from '../../lib/mealStatus'
import { type GroupInfo } from './helpers'
import { RulesSheet } from './RulesSheet'
import { ItemRow } from './ItemRow'

interface Props {
  rulesOpen: boolean
  setRulesOpen: (open: boolean) => void
  expandedMentions: Set<string>
  setExpandedMentions: React.Dispatch<React.SetStateAction<Set<string>>>
  meal: { id?: number }
  mealDay: MealDayDto | undefined
  items: EntryItemDto[]
  date: string
  token: string
  groupsMap: Record<number, GroupInfo>
  detailOpen: boolean
  feedback: React.ReactNode
  understoodSummary: string
  saving: boolean
  conflict: boolean
  handleRemove: (item: EntryItemDto) => void
  onItemPatched: (mealId: number, result: PatchItemResultDto) => void
}

export function UnderstoodItems({ meal, mealDay, items, date, token, groupsMap, detailOpen, feedback,
  understoodSummary, saving, conflict, handleRemove, onItemPatched, rulesOpen, setRulesOpen,
  expandedMentions, setExpandedMentions }: Props) {
  return (
    <section className="nota-entendido" aria-labelledby={`entendido-${meal.id}`}>
      {detailOpen && feedback}
      <p className="nota-entendido__resumen">
        Entendí: {understoodSummary || 'sin alimentos reconocidos'}.
        {' '}{mealStatus(mealDay).text}.
      </p>
      <div className="nota-entendido__acciones">
        {items.some(item => item.appliedRule || item.origin === ItemOrigin.UNKNOWN) && (
          <button type="button" className="nota-link" onClick={() => setRulesOpen(true)}>Cómo lo calculé</button>
        )}
      </div>
      {rulesOpen && <RulesSheet items={items} groupsMap={groupsMap} onClose={() => setRulesOpen(false)} />}
      <ul className="nota-items">
        {items.filter(item => item.foodGroupId === null && item.origin !== ItemOrigin.UNKNOWN).map(item => <ItemRow
          key={item.id} item={item} date={date} token={token} groupsMap={groupsMap}
          onRemove={() => handleRemove(item)} removing={saving || conflict}
          onPatched={result => onItemPatched(meal.id!, result)} />)}
      </ul>
      <CompoundRows meal={meal} items={items} date={date} token={token} groupsMap={groupsMap}
        saving={saving} conflict={conflict} expandedMentions={expandedMentions}
        setExpandedMentions={setExpandedMentions} handleRemove={handleRemove} onItemPatched={onItemPatched} />
    </section>
  )
}
