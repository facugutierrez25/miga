import type { ReactNode } from 'react'
import './Skeleton.css'

export default function Skeleton({ shape = 'line' }: { shape?: 'line' | 'block' }) {
  return <span aria-hidden="true" className={`skeleton skeleton--${shape}`} />
}

export function LoadingSkeleton({ label, children }: { label: string; children?: ReactNode }) {
  return <div className="loading-skeleton" role="status" aria-busy="true">
    <span className="loading-skeleton__text">{label}</span>
    {children ?? <><Skeleton /><Skeleton /><Skeleton /></>}
  </div>
}
