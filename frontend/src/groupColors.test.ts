import { expect, test } from 'vitest'
import { GROUP_PALETTE, groupColor, nextGroupColor } from './groupColors'

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}

test('la paleta contrasta sobre ambas superficies y reserva el amarillo para ahora', () => {
  expect(new Set(GROUP_PALETTE.map(c => c.hex)).size).toBe(10)
  for (const { hex } of GROUP_PALETTE) {
    expect(1.05 / (luminance(hex) + 0.05)).toBeGreaterThanOrEqual(3)
    expect((luminance(hex) + 0.05) / (luminance('#1A1A1A') + 0.05)).toBeGreaterThanOrEqual(3)
    expect(hex).not.toBe('#F6C344')
  }
})

test('resuelve por color y conserva el fallback por indice y el ciclo', () => {
  expect(groupColor({ color: null }, 1)).toBe('var(--g-cer)')
  expect(groupColor({ color: '#368c91' }, 0)).toBe('var(--g-turq)')
  expect(groupColor({ color: '#0e6e6b' }, 0)).toBe('#0e6e6b')
  expect(nextGroupColor(GROUP_PALETTE.map(c => ({ color: c.hex })))).toBe('#C0704A')
})
