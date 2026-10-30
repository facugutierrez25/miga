# ADR-0005: Edición manual de grupos, alimentos y hábitos del plan

**Estado:** aceptado  
**Fecha:** 2026-10-30  
**Complementa:** ADR-0001, ADR-0002

## Contexto

La persona carga a mano los grupos, las reglas de alimentos y los hábitos de su plan (#175). Esa configuración vive dentro de una versión del plan (`plans`), y las notas guardan el `plan_id` con el que se registraron (ADR-0002). Si la configuración de una versión cambiara en el lugar, volver a guardar una nota vieja o consultar un día pasado usaría reglas, nombres o metas que no existían ese día.

Además, guardar las comidas crea una versión nueva del plan; hasta ahora esa versión arrancaba con los grupos por defecto y no copiaba grupos propios, reglas ni hábitos.

## Decisión

### Copia al escribir sobre una versión usada

- Una versión del plan está **usada** cuando tiene notas, ítems registrados en sus comidas o registros de hábitos.
- La configuración de una versión usada no se modifica. La primera edición sobre ella crea una versión nueva (copia completa) y aplica el cambio en la copia. Las ediciones siguientes, mientras la versión nueva no tenga uso, se aplican directamente sobre ella. Así, cargar un plan desde cero no genera una versión por cada cambio.
- Guardar las comidas mantiene su comportamiento: si cambian, se crea una versión nueva.
- Toda versión nueva copia: modo de registro, margen, grupos (con todos sus campos), reglas `PLAN` y `USUARIO` (con los grupos de cada regla y de sus componentes remapeados) y hábitos no archivados. Si un componente no tiene grupo equivalente, la operación se aborta. La copia y la activación ocurren en la misma transacción.

### Identidad estable

Grupos, reglas y hábitos tienen un `uid` que se conserva entre versiones. Un ajuste del usuario sobre el catálogo guarda el `uid` de la regla que sobrescribe (`overrides_rule_uid`), y los registros de hábitos se asocian por `habit_uid`, de modo que Semana muestra la continuidad aunque cambie la versión.

### Coordinación entre módulos

El módulo `planrules` orquesta las operaciones usando solo APIs públicas de `plans`, `reglas`, `habitos`, `intake` y `registro`. Ningún módulo depende de `planrules`. La copia de reglas y hábitos cuando `plans` crea una versión se dispara con el evento `PlanVersionCreated`, escuchado de forma sincrónica dentro de la misma transacción.

### Concurrencia

La versión (`@Version`) del plan actúa como revisión de toda su configuración. Cada mutación envía la versión esperada; si no coincide o el plan ya no está vigente, se responde 409 `VERSION_CONFLICT`. Cada mutación incrementa la versión del plan.

### Lo que se guarda en cada ítem

Cada ítem interpretado guarda el texto de la regla aplicada (`applied_rule`) y un `occurrence_id` común a los componentes de una misma mención de un alimento compuesto. Los ítems anteriores a este cambio quedan sin regla visible; no se reconstruyen con reglas actuales.

## Consecuencias

- Consultar o volver a guardar una nota vieja usa la configuración con la que se registró.
- El historial de versiones puede crecer cuando se edita un plan en uso; cada edición posterior sobre la versión nueva, sin uso todavía, no agrega versiones.
- Los identificadores de grupos, reglas y hábitos cambian al crearse una versión nueva; la API de edición devuelve siempre el estado completo y vigente para que el cliente no dependa de ids viejos.
- Fuera de alcance: fusionar versiones del plan y edición retroactiva de días pasados.
