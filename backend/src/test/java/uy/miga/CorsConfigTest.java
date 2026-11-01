package uy.miga;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CorsConfigTest {

    private final SecurityConfig config = new SecurityConfig();

    private CorsConfiguration corsFor(List<String> origins, List<String> patterns) {
        var request = new MockHttpServletRequest("OPTIONS", "/api/v1/users/login");
        return config.corsConfigurationSource(origins, patterns).getCorsConfiguration(request);
    }

    @Test
    void onlyConfiguredOriginsAndPreviewPatternsAreAllowed() {
        CorsConfiguration cors = corsFor(List.of("https://miga.uy"), List.of("https://miga-*-facugutierrez25.vercel.app"));
        assertThat(cors.checkOrigin("https://miga.uy")).isEqualTo("https://miga.uy");
        assertThat(cors.checkOrigin("https://miga-abc123-facugutierrez25.vercel.app")).isNotNull();
        assertThat(cors.checkOrigin("https://evil.example")).isNull();
        assertThat(cors.checkOrigin("https://miga.uy.evil.example")).isNull();
    }

    @Test
    void wildcardsAreRejectedAtStartup() {
        assertThatThrownBy(() -> corsFor(List.of("*"), List.of()))
            .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> corsFor(List.of("https://miga.uy"), List.of("*")))
            .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> corsFor(List.of("https://miga.uy"), List.of("http://*.vercel.app")))
            .isInstanceOf(IllegalStateException.class);
    }
}
