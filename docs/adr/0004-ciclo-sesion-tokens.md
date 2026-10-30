# ADR 0004: Ciclo de sesión y transporte de tokens

**Estado:** Aceptado  
**Fecha:** 2026-10-30

## Contexto

La implementación inicial almacenaba el access token JWT en `localStorage`. Ese mecanismo expone el token a scripts de terceros (XSS). El issue #186 requiere eliminar tokens persistentes accesibles por JS y documentar las decisiones del ciclo de sesión.

## Decisiones

### 1. Access token en memoria (estado React)

El token JWT se guarda únicamente en el estado React (`useState`) sin escribirse en `localStorage`, `sessionStorage` ni cookies. Consecuencia: al recargar la página se pierde la sesión y el usuario debe iniciar sesión de nuevo.

**Por qué:** elimina la superficie de ataque XSS más directa sin introducir complejidad de CSRF. En una aplicación de nutrición con sesiones de pocos minutos, la UX es aceptable.

### 2. Tokens de refresco (trabajo futuro)

Si la UX de relogin frecuente resulta inaceptable, se evaluará un refresh token rotatorio almacenado en cookie `HttpOnly Secure SameSite=Strict`. Ese cambio requiere:
- Backend: endpoint `/auth/refresh`, tabla de refresh tokens revocables y rotación en cada uso.
- Backend: CSRF explícito o verificación de `Origin`/`Referer` en el endpoint de refresco.
- Frontend: interceptor para renovar silenciosamente antes de que venza el access token.

No se migra a cookies manteniendo CSRF desactivado.

### 3. Subject del token

El subject (`sub`) del JWT es el email del usuario. El email es inmutable en la implementación actual; si en el futuro se permite cambio de email, habrá que migrar el subject a userId y actualizar `JwtAuthenticationFilter`.

### 4. Vigencia del access token

24 horas. Se revisará junto con el refresh token si se implementa.

### 5. Rate limiting

Los endpoints públicos `POST /api/v1/users/login`, `POST /api/v1/users` y `POST /api/v1/auth/resend-verification` están protegidos por `RateLimitFilter` con límites en memoria por IP.

**Limitaciones documentadas:**
- Los contadores son por instancia; en despliegues con múltiples instancias no se comparten. Para compartir estado de rate limiting entre instancias se requiere Redis o un proveedor externo.
- La IP se extrae de `X-Forwarded-For` (primer valor) si está presente, o de `remoteAddr`. En producción, el proxy inverso debe configurarse para enviar `X-Forwarded-For` confiable.

### 6. CSRF

CSRF está desactivado porque la API es completamente stateless (sin cookies de sesión). Si en el futuro se agregan cookies `HttpOnly`, deberá habilitarse la protección CSRF o implementarse verificación de `Origin`.

## Alternativas descartadas

- **Cookie HttpOnly para el access token ahora:** añade CSRF inmediatamente y complica el manejo del token en el frontend sin beneficio proporcional para la fase actual del producto.
- **Mantener localStorage:** expone el token a XSS; rechazado explícitamente en #186.
