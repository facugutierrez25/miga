package uy.miga.users;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimiterTest {

    @Test
    void bucketsAreBoundedAndExpire() {
        AtomicLong clock = new AtomicLong();
        var store = new RateLimiter.BucketStore(1, Duration.ofMinutes(1), 2, clock::get);
        assertThat(store.consume("a")).isTrue();
        assertThat(store.consume("a")).isFalse();
        store.consume("b");
        store.consume("c");
        assertThat(store.size()).isEqualTo(2);

        clock.set(Duration.ofMinutes(1).toNanos());
        assertThat(store.consume("a")).isTrue();
        assertThat(store.size()).isEqualTo(1);
    }

    @Test
    void loginLimitByEmailAppliesAcrossIps() {
        RateLimiter limiter = new RateLimiter(new RateLimiter.Props(true, 2, 2, 2, 1, 20));
        for (int i = 0; i < 10; i++) {
            assertThat(limiter.checkIp("/api/v1/users/login", "192.0.2." + i)).isZero();
            assertThat(limiter.allowLoginEmail(" Test@Example.com ")).isTrue();
        }
        assertThat(limiter.allowLoginEmail("test@example.com")).isFalse();
    }
}
