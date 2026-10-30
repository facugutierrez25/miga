# ADR-0003: Separación entre propuesta/interpretación e ingesta confirmada

**Estado:** aceptado  
**Fecha:** 2026-10-30

## Contexto

El sistema recibe texto libre del usuario ("leche, pan") y lo interpreta produciendo ítems propuestos con grupos y porciones. El mismo sistema recibe entradas manuales del formulario (food, quantity, unit, foodGroupId). La comparación contra el plan debe basarse en lo que el usuario confirmó como consumido, no en estimaciones pendientes.

## Decisión

### Fuente de verdad: backend

El backend es el único responsable de calcular y persistir porciones (`porciones` en `food_entries`). El frontend no debe recalcular porciones con equivalencias propias; debe usar el campo `portions` devuelto por la API.

### Porciones para entradas manuales

Cuando el usuario agrega un ítem vía formulario (`POST /api/v1/intake/{date}/{mealId}`):
- Si existe una regla para ese alimento + grupo en el plan activo: se calcula `quantity / cantidadPorPorcion` (o `porcionPorDefecto * quantity` si no hay unidad de referencia).
- Si no existe regla: `porciones = null` — la entrada no contribuye a la comparación pero sí aparece en el historial.

### Semántica de comparación

- Se comparan **todas** las comidas del plan, tengan nota o no.
- Entradas con `porciones = null` se ignoran en la comparación (no cuentan como cero ni como incumplimiento).
- LIBRE y NO_CUENTA producen `porciones = 0` y se excluyen de la comparación.
- Sin datos registrados ≠ incumplimiento — la comparación refleja lo confirmado, no lo esperado.

## Consecuencias

- El frontend elimina `calcPortions` y la dependencia a `getEquivalences` en `HoyPage`.
- Entradas manuales sin regla son visibles pero no penalizan la comparación.
