// El texto de la regla llega del backend con decimales técnicos ("90.000 g", "porcion"):
// se muestra como lo escribiría una persona ("90 g", "porción").
export function reglaLegible(regla: string): string {
  return regla
    .replace(/\d+\.\d+/g, n => String(Number(n)).replace('.', ','))
    .replace(/\bporcion\b/g, 'porción')
}
