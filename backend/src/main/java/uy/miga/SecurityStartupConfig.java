package uy.miga;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.Arrays;
import java.util.List;

@Configuration
class SecurityStartupConfig {

    private static final String DEV_SECRET = "dev-secret-local-must-be-at-least-32-chars";

    private final String jwtSecret;
    private final Environment env;

    SecurityStartupConfig(@Value("${jwt.secret}") String jwtSecret, Environment env) {
        this.jwtSecret = jwtSecret;
        this.env = env;
    }

    @PostConstruct
    void validateConfiguration() {
        List<String> activeProfiles = Arrays.asList(env.getActiveProfiles());
        boolean safeProfile = activeProfiles.contains("local") || activeProfiles.contains("test");
        if (!safeProfile && DEV_SECRET.equals(jwtSecret)) {
            throw new IllegalStateException(
                "jwt.secret usa el valor conocido de desarrollo. " +
                "Configurá la variable de entorno JWT_SECRET antes de iniciar en producción.");
        }
    }
}
