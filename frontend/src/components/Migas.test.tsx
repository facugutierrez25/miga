import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Migas from './Migas'
import { formatPortions, migaSlots } from './migaSlots'

describe('migaSlots', () => {
  it('una miga por porción, llena hasta lo comido', () => {
    expect(migaSlots(2, 5)).toEqual([
      { capacity: 1, filled: 1 }, { capacity: 1, filled: 1 },
      { capacity: 1, filled: 0 }, { capacity: 1, filled: 0 }, { capacity: 1, filled: 0 },
    ])
  })

  it('media porción del plan es media miga', () => {
    expect(migaSlots(0, 2.5)).toEqual([
      { capacity: 1, filled: 0 }, { capacity: 1, filled: 0 }, { capacity: 0.5, filled: 0 },
    ])
    expect(migaSlots(2.5, 2.5).at(-1)).toEqual({ capacity: 0.5, filled: 0.5 })
  })

  it('media porción comida rellena media miga', () => {
    expect(migaSlots(1.5, 2)).toEqual([{ capacity: 1, filled: 1 }, { capacity: 1, filled: 0.5 }])
  })

  it('lo comido de más no agrega migas', () => {
    expect(migaSlots(6, 5)).toHaveLength(5)
    expect(migaSlots(6, 5).every(s => s.filled === 1)).toBe(true)
  })
})

describe('Migas', () => {
  it('cada grupo se anuncia con su nombre y cantidades', () => {
    render(<Migas rows={[
      { id: 1, name: 'Proteínas', color: 'var(--g-prot)', done: 2, total: 5 },
      { id: 2, name: 'Grasas', color: 'var(--g-gras)', done: 0.5, total: 2.5 },
    ]} />)
    expect(screen.getByRole('img', { name: 'Proteínas: 2 de 5 porciones' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Grasas: 0,5 de 2,5 porciones' })).toBeInTheDocument()
  })

  it('dice cuánto se comió de más', () => {
    render(<Migas rows={[{ id: 1, name: 'Cereales', color: 'var(--g-cer)', done: 7, total: 6 }]} />)
    expect(screen.getByRole('img', { name: 'Cereales: 7 de 6 porciones, 1 de más' })).toBeInTheDocument()
  })

  it('formatea con coma decimal', () => {
    expect(formatPortions(0.5)).toBe('0,5')
    expect(formatPortions(3)).toBe('3')
  })
})
