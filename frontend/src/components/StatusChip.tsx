import { mealStatus } from '../lib/mealStatus'
import './StatusChip.css'

export default function StatusChip({ status }: { status: string }) {
  const { kind, label } = mealStatus({ status, noteText: null })
  return <span className={`status-chip status-chip--${status === 'FLEXIBLE' ? 'flexible' : kind}`}>{label}</span>
}
