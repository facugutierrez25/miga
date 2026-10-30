# Runbook operacional — NutriPlan (Miga)

> Documento vivo. Actualizar ante cualquier cambio en la arquitectura de despliegue.

---

## Índice

1. [Verificar liveness y readiness](#1-verificar-liveness-y-readiness)
2. [Procedimiento de despliegue](#2-procedimiento-de-despliegue)
3. [RPO y RTO](#3-rpo-y-rto)
4. [Guía de incidentes](#4-guía-de-incidentes)
5. [Simulacro de restauración (restore drill)](#5-simulacro-de-restauración-restore-drill)

---

## 1. Verificar liveness y readiness

Spring Actuator expone tres endpoints de salud sin autenticación:

| Endpoint | Propósito | Respuesta esperada |
|---|---|---|
| `GET /actuator/health` | Estado general de la aplicación | `200 {"status":"UP"}` |
| `GET /actuator/health/liveness` | La JVM está corriendo | `200 {"status":"UP"}` |
| `GET /actuator/health/readiness` | La app puede recibir tráfico (DB conectada) | `200 {"status":"UP"}` |

Ejemplos con `curl`:

```bash
curl -s https://<host>/actuator/health | jq .
curl -s https://<host>/actuator/health/liveness | jq .
curl -s https://<host>/actuator/health/readiness | jq .
```

Los endpoints `/actuator/metrics` e `/actuator/info` son operativos: solo responden con el encabezado `X-Ops-Key` igual a la variable `OPS_API_KEY`. Un JWT de paciente no da acceso. Si `OPS_API_KEY` está vacía, nadie accede.

### Cabecera de correlación

Cada respuesta incluye el header `X-Correlation-Id` con un UUID único por petición.
Útil para cruzar logs ante un incidente:

```bash
curl -v https://<host>/api/v1/status 2>&1 | grep X-Correlation-Id
```

---

## 2. Procedimiento de despliegue

El orden importa: la base de datos debe estar disponible antes de iniciar el backend,
porque Flyway ejecuta las migraciones al arrancar.

### 2.1 Base de datos (PostgreSQL 17)

1. Asegurar que el servidor PostgreSQL esté corriendo y accesible.
2. Verificar que exista la base `nutriplan` con el usuario configurado.
3. Las migraciones las aplica Flyway automáticamente al iniciar el backend;
   no hace falta correrlas manualmente.

### 2.2 Backend (Spring Boot)

```bash
# Variables de entorno requeridas (ver .env.example)
export DB_URL=jdbc:postgresql://<host>:5432/nutriplan
export DB_USER=nutriplan
export DB_PASSWORD=<contraseña>
export JWT_SECRET=<secreto-de-al-menos-32-caracteres>
export CORS_ALLOWED_ORIGINS=https://<dominio-frontend>
export APP_BASE_URL=https://<dominio-frontend>
export MAIL_FROM=noreply@<dominio>
export RESEND_API_KEY=<clave>
export OPS_API_KEY=<clave-operativa-larga-y-aleatoria>

# Iniciar
java -jar miga-backend.jar
```

Verificar que la app arrancó correctamente:

```bash
curl -sf https://<host>/actuator/health/readiness || echo "ERROR: backend no disponible"
```

### 2.3 Frontend (React + Vite)

```bash
cd frontend
npm ci
npm run build
# Servir el directorio dist/ con un servidor estático o CDN
```

El frontend espera el backend en `/api` (proxy configurado en Vite para desarrollo;
en producción se configura en el servidor estático o CDN).

---

## 3. RPO y RTO

| Métrica | Objetivo | Estado actual |
|---|---|---|
| **RPO** (pérdida máxima aceptable) | 24 horas | **Bloqueado:** no hay backup automático. Hasta configurarlo, el RPO real es la antigüedad del último `pg_dump` manual. |
| **RTO** (tiempo máximo de recuperación) | 30 minutos | Medido en el ensayo con datos sintéticos (sección 5): restaurar tomó menos de 1 s y el backend arrancó en 9 s. El tiempo real lo dominan descargar el dump y desplegar. |
| **Retención** | 7 diarios + 4 semanales | Pendiente de la automatización. |

**Bloqueo externo (responsable: Facu):** elegir el proveedor de hosting de PostgreSQL y
configurar ahí un `pg_dump` diario automático con la retención indicada y copia fuera del
servidor. Hasta entonces, hacer un backup manual antes de cada despliegue (obligatorio, ver 3.1).

### Backup manual con pg_dump

```bash
# Crear backup
pg_dump -h <host> -U nutriplan -Fc nutriplan > nutriplan_$(date +%Y%m%d_%H%M%S).dump

# Verificar que el archivo no está vacío
ls -lh nutriplan_*.dump
```

### 3.1 Despliegue con migraciones y migración fallida

1. **Antes de desplegar:** backup manual con `pg_dump -Fc` y anotar su nombre.
2. Desplegar el backend: Flyway aplica las migraciones pendientes al arrancar.
3. Verificar `GET /actuator/health/readiness` = 200 y la versión en `flyway_schema_history`.

Si una migración falla, el backend **no arranca** y readiness no responde. Flyway confirma
cada migración por separado: las anteriores a la que falló **quedan aplicadas**, y solo la que
falló se revierte (PostgreSQL ejecuta cada migración en su propia transacción).

1. Ver hasta dónde llegó: `SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;`
2. **Si falló por datos** (por ejemplo, una verificación previa como V23 o V26 que aborta con
   un mensaje): corregir esos datos y volver a desplegar la misma versión; la migración se
   reintenta.
3. **Si falló por un error en su SQL:** como se revirtió y nunca quedó aplicada, se corrige
   **ese mismo archivo** y se despliega una versión nueva. (Un archivo nuevo no alcanza: Flyway
   volvería a ejecutar primero el fallido.) Las migraciones que sí quedaron aplicadas nunca se
   editan; si hay que cambiarlas, se agrega una migración nueva.
4. **Para volver al backend anterior** mientras se corrige: solo si las migraciones que quedaron
   aplicadas son compatibles con esa versión (por ejemplo, agregan columnas opcionales o tablas
   que el backend anterior ignora). Si no lo son, restaurar el backup del paso 1 de despliegue en
   una base nueva, apuntar el backend anterior a ella y verificar con las consultas de integridad
   (sección 5).
5. No usar `flyway repair` en producción sin entender la causa: solo limpia el historial, no
   deshace cambios.

---

## 4. Guía de incidentes

### 4.1 Detectar problemas con el health endpoint

Alerta mínima: un monitor externo (UptimeRobot, Betterstack u otro) sobre readiness, que
incluye la base de datos:

```
GET https://<host>/actuator/health/readiness
Esperar: HTTP 200 y body {"status":"UP"}
Frecuencia: cada 1 minuto; avisar tras 3 fallos seguidos
Destinatario: email de Facu
```

La respuesta no contiene datos personales (`show-details: never`).

**Verificación de la alerta (al configurarla y una vez por trimestre):** en un entorno de
prueba, detener PostgreSQL y comprobar que readiness pasa a 503 y que llega el aviso; luego
levantar la base y comprobar que se normaliza. Que readiness depende de la base está cubierto
por `OpsEndpointsIntegrationTest#readinessIncludesDatabase`.

Si el health endpoint devuelve algo distinto de 200, investigar según la siguiente tabla.

### 4.2 Árbol de diagnóstico

| Síntoma | Causa probable | Acción |
|---|---|---|
| `/actuator/health` devuelve 503 | DB no disponible o conexión saturada | Verificar PostgreSQL, revisar logs con `X-Correlation-Id` |
| `/actuator/health/liveness` devuelve 503 | JVM en estado inválido (OOM, deadlock) | Reiniciar el proceso; revisar heap con `/actuator/metrics/jvm.memory.used` |
| `/actuator/health/readiness` devuelve 503 | DB no responde a tiempo | Revisar pool Hikari: `/actuator/metrics/hikaricp.connections.active` |
| La app no responde (timeout) | Puerto cerrado, proceso caído o red | Verificar proceso y firewall |

### 4.3 Leer métricas internas

Con un JWT válido en `Authorization: Bearer <token>`:

```bash
# Estado del pool de conexiones
curl -H "X-Ops-Key: $OPS_API_KEY" https://<host>/actuator/metrics/hikaricp.connections.active
curl -H "X-Ops-Key: $OPS_API_KEY" https://<host>/actuator/metrics/hikaricp.connections.pending

# Memoria JVM
curl -H "X-Ops-Key: $OPS_API_KEY" https://<host>/actuator/metrics/jvm.memory.used

# Versión desplegada
curl -H "X-Ops-Key: $OPS_API_KEY" https://<host>/actuator/info
```

### 4.4 Buscar logs por correlación

Cada petición tiene un `X-Correlation-Id` en la respuesta y en los logs (campo MDC `correlationId`).
Para correlacionar un error reportado por el usuario:

1. Obtener el `X-Correlation-Id` del error (cabecera de la respuesta o reporte del usuario).
2. Buscar en los logs: `grep "correlationId=<id>" <archivo-de-log>` (o su equivalente en el agregador de logs configurado).

**Restricción de privacidad:** los logs nunca contienen email, userId, tokens ni datos de salud
(Ley 18.331, Uruguay). No agregar esos campos al logging aunque parezca útil para debug.

---

El outbox de correo entrega al menos una vez: si el proceso cae durante el envío, el trabajo se reintenta al vencer el lease (`EMAIL_OUTBOX_LEASE_MS`, por defecto 5 minutos) y puede duplicarse un correo. Un trabajo queda asociado al token con el que se creó: si el usuario pidió un reenvío, el trabajo anterior se descarta sin enviar.

Métricas del outbox (con `X-Ops-Key`): `email.outbox.pending` (pendientes y en proceso) y `email.outbox.jobs` con `result=sent|retried|failed`. No incluyen emails ni tokens.

```bash
curl -H "X-Ops-Key: $OPS_API_KEY" https://<host>/actuator/metrics/email.outbox.pending
curl -H "X-Ops-Key: $OPS_API_KEY" "https://<host>/actuator/metrics/email.outbox.jobs?tag=result:failed"
```

## 5. Simulacro de restauración (restore drill)

Objetivo: verificar periódicamente que un backup puede restaurarse en una base aislada
antes de necesitarlo en un incidente real.

### Frecuencia recomendada

Al menos una vez por sprint o ante cambios importantes en el esquema de la base de datos.

### Pasos

```bash
# 1. Crear un backup desde producción (o usar uno existente)
pg_dump -h <host-prod> -U nutriplan -Fc nutriplan > drill_$(date +%Y%m%d).dump

# 2. Levantar una base temporal aislada
docker run -d \
  --name nutriplan-drill \
  -e POSTGRES_DB=nutriplan_drill \
  -e POSTGRES_USER=drill \
  -e POSTGRES_PASSWORD=drill \
  -p 5433:5432 \
  postgres:17-alpine

# 3. Esperar que PostgreSQL esté listo
sleep 5

# 4. Restaurar el dump en la base temporal
pg_restore \
  -h localhost -p 5433 \
  -U drill -d nutriplan_drill \
  --no-owner --role=drill \
  drill_$(date +%Y%m%d).dump

# 5. Verificar que las tablas existen y tienen datos
psql -h localhost -p 5433 -U drill -d nutriplan_drill \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;"

# 6. Opcional: levantar una instancia del backend apuntando a la base temporal
# y ejecutar los tests de integración contra ella para validar la consistencia.

# 7. Limpiar
docker stop nutriplan-drill && docker rm nutriplan-drill
rm drill_$(date +%Y%m%d).dump
```

### Criterio de éxito

- El dump se restaura sin errores con `--exit-on-error`.
- Las consultas de [`consultas-integridad.sql`](consultas-integridad.sql) dan **el mismo
  resultado** en origen y destino (versión de migración, planes vigentes únicos, reglas e ítems
  sin referencias rotas, porciones totales, registros de hábitos con uid válido).
- El backend arranca contra la base restaurada (Flyway sin migraciones pendientes,
  Hibernate `validate` sin errores) y readiness responde 200.

```bash
psql -h <origen> -U nutriplan -d nutriplan -tA -F'|' -f docs/operacion/consultas-integridad.sql > origen.txt
psql -h localhost -p 5433 -U drill -d nutriplan_drill -tA -F'|' -f docs/operacion/consultas-integridad.sql > destino.txt
diff origen.txt destino.txt && echo "integridad OK"
```

### Último ensayo

| Fecha | Datos | Dump | Restauración | Integridad | Arranque del backend |
|---|---|---|---|---|---|
| 2026-10-30 | Sintéticos ([`datos-sinteticos-ensayo.sql`](datos-sinteticos-ensayo.sql)): 50 usuarios, 150 grupos, 50 reglas, 700 notas, 700 ítems, 700 registros de hábitos; esquema V32 | 319 ms, 94 KB | 643 ms | 14/14 consultas idénticas | 8,4 s, readiness 200 |

### Registro del simulacro

Documentar en la issue o comentario de GitHub:
- Fecha del simulacro
- Antigüedad del dump usado
- Resultado (éxito / error y descripción)
- Tiempo total del proceso
