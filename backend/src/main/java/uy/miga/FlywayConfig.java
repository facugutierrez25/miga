package uy.miga;

import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;

@Configuration
class FlywayConfig {

    @Bean
    LegacyDataLossCallback legacyDataLossCallback(
            @Value("${app.migrations.allow-legacy-data-loss:false}") boolean allowDataLoss) {
        return new LegacyDataLossCallback(allowDataLoss);
    }

    @Bean
    FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            flyway.repair();
            flyway.migrate();
        };
    }
}
