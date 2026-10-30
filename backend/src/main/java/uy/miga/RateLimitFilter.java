package uy.miga;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
@EnableConfigurationProperties(RateLimitFilter.Props.class)
class RateLimitFilter extends OncePerRequestFilter {

    @ConfigurationProperties("app.rate-limit")
    record Props(
            @DefaultValue("true") boolean enabled,
            @DefaultValue("20") int loginPerMinute,
            @DefaultValue("20") int registerPerHour,
            @DefaultValue("5") int resendPerHour
    ) {}

    private final Props props;
    private final ConcurrentMap<String, Bucket> loginBuckets = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Bucket> registerBuckets = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Bucket> resendBuckets = new ConcurrentHashMap<>();

    RateLimitFilter(Props props) {
        this.props = props;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (!props.enabled()) {
            chain.doFilter(req, res);
            return;
        }

        String method = req.getMethod();
        String path = req.getRequestURI();
        String ip = resolveIp(req);

        ConcurrentMap<String, Bucket> buckets = null;
        int limit = 0;
        Duration window = null;

        if ("POST".equals(method) && "/api/v1/users/login".equals(path)) {
            buckets = loginBuckets;
            limit = props.loginPerMinute();
            window = Duration.ofMinutes(1);
        } else if ("POST".equals(method) && "/api/v1/users".equals(path)) {
            buckets = registerBuckets;
            limit = props.registerPerHour();
            window = Duration.ofHours(1);
        } else if ("POST".equals(method) && "/api/v1/auth/resend-verification".equals(path)) {
            buckets = resendBuckets;
            limit = props.resendPerHour();
            window = Duration.ofHours(1);
        }

        if (buckets != null) {
            final int finalLimit = limit;
            final Duration finalWindow = window;
            Bucket bucket = buckets.computeIfAbsent(ip, k ->
                Bucket.builder()
                    .addLimit(Bandwidth.builder()
                        .capacity(finalLimit)
                        .refillGreedy(finalLimit, finalWindow)
                        .build())
                    .build()
            );
            if (!bucket.tryConsume(1)) {
                res.setStatus(429);
                res.setHeader("Retry-After", String.valueOf(window.toSeconds()));
                res.setContentType("application/json");
                res.getWriter().write("{\"error\":\"Demasiados intentos. Intentá de nuevo más tarde.\"}");
                return;
            }
        }

        chain.doFilter(req, res);
    }

    private String resolveIp(HttpServletRequest req) {
        String forwarded = req.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].strip();
        }
        return req.getRemoteAddr();
    }
}
