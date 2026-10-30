# ADR-0002: Vigencia del plan y contexto histórico de registros

**Estado:** aceptado  
**Fecha:** 2026-10-30

## Contexto

Un usuario puede actualizar su plan nutricional. Cada vez que lo guarda, el plan anterior queda con `is_current=false` y `superseded_at=NOW()`. El sistema debe poder responder: "¿cuál era el plan activo el día X?", de modo que consultar o corregir un registro histórico no mezcle grupos ni porciones del plan actual.

## Decisión

### Resolución del plan por fecha

Para una fecha D, el plan activo es aquel que cumple:
- `created_at::date <= D`
- Y (`superseded_at IS NULL` O `superseded_at::date >= D`)

Si hay más de uno (cambio de plan en el mismo día), se toma el de mayor `created_at`. Si no hay ninguno para esa fecha (la fecha es anterior a cualquier plan), se usa el más antiguo disponible del usuario.

La granularidad es **diaria**: se asume que el plan rige el día completo a partir de su `created_at`. No se modela vigencia por hora.

### Snapshot del plan en la nota

`meal_notes` almacena `plan_id` al momento de guardar la nota. Al re-interpretar una nota histórica, se usa ese `plan_id` en lugar de resolver por fecha, garantizando que el contexto (grupos, porciones, reglas) sea el original incluso si el plan fue eliminado o modificado después.

## Consecuencias

- Consultar un día pasado devuelve comidas, grupos y objetivos del plan que estaba activo ese día.
- Re-interpretar una nota histórica usa el mismo plan con el que fue originalmente guardada.
- Activar un plan nuevo no reescribe el historial.
- Fuera de alcance: edición masiva retroactiva y cambio de plan con backfill de grupos incompatibles.
