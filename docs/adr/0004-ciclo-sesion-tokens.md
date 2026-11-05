# ADR 0004: Ciclo de sesión y transporte de tokens

**Estado:** Aceptado  
**Fecha:** 2026-10-30 (actualizado 2026-11-05: refresh token, issue #296)

## Contexto

La implementación inicial almacenaba el access token JWT en `localStorage`. Ese mecanismo expone el token a scripts de terceros (XSS). El issue #186 requiere eliminar tokens persistentes accesibles por JS y documentar las decisiones del ciclo de sesión.

## Decisiones

### 1. Access token en memoria (estado React)

El token JWT se guarda únicamente en el estado React (`useState`) sin escribirse en `localStorage`, `sessionStorage` ni cookies. Al recargar la página o abrir la app se restaura con el refresh token (decisión 2).

**Por qué:** elimina la superficie de ataque XSS más directa sin introducir complejidad de CSRF. En una aplicación de nutrición con sesiones de pocos minutos, la UX es aceptable.

### 2. Refresh token rotatorio en cookie HttpOnly

Volver a iniciar sesión cada vez que se abre la app desde el inicio del teléfono resultó inaceptable (#296). Se implementa:

- **Cookie** `miga_rt`: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, 30 días. JavaScript no puede leerla y solo viaja a los endpoints de sesión.
- **Mismo sitio:** el backend se sirve en `api.miga.uy` y la app en `miga.uy`. Con un dominio de otro sitio (por ejemplo `onrender.com`) Safari bloquea la cookie. Las vistas previas de Vercel (`*.vercel.app`) no restauran la sesión.
- **Almacenamiento:** tabla `refresh_tokens` con el hash SHA-256 del token, nunca el valor. Cada token pertenece a una familia (un inicio de sesión en un dispositivo). Borrar la cuenta elimina sus tokens en cascada.
- **Rotación:** `POST /api/v1/auth/refresh` marca el token como usado y entrega uno nuevo de la misma familia junto con un access token. Reusar un token ya usado revoca toda la familia (posible robo), salvo dentro de 30 segundos, para tolerar pestañas que refrescan a la vez. El frontend además serializa el refresh entre pestañas con `navigator.locks` cuando existe.
- **Cierre de sesión:** `POST /api/v1/auth/logout` revoca la familia y borra la cookie.
- **CSRF:** `/auth/refresh` y `/auth/logout` exigen un encabezado `Origin` de la misma lista permitida por CORS, además de `SameSite=Strict`. CORS permite credenciales solo para esos orígenes explícitos.
- **Frontend:** `credentials: 'include'` solo en login, refresh y logout. Al abrir la app se intenta restaurar la sesión antes de decidir si redirigir al inicio.

### 3. Subject del token

El subject (`sub`) del JWT es el email del usuario. El email es inmutable en la implementación actual; si en el futuro se permite cambio de email, habrá que migrar el subject a userId y actualizar `JwtAuthenticationFilter`.

### 4. Vigencia del access token

24 horas. El refresh token la renueva al abrir la app; una sesión abierta más de 24 horas sin recargar pide iniciar sesión otra vez.

### 5. Rate limiting

Los endpoints públicos `POST /api/v1/users/login`, `POST /api/v1/users` y `POST /api/v1/auth/resend-verification` están protegidos por `RateLimitFilter` con límites en memoria por IP.

**Limitaciones documentadas:**
- Los contadores son por instancia; en despliegues con múltiples instancias no se comparten. Para compartir estado de rate limiting entre instancias se requiere Redis o un proveedor externo.
- La IP se extrae de `X-Forwarded-For` (primer valor) si está presente, o de `remoteAddr`. En producción, el proxy inverso debe configurarse para enviar `X-Forwarded-For` confiable.

### 6. CSRF

La protección CSRF de Spring está desactivada porque el resto de la API se autentica con el encabezado `Authorization: Bearer`, que un sitio ajeno no puede enviar. Los únicos endpoints que actúan con una cookie (`/auth/refresh` y `/auth/logout`) verifican el `Origin` (decisión 2).

## Alternativas descartadas

- **Cookie HttpOnly para el access token ahora:** añade CSRF inmediatamente y complica el manejo del token en el frontend sin beneficio proporcional para la fase actual del producto.
- **Mantener localStorage:** expone el token a XSS; rechazado explícitamente en #186.
