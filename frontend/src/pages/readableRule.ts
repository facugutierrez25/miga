// El texto de la regla llega del backend con decimales técnicos ("90.000 g", "porcion"):
// se muestra como lo escribiría una persona ("90 g", "porción").
export function readableRule(rule: string): string {
  return rule
    .replace(/\d+\.\d+/g, n => String(Number(n)).replace('.', ','))
    .replace(/\bporcion\b/g, 'porción')
}
