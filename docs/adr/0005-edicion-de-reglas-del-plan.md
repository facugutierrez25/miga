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
- Por la granularidad diaria del ADR-0002, los registros del día de la copia pasan a la versión nueva: notas y comidas equivalentes (mismo orden y nombre), ítems con sus grupos remapeados y registros de hábitos con el mismo `habit_uid`. Los días anteriores conservan la versión anterior. Una nota cuya comida no tiene equivalente permanece en la versión anterior.
- Guardar las comidas mantiene su comportamiento: si cambian, se crea una versión nueva.
- Toda versión nueva copia: modo de registro, margen, grupos (con todos sus campos), reglas `PLAN` y `USUARIO` (con los grupos de cada regla y de sus componentes remapeados) y hábitos no archivados. Si un componente no tiene grupo equivalente, la operación se aborta. La copia y la activación ocurren en la misma transacción.

### Identidad estable

Grupos, reglas y hábitos tienen un `uid` que se conserva entre versiones. Un ajuste del usuario sobre el catálogo guarda el `uid` de la regla que sobrescribe (`overrides_rule_uid`), y los registros de hábitos se asocian por `habit_uid`, de modo que Semana muestra la continuidad aunque cambie la versión.

### Coordinación entre módulos

El módulo `planrules` orquesta las operaciones usando solo APIs públicas de `plans`, `reglas`, `habitos`, `intake` y `registro`. Ningún módulo depende de `planrules`. La copia de reglas y hábitos cuando `plans` crea una versión se dispara con el evento `PlanVersionCreated`, escuchado de forma sincrónica dentro de la misma transacción.

### Concurrencia

La versión (`@Version`) del plan actúa como revisión de toda su configuración. Cada mutación envía la versión esperada; si no coincide o el plan ya no está vigente, se responde 409 `VERSION_CONFLICT`. Cada mutación incrementa la versión del plan. El bloqueo del plan vigente serializa las ediciones y todos los caminos de escritura de registros: notas, altas manuales, respuestas a grupos faltantes, correcciones con o sin regla, borrados, confirmaciones de consumo y registros de hábitos. Los identificadores se validan después de tomar el bloqueo contra la versión correspondiente; una nota nueva de hoy rechaza comidas de versiones anteriores con 409 `VERSION_CONFLICT`. Las notas existentes validan la comida contra su propio `plan_id`. Las versiones nuevas tienen una revisión mayor que la anterior.

### Lo que se guarda en cada ítem

Cada ítem interpretado guarda el texto de la regla aplicada (`applied_rule`) y un `occurrence_id` común a los componentes de una misma mención de un alimento compuesto. Los ítems anteriores a este cambio quedan sin regla visible; no se reconstruyen con reglas actuales. Al borrar un grupo sin referencias de configuración se desvinculan los ítems de la versión editable, conservando sus porciones y la regla aplicada.

## Consecuencias

- Consultar o volver a guardar una nota de días anteriores usa la configuración con la que se registró.
- El historial de versiones puede crecer cuando se edita un plan en uso; cada edición posterior sobre la versión nueva, sin uso todavía, no agrega versiones.
- Los identificadores de grupos, reglas y hábitos cambian al crearse una versión nueva; la API de edición devuelve siempre el estado completo y vigente para que el cliente no dependa de ids viejos.
- "Guardar como regla" al corregir un ítem agrega la regla del usuario a la versión vigente sin copiarla: su propósito es aplicarse a los próximos registros. Solo se permite sobre ítems de la versión vigente.
- Una corrección normal guardada como regla expresa la cantidad por porción (`cantidad / porciones`, con tres decimales) y usa porción por defecto 1; exige porciones mayores a cero. Al actualizar esa regla se conservan sus sinónimos, unidos sin duplicados normalizados a los nuevos. Crear o renombrar una regla exige un nombre único normalizado dentro de la versión del usuario.
- Volver a guardar una nota la reinterpreta entera y descarta sus correcciones; para conservar una corrección se guarda como regla.
- Fuera de alcance: fusionar versiones del plan y edición retroactiva de días pasados.
