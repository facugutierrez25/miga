export function formatNumber(value: number): string {
  return value.toLocaleString('es-UY', { maximumFractionDigits: 20 })
}
