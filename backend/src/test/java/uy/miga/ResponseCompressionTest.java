package uy.miga;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.zip.GZIPInputStream;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = ResponseCompressionTest.Configuration.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "management.endpoint.health.group.readiness.include=readinessState")
@ActiveProfiles("test")
class ResponseCompressionTest {
    @Value("${local.server.port}") private int port;

    @Test
    void compressesLargeJsonResponse() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/compression-test"))
                .header("Accept-Encoding", "gzip").build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.headers().firstValue("Content-Encoding")).contains("gzip");
            try (var gzip = new GZIPInputStream(new ByteArrayInputStream(response.body()))) {
                assertThat(new String(gzip.readAllBytes(), StandardCharsets.UTF_8)).contains("x".repeat(8192));
            }
        }
    }

    @org.springframework.context.annotation.Configuration(proxyBeanMethods = false)
    @org.springframework.boot.test.context.TestComponent
    @EnableAutoConfiguration(excludeName = {
        "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration",
        "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration",
        "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration"
    })
    static class Configuration {
        @Bean LargeJsonController largeJsonController() { return new LargeJsonController(); }
        @Bean @Order(0)
        SecurityFilterChain compressionSecurity(HttpSecurity http) throws Exception {
            return http.securityMatcher("/compression-test").authorizeHttpRequests(auth -> auth.anyRequest().permitAll()).build();
        }
    }

    @RestController
    static class LargeJsonController {
        @GetMapping("/compression-test")
        Map<String, String> largeJson() { return Map.of("data", "x".repeat(8192)); }
    }
}
