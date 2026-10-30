import { describe, expect, it } from 'vitest'
import type { DayRegistroDto } from '../../api/registro'
import day_registroJson from './day-registro.json?raw'
import type { PlanDto } from '../../api/plans'
import planJson from './plan.json?raw'
import type { PlanRules } from '../../api/planRules'
import plan_rulesJson from './plan-rules.json?raw'
import type { WeekSummaryDto } from '../../api/semana'
import week_summaryJson from './week-summary.json?raw'

// Valores esperados tipados: el compilador verifica el contrato y Vitest el JSON real.
describe('contratos del backend', () => {
  it('DayRegistroDto conserva los campos consumidos por las páginas', () => {
    const expected: DayRegistroDto = {
      "date": "2026-01-05",
      "meals": [
        {
          "mealId": 1,
          "noteId": 1,
          "noteText": "Sintético",
          "noteVersion": 1,
          "items": [
            {
              "id": 1,
              "food": "Sintético",
              "quantity": 1.5,
              "unit": "Sintético",
              "foodGroupId": 1,
              "portions": 1.5,
              "origin": "Sintético",
              "uncertain": true,
              "originalText": "Sintético",
              "appliedRule": "Sintético",
              "occurrenceId": "00000000-0000-0000-0000-000000000001"
            }
          ],
          "comparison": [
            {
              "foodGroupId": 1,
              "name": "Sintético",
              "expected": 1.5,
              "recorded": 1.5,
              "status": "OK",
              "dailyGoal": 1.5
            }
          ]
        }
      ],
      "summary": [
        {
          "foodGroupId": 1,
          "name": "Sintético",
          "clave": "Sintético",
          "totalRecorded": 1.5,
          "dailyGoal": 1.5
        }
      ]
    }
    const parsed: unknown = JSON.parse(day_registroJson)
    expect(parsed).toEqual(expected)
  })
  it('PlanDto conserva los campos consumidos por las páginas', () => {
    const expected: PlanDto = {
      "foodGroups": [
        {
          "id": 1,
          "name": "Sintético",
          "abbreviation": "Sintético",
          "displayOrder": 1,
          "color": "Sintético",
          "clave": "Sintético",
          "preguntarSiFalta": true,
          "opcional": true,
          "metaDiaria": 1.5,
          "uid": "00000000-0000-0000-0000-000000000001"
        }
      ],
      "meals": [
        {
          "id": 1,
          "name": "Sintético",
          "suggestedTime": "08:30:00",
          "displayOrder": 1,
          "portions": [
            {
              "foodGroupId": 1,
              "portions": 1.5
            }
          ]
        }
      ],
      "version": 1,
      "createdAt": "2026-01-05"
    }
    const parsed: unknown = JSON.parse(planJson)
    expect(parsed).toEqual(expected)
  })
  it('PlanRules conserva los campos consumidos por las páginas', () => {
    const expected: PlanRules = {
      "planId": 1,
      "planVersion": 1,
      "modoRegistro": "Sintético",
      "grupos": [
        {
          "id": 1,
          "name": "Sintético",
          "abbreviation": "Sintético",
          "displayOrder": 1,
          "color": "Sintético",
          "clave": "Sintético",
          "preguntarSiFalta": true,
          "opcional": true,
          "metaDiaria": 1.5,
          "uid": "00000000-0000-0000-0000-000000000001"
        }
      ],
      "alimentos": [
        {
          "uid": "00000000-0000-0000-0000-000000000001",
          "alcance": "Sintético",
          "alimento": "Sintético",
          "sinonimos": [
            "Sintético"
          ],
          "tipo": "NORMAL",
          "groupUid": "00000000-0000-0000-0000-000000000001",
          "cantidadPorPorcion": 1.5,
          "unidad": "Sintético",
          "porcionPorDefecto": 1.5,
          "componentes": [
            {
              "groupUid": "00000000-0000-0000-0000-000000000001",
              "porciones": 1.5
            }
          ],
          "overridesRuleUid": "00000000-0000-0000-0000-000000000001",
          "textoRegla": "Sintético"
        }
      ],
      "habitos": [
        {
          "uid": "00000000-0000-0000-0000-000000000001",
          "id": 1,
          "name": "Sintético",
          "habitType": "CANTIDAD",
          "unit": "Sintético",
          "goal": 1.5,
          "period": "DIA",
          "step": 1.5,
          "displayOrder": 1,
          "countsFlexibleMeals": true
        }
      ]
    }
    const parsed: unknown = JSON.parse(plan_rulesJson)
    expect(parsed).toEqual(expected)
  })
  it('WeekSummaryDto conserva los campos consumidos por las páginas', () => {
    const expected: WeekSummaryDto = {
      "weekStart": "2026-01-05",
      "weekEnd": "2026-01-05",
      "habits": [
        {
          "id": 1,
          "name": "Sintético",
          "habitType": "CANTIDAD",
          "unit": "Sintético",
          "dailyGoal": 1.5,
          "step": 1.5,
          "period": "DIA",
          "countsFlexibleMeals": true,
          "displayOrder": 1
        }
      ],
      "days": [
        {
          "date": "2026-01-05",
          "hasData": true,
          "totalRecorded": 1.5,
          "totalGoal": 1.5,
          "habitLogs": [
            {
              "habitId": 1,
              "date": "2026-01-05",
              "value": 1.5
            }
          ],
          "meals": [
            {
              "mealId": 1,
              "name": "Sintético",
              "noteText": "Sintético",
              "status": "OK",
              "flexibleCount": 1
            }
          ],
          "habitIds": [
            1
          ]
        }
      ]
    }
    const parsed: unknown = JSON.parse(week_summaryJson)
    expect(parsed).toEqual(expected)
  })
})
