package uy.miga.users;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.function.LongSupplier;

@Component
@EnableConfigurationProperties(RateLimiter.Props.class)
public class RateLimiter {
    public static final String ERROR_JSON = "{\"error\":\"Demasiados intentos. Intentá de nuevo más tarde.\"}";

    @ConfigurationProperties("app.rate-limit")
    public record Props(
            @DefaultValue("true") boolean enabled,
            @DefaultValue("20") int loginPerMinute,
            @DefaultValue("20") int registerPerHour,
            @DefaultValue("5") int resendPerHour,
            @DefaultValue("1") int trustedProxies,
            @DefaultValue("10000") int maxBuckets
    ) {
        public Props {
            if (trustedProxies < 0 || maxBuckets < 1 || loginPerMinute < 1
                    || registerPerHour < 1 || resendPerHour < 1) {
                throw new IllegalArgumentException("Configuración de rate limit inválida");
            }
        }
    }

    private final Props props;
    private final BucketStore login;
    private final BucketStore register;
    private final BucketStore resend;
    private final BucketStore email;

    public RateLimiter(Props props) {
        this.props = props;
        login = new BucketStore(props.loginPerMinute(), Duration.ofMinutes(1), props.maxBuckets());
        register = new BucketStore(props.registerPerHour(), Duration.ofHours(1), props.maxBuckets());
        resend = new BucketStore(props.resendPerHour(), Duration.ofHours(1), props.maxBuckets());
        email = new BucketStore(10, Duration.ofMinutes(15), props.maxBuckets());
    }

    public int trustedProxies() { return props.trustedProxies(); }

    public long checkIp(String path, String ip) {
        if (!props.enabled()) return 0;
        return switch (path) {
            case "/api/v1/users/login" -> login.consume(ip) ? 0 : 60;
            case "/api/v1/users" -> register.consume(ip) ? 0 : 3600;
            case "/api/v1/auth/resend-verification" -> resend.consume(ip) ? 0 : 3600;
            default -> 0;
        };
    }

    public boolean allowLoginEmail(String value) {
        return !props.enabled() || email.consume(value.strip().toLowerCase(Locale.ROOT));
    }

    static final class BucketStore {
        private record Entry(Bucket bucket, long lastAccess) {}
        private final LinkedHashMap<String, Entry> entries = new LinkedHashMap<>(16, 0.75f, true);
        private final int limit;
        private final long expiry;
        private final Duration window;
        private final int maximum;
        private final LongSupplier clock;

        BucketStore(int limit, Duration window, int maximum) {
            this(limit, window, maximum, System::nanoTime);
        }

        BucketStore(int limit, Duration window, int maximum, LongSupplier clock) {
            this.limit = limit;
            this.window = window;
            this.expiry = window.toNanos();
            this.maximum = maximum;
            this.clock = clock;
        }

        synchronized boolean consume(String key) {
            long now = clock.getAsLong();
            var iterator = entries.entrySet().iterator();
            while (iterator.hasNext()) {
                if (now - iterator.next().getValue().lastAccess() < expiry) break;
                iterator.remove();
            }
            Entry entry = entries.get(key);
            if (entry == null) {
                // Solo se libera un contador sin intentos consumidos: expulsar uno activo le
                // devolvería los intentos a quien está bloqueado. Si todos están activos, la
                // clave nueva se rechaza hasta que alguno venza.
                if (entries.size() >= maximum && !evictIdleEntry()) return false;
                entry = new Entry(Bucket.builder().addLimit(Bandwidth.builder()
                        .capacity(limit).refillGreedy(limit, window).build()).build(), now);
            }
            entries.put(key, new Entry(entry.bucket(), now));
            return entry.bucket().tryConsume(1);
        }

        private boolean evictIdleEntry() {
            var iterator = entries.values().iterator();
            while (iterator.hasNext()) {
                if (iterator.next().bucket().getAvailableTokens() >= limit) {
                    iterator.remove();
                    return true;
                }
            }
            return false;
        }

        synchronized int size() { return entries.size(); }
    }
}
