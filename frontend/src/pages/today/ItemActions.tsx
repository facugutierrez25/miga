import { ItemOrigin, type EntryItemDto } from '../../api/records'
import { ActionsMenu } from './ActionsMenu'

export function ItemActions({ item, disabled, onRemove }: {
  item: EntryItemDto; disabled: boolean; onRemove?: () => void; resultLabel?: string | null
}) {
  if (!onRemove || item.id <= 0 || item.origin === ItemOrigin.ANSWER) return null
  return <ActionsMenu label={`Más opciones de ${item.food}`} actions={[
    { label: 'Quitar', disabled, onClick: onRemove },
  ]} />
}
