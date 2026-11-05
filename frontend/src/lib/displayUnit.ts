export function displayUnit(unit: string | null, quantity: number | null): string {
  if (['p.', 'porcion', 'porción', 'porciones'].includes(unit ?? '')) {
    return quantity === 1 ? 'porción' : 'porciones'
  }
  if (['u', 'unidad', 'unidades'].includes(unit ?? '')) {
    return quantity === 1 ? 'unidad' : 'unidades'
  }
  return unit ?? ''
}
