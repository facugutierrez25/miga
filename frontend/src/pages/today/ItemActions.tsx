import { ItemOrigin, type EntryItemDto } from '../../api/records'
import { RuleDialog } from './RuleDialog'
import { ActionsMenu } from './ActionsMenu'
import { useState } from 'react'

export function ItemActions({ item, disabled, onRemove, resultLabel = null }: {
  item: EntryItemDto; disabled: boolean; onRemove?: () => void; resultLabel?: string | null
}) {
  const [showRule, setShowRule] = useState(false)
  return <>
    <ActionsMenu label={`Más opciones de ${item.food}`} actions={[
      ...(item.origin !== ItemOrigin.UNKNOWN ? [{ label: 'Cómo lo calculé', disabled: !item.appliedRule, onClick: () => setShowRule(true) }] : []),
      ...(onRemove && item.id > 0 && item.origin !== ItemOrigin.ANSWER
        ? [{ label: 'Quitar', disabled, onClick: onRemove }] : []),
    ]} />
    {showRule && <RuleDialog item={item} resultLabel={resultLabel} onClose={() => setShowRule(false)} />}
  </>
}

