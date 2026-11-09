package uy.miga;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Component
@Order(2)
class SlowRequestFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(SlowRequestFilter.class);
    private final long thresholdMs;

    SlowRequestFilter(@Value("${app.slow-request-threshold-ms:1000}") long thresholdMs) {
        this.thresholdMs = thresholdMs;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        long start = System.nanoTime();
        boolean failed = false;
        try {
            chain.doFilter(request, response);
        } catch (IOException | ServletException | RuntimeException e) {
            failed = true;
            throw e;
        } finally {
            long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
            if (durationMs > thresholdMs) {
                Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
                String route = pattern != null ? pattern.toString() : sanitizedPath(request.getRequestURI());
                log.warn("Solicitud lenta: metodo={} ruta={} estado={} duracionMs={} correlationId={}",
                    request.getMethod(), route, failed ? HttpServletResponse.SC_INTERNAL_SERVER_ERROR : response.getStatus(), durationMs, MDC.get("correlationId"));
            }
        }
    }

    static String sanitizedPath(String path) {
        return path.replaceAll("(?i)(?<=/)(?:[0-9]+|[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=/|$)", "{id}");
    }
}
