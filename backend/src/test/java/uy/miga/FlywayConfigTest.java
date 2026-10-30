package uy.miga;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class FlywayConfigTest {

    private final FlywayConfig config = new FlywayConfig();

    @Test
    void doesNotRepairByDefault() {
        Flyway flyway = mock(Flyway.class);

        config.flywayMigrationStrategy(false).migrate(flyway);

        verify(flyway, never()).repair();
        verify(flyway).migrate();
    }

    @Test
    void repairsBeforeMigratingOnlyWhenEnabled() {
        Flyway flyway = mock(Flyway.class);

        config.flywayMigrationStrategy(true).migrate(flyway);

        InOrder order = inOrder(flyway);
        order.verify(flyway).repair();
        order.verify(flyway).migrate();
    }
}
