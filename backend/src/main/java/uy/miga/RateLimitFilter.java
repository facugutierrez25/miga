package uy.miga;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import uy.miga.users.RateLimiter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;

@Component
class RateLimitFilter extends OncePerRequestFilter {
    private final RateLimiter limiter;

    RateLimitFilter(RateLimiter limiter) {
        this.limiter = limiter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if ("POST".equals(req.getMethod())
                || ("DELETE".equals(req.getMethod()) && "/api/v1/users/me".equals(req.getRequestURI()))) {
            long retryAfter = limiter.checkIp(req.getRequestURI(), resolveIp(req));
            if (retryAfter > 0) {
                res.setStatus(429);
                res.setHeader("Retry-After", String.valueOf(retryAfter));
                res.setContentType("application/json");
                res.setCharacterEncoding("UTF-8");
                res.getWriter().write(RateLimiter.ERROR_JSON);
                return;
            }
        }
        chain.doFilter(req, res);
    }

    String resolveIp(HttpServletRequest req) {
        int trusted = limiter.trustedProxies();
        String forwarded = req.getHeader("X-Forwarded-For");
        if (trusted > 0 && forwarded != null) {
            String[] addresses = forwarded.split(",", -1);
            if (addresses.length >= trusted) {
                String candidate = addresses[addresses.length - trusted].strip();
                String literal = normalizeLiteral(candidate);
                if (literal != null) return literal;
            }
        }
        return req.getRemoteAddr();
    }

    private static String normalizeLiteral(String value) {
        if (value.contains(":")) {
            if (!value.matches("[0-9a-fA-F:.]+")) return null;
            try {
                return InetAddress.getByName(value).getHostAddress();
            } catch (UnknownHostException e) {
                return null;
            }
        }
        String[] parts = value.split("\\.", -1);
        if (parts.length != 4) return null;
        for (String part : parts) {
            if (!part.matches("0|[1-9][0-9]{0,2}") || Integer.parseInt(part) > 255) return null;
        }
        return value;
    }
}
