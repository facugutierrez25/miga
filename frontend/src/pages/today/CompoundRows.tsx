import { ItemOrigin, type EntryItemDto, type PatchItemResultDto } from '../../api/records'
import { displayUnit } from '../../lib/displayUnit'
import { type GroupInfo, groupByMention, fmt } from './helpers'
import { ItemRow } from './ItemRow'
import { ItemActions } from './ItemActions'

interface Props {
  meal: { id?: number }
  items: EntryItemDto[]
  date: string
  token: string
  groupsMap: Record<number, GroupInfo>
  saving: boolean
  conflict: boolean
  expandedMentions: Set<string>
  setExpandedMentions: React.Dispatch<React.SetStateAction<Set<string>>>
  handleRemove: (item: EntryItemDto) => void
  onItemPatched: (mealId: number, result: PatchItemResultDto) => void
}

export function CompoundRows({ meal, items, date, token, groupsMap, saving, conflict,
  expandedMentions, setExpandedMentions, handleRemove, onItemPatched }: Props) {
  return (
    <ul className="nota-items" id={`entendido-detalle-${meal.id}`}>
      {groupByMention(items.filter(item => item.foodGroupId !== null && item.origin !== ItemOrigin.UNKNOWN)).map(mention => {
        const renderRow = (item: EntryItemDto) => (
          <ItemRow
            key={item.id}
            item={item}
            onRemove={mention.length === 1 ? () => handleRemove(item) : undefined}
            removing={saving || conflict}
            date={date}
            token={token}
            groupsMap={groupsMap}
            onPatched={result => onItemPatched(meal.id!, result)}
          />
        )
        if (mention.length === 1) return renderRow(mention[0])
        const [first] = mention
        const mentionKey = first.occurrenceId!
        const expanded = expandedMentions.has(mentionKey)
        const detailId = `grupos-${meal.id}-${first.id}`
        return (
          <li key={first.occurrenceId} className="nota-compuesto">
            <div className="nota-compuesto__header">
              <span className="nota-compuesto__dots" aria-hidden="true">
                {mention.map(item => <span key={item.id} className="nota-item__dot"
                  style={{ background: (item.foodGroupId !== null ? groupsMap[item.foodGroupId]?.token : null) ?? 'var(--muted)' }} />)}
              </span>
              <div className="nota-compuesto__contenido">
                <p className="nota-compuesto__titulo">
                  {first.food}
                  {first.quantity !== null && <> · {fmt(first.quantity)} {displayUnit(first.unit, first.quantity)}</>}
                </p>
                <p className="nota-compuesto__grupos">{mention.map(item =>
                  `${item.portions !== null ? fmt(item.portions) + ' ' : ''}${(item.foodGroupId !== null ? groupsMap[item.foodGroupId]?.name : null) || 'Grupo del plan'}`
                ).join(' · ')}</p>
              </div>
              <button type="button" className="nota-item__edit" aria-label={`Corregir grupos de ${first.food}`}
                aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpandedMentions(previous => {
                  const next = new Set(previous)
                  if (next.has(mentionKey)) next.delete(mentionKey)
                  else next.add(mentionKey)
                  return next
                })}>
                Corregir
              </button>
              <ItemActions item={first} disabled={saving || conflict} onRemove={() => handleRemove(first)}
                resultLabel={mention.map(item =>
                  `${item.portions !== null ? fmt(item.portions) + ' ' : ''}${(item.foodGroupId !== null ? groupsMap[item.foodGroupId]?.name : null) || 'Grupo del plan'}`
                ).join(' + ')} />
            </div>
            <ul id={detailId} hidden={!expanded} className="nota-items" aria-label={`Grupos de ${first.food}`}>
              {mention.map(item => renderRow(item))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
