package uy.miga;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Filtro que asigna un ID de correlación único a cada petición HTTP.
 * Acepta un UUID recibido en {@code X-Correlation-Id} o genera uno nuevo.
 * El ID se almacena en MDC bajo la clave {@code correlationId}, aparece en cada línea
 * de log (patrón en application.yml) y se devuelve
 * en la cabecera {@code X-Correlation-Id} de la respuesta.
 *
 * <p>Restricción de privacidad: nunca loguear email, userId, tokens ni datos de salud.</p>
 */
@Component
@Order(1)
class CorrelationIdFilter extends OncePerRequestFilter {

    static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String correlationId = validOrNew(request.getHeader(CORRELATION_ID_HEADER));

        MDC.put(MDC_KEY, correlationId);
        response.setHeader(CORRELATION_ID_HEADER, correlationId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }

    // Solo se acepta un UUID del cliente: cualquier otro valor (vacío, largo, con saltos
    // de línea) se reemplaza para no inyectar texto arbitrario en los logs.
    static String validOrNew(String header) {
        if (header != null) {
            try {
                return UUID.fromString(header.strip()).toString();
            } catch (IllegalArgumentException ignored) {
                // Se genera uno nuevo.
            }
        }
        return UUID.randomUUID().toString();
    }
}
