package uy.miga.users;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimiterTest {

    @Test
    void accountDeletionSharesLoginIpBudget() {
        RateLimiter limiter = new RateLimiter(new RateLimiter.Props(true, 2, 2, 2, 1, 20));
        assertThat(limiter.checkIp("/api/v1/users/login", "192.0.2.1")).isZero();
        assertThat(limiter.checkIp("/api/v1/users/me", "192.0.2.1")).isZero();
        assertThat(limiter.checkIp("/api/v1/users/me", "192.0.2.1")).isEqualTo(60);
    }

    @Test
    void bucketsAreBoundedAndExpire() {
        AtomicLong clock = new AtomicLong();
        var store = new RateLimiter.BucketStore(1, Duration.ofMinutes(1), 2, clock::get);
        assertThat(store.consume("a")).isTrue();
        assertThat(store.consume("a")).isFalse();
        store.consume("b");
        assertThat(store.consume("c")).isFalse();
        assertThat(store.size()).isEqualTo(2);

        clock.set(Duration.ofMinutes(1).toNanos());
        assertThat(store.consume("a")).isTrue();
        assertThat(store.size()).isEqualTo(1);
    }

    @Test
    void aFullStoreNeverReleasesAnExhaustedKey() {
        AtomicLong clock = new AtomicLong();
        var store = new RateLimiter.BucketStore(1, Duration.ofMinutes(15), 2, clock::get);
        assertThat(store.consume("bloqueado")).isTrue();
        assertThat(store.consume("bloqueado")).isFalse();
        // Llenar el almacén con claves nuevas no debe devolverle intentos a la bloqueada.
        for (int i = 0; i < 50; i++) store.consume("otra-" + i);
        assertThat(store.consume("bloqueado")).isFalse();
        assertThat(store.size()).isLessThanOrEqualTo(2);

        clock.set(Duration.ofMinutes(15).toNanos());
        assertThat(store.consume("bloqueado")).isTrue();
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
