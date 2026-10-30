# Actualización de una base existente

## Backup previo

Detener las escrituras y los procesos del backend durante toda la actualización.
Identificar la versión desplegada y consultar `flyway_schema_history` para conocer
las migraciones pendientes. Guardar un backup completo con `pg_dump --format=custom`
y comprobar su restauración con `pg_restore` en una base aislada. Conservar también
la configuración y el artefacto anterior. No continuar sin una restauración probada.

## Verificación previa

Restaurar el backup en un entorno de ensayo y arrancar la nueva versión apuntando
exclusivamente a esa copia. Flyway ejecuta automáticamente el callback previo a
cada migración: antes de V8 cuenta todas las filas de `meal_logs`; antes de V12
cuenta los `food_entries` sin equivalencia entre su `food_group` y los grupos del
plan de su comida (incluye comidas inexistentes). Un conteo mayor que cero aborta
con el número de filas y la tabla afectada. Por defecto no se permite esa pérdida.

La protección solo cubre bases que aún deban atravesar V8 o V12; no recupera datos
eliminados por versiones ya aplicadas. Mantener el acceso exclusivo durante la
verificación y migración para impedir nuevas escrituras entre ambas operaciones.

## Si la verificación aborta

No editar migraciones existentes ni marcar la migración como aplicada. Conservar
el backup y exportar las filas afectadas para analizarlas. Para V8, preservar los
registros en un archivo o almacenamiento acordado antes de retirarlos de la tabla.
Para V12, corregir las referencias a comidas y los grupos heredados usando las
equivalencias PROTEINS→PRO, GRAINS→CER, FRUITS→FRU, DAIRY→LAC, FATS→GRA,
VEGETABLES→VER. Verificar que el grupo exista en el plan de cada comida.
Repetir el ensayo y revisar los conteos.

Solo si se acepta explícitamente la pérdida de esas filas, arrancar esa ejecución
con `--app.migrations.allow-legacy-data-loss=true` (variable de entorno:
`APP_MIGRATIONS_ALLOW_LEGACY_DATA_LOSS=true`). Esta opción autoriza ambas pérdidas;
no repara datos ni saltea otras restricciones. Retirarla inmediatamente después.
El aborto conserva las filas de la migración bloqueada; las migraciones anteriores
pueden haber quedado aplicadas. Consultar el historial antes de reintentar.

## Despliegue

Con el ensayo aprobado y las escrituras aún detenidas, desplegar el nuevo backend
contra la base de destino con la autorización de pérdida desactivada por defecto.
Flyway migra al arrancar y Hibernate valida el esquema con `ddl-auto=validate`.
Esperar el arranque completo antes de habilitar tráfico y desplegar el frontend
compatible. Nunca usar `ddl-auto=update` para resolver un fallo de validación.

## Verificación posterior

Ejecutar [consultas-integridad.sql](consultas-integridad.sql) sobre la base migrada;
los conteos de anomalías deben ser cero. Revisar el historial de Flyway, readiness,
login y lectura de plan, registro diario y semana con un usuario de prueba.
Comparar los conteos de datos con el backup, descontando únicamente las pérdidas
autorizadas. Habilitar escrituras cuando todas las comprobaciones sean correctas.
Si falla una comprobación, mantener el servicio detenido y evaluar la restauración
del backup con el artefacto anterior; revertir solo el binario no revierte el esquema.

## Contratos de API

El backend compara la serialización real de los DTO con los JSON versionados en
`frontend/src/test/contracts`. Para un cambio deliberado, ejecutar en `backend`
`mvn -Dtest=ApiContractsTest -Dcontracts.update=true test`, revisar los diffs y
actualizar los valores esperados tipados del test de frontend. Ejecutar ambos
conjuntos de tests y el build de TypeScript antes de desplegar.
