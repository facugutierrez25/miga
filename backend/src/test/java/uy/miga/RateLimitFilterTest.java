package uy.miga;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import uy.miga.users.RateLimiter;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private static RateLimiter limiter(int trustedProxies) {
        return new RateLimiter(new RateLimiter.Props(true, 2, 2, 2, trustedProxies, 20));
    }

    private static MockHttpServletRequest login(String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/users/login");
        request.setRemoteAddr("192.0.2.1");
        request.addHeader("X-Forwarded-For", forwardedFor);
        return request;
    }

    @Test
    void changingTheForwardedPrefixDoesNotBypassTheLimit() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(limiter(1));
        for (int i = 0; i < 3; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            // El cliente controla el comienzo de la cabecera; el proxy agrega la IP real al final.
            filter.doFilter(login("198.51.100." + i + ", 203.0.113.1"), response, (req, res) -> {});
            assertThat(response.getStatus()).isEqualTo(i < 2 ? 200 : 429);
        }
    }

    @Test
    void usesOnlyValidIpLiteralsAccordingToTrustedProxies() {
        RateLimitFilter oneProxy = new RateLimitFilter(limiter(1));
        for (String invalid : new String[] {"example.com", "999.1.1.1", "::xyz", "", "1.2.3.4:80", "fe80::1%eth0"}) {
            assertThat(oneProxy.resolveIp(login(invalid))).isEqualTo("192.0.2.1");
        }
        assertThat(oneProxy.resolveIp(login("2001:db8::1"))).isEqualTo("2001:db8:0:0:0:0:0:1");
        assertThat(new RateLimitFilter(limiter(0)).resolveIp(login("203.0.113.1"))).isEqualTo("192.0.2.1");
        assertThat(new RateLimitFilter(limiter(2)).resolveIp(login("203.0.113.1"))).isEqualTo("192.0.2.1");
        assertThat(new RateLimitFilter(limiter(2)).resolveIp(login("203.0.113.1, 192.0.2.2"))).isEqualTo("203.0.113.1");
    }
}
