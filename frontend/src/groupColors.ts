export const GROUP_PALETTE = [
  { hex: '#C0704A', name: 'Terracota', standardKey: 'proteinas', token: '--g-prot' },
  { hex: '#A8822E', name: 'Ocre', standardKey: 'cereales_tuberculos', token: '--g-cer' },
  { hex: '#B5627A', name: 'Rosa', standardKey: 'frutas', token: '--g-frut' },
  { hex: '#4F86B8', name: 'Azul', standardKey: 'lacteos', token: '--g-lac' },
  { hex: '#8070B0', name: 'Violeta', standardKey: 'aceites_grasas', token: '--g-gras' },
  { hex: '#4E8F6A', name: 'Verde', standardKey: 'verduras', token: '--g-verd' },
  { hex: '#368C91', name: 'Turquesa', standardKey: null, token: '--g-turq' },
  { hex: '#95715D', name: 'Tierra', standardKey: null, token: '--g-tierra' },
  { hex: '#6675A0', name: 'Índigo', standardKey: null, token: '--g-indigo' },
  { hex: '#AD5860', name: 'Coral', standardKey: null, token: '--g-coral' },
] as const

export function groupColor(group: { color: string | null }, index: number): string {
  const color = group.color ?? GROUP_PALETTE[index % GROUP_PALETTE.length].hex
  const entry = GROUP_PALETTE.find(c => c.hex.toLowerCase() === color.toLowerCase())
  return entry ? `var(${entry.token})` : color
}

export function nextGroupColor(groups: { color: string | null }[]): string {
  return GROUP_PALETTE.find(c => !groups.some(g => g.color?.toLowerCase() === c.hex.toLowerCase()))?.hex
    ?? GROUP_PALETTE[groups.length % GROUP_PALETTE.length].hex
}
