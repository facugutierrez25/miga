package uy.miga;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import uy.miga.users.JwtService;

@Configuration
class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService,
                                            @Value("${app.ops.api-key:}") String opsApiKey) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/status",
                        "/actuator/health", "/actuator/health/liveness", "/actuator/health/readiness",
                        "/api/v1/users", "/api/v1/users/login",
                        "/api/v1/auth/verify", "/api/v1/auth/resend-verification").permitAll()
                // Métricas e info son operativas: solo con la clave X-Ops-Key, nunca con un JWT de paciente.
                .requestMatchers("/actuator/**").access(new OpsKeyAuthorizationManager(opsApiKey))
                .anyRequest().authenticated())
            .addFilterBefore(new JwtAuthenticationFilter(jwtService), UsernamePasswordAuthenticationFilter.class)
            .httpBasic(http2 -> http2.disable())
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, res, e) ->
                    res.sendError(HttpServletResponse.SC_UNAUTHORIZED)));
        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins,
            @Value("${app.cors.allowed-origin-patterns:}") List<String> allowedOriginPatterns) {
        // Un comodín total dejaría que cualquier sitio use la API desde el navegador de una persona.
        if (allowedOrigins.stream().anyMatch(origin -> origin.contains("*"))) {
            throw new IllegalStateException("CORS_ALLOWED_ORIGINS no admite comodines; usá CORS_ALLOWED_ORIGIN_PATTERNS.");
        }
        List<String> patterns = allowedOriginPatterns.stream().map(String::strip).filter(p -> !p.isEmpty()).toList();
        if (patterns.stream().anyMatch(p -> !p.matches("https://[^*]+\\*[^*/]+"))) {
            throw new IllegalStateException("CORS_ALLOWED_ORIGIN_PATTERNS solo admite patrones https con un comodín dentro del dominio.");
        }
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedOriginPatterns(patterns);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
