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

> Estado actual: sin backup automatizado configurado.

| Métrica | Valor actual | Notas |
|---|---|---|
| **RPO** (Recovery Point Objective) | Último backup manual | No hay backup automático. El RPO real es la antigüedad del último `pg_dump` ejecutado manualmente. |
| **RTO** (Recovery Time Objective) | ~30 minutos | Incluye: restaurar el dump (~5 min), reiniciar el backend (~2 min) y verificar con health check (~1 min). Estimación en condiciones normales; puede variar. |

### Backup manual con pg_dump

```bash
# Crear backup
pg_dump -h <host> -U nutriplan -Fc nutriplan > nutriplan_$(date +%Y%m%d_%H%M%S).dump

# Verificar que el archivo no está vacío
ls -lh nutriplan_*.dump
```

**Recomendación a futuro:** configurar un cron job o tarea programada que ejecute
`pg_dump` al menos una vez al día y suba el dump a almacenamiento externo (S3 o similar).

---

## 4. Guía de incidentes

### 4.1 Detectar problemas con el health endpoint

Configurar una alerta externa (UptimeRobot, Betterstack u otro servicio) sobre:

```
GET https://<host>/actuator/health
Esperar: HTTP 200 y body contiene "UP"
Frecuencia: cada 1 minuto
```

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

El outbox de correo entrega al menos una vez: si el proceso cae durante el envío, el trabajo se reintenta al vencer el lease (`EMAIL_OUTBOX_LEASE_MS`, por defecto 5 minutos) y puede duplicarse un correo.

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

- El dump se restaura sin errores fatales.
- Las tablas principales existen: `users`, `plans`, `meals`, `food_entries`, etc.
- Al menos una consulta de negocio devuelve datos coherentes.

### Registro del simulacro

Documentar en la issue o comentario de GitHub:
- Fecha del simulacro
- Antigüedad del dump usado
- Resultado (éxito / error y descripción)
- Tiempo total del proceso
