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

    // repair reescribe checksums y borra migraciones fallidas del historial: si corriera en
    // cada arranque ocultaría una migración aplicada que cambió o una que falló. Solo se
    // usa de forma puntual y consciente, con FLYWAY_REPAIR_ON_START=true.
    @Bean
    FlywayMigrationStrategy flywayMigrationStrategy(
            @Value("${app.migrations.repair-on-start:false}") boolean repairOnStart) {
        return flyway -> {
            if (repairOnStart) {
                flyway.repair();
            }
            flyway.migrate();
        };
    }
}
