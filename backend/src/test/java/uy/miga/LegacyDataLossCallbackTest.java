package uy.miga;

import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationVersion;
import org.flywaydb.core.api.callback.Context;
import org.flywaydb.core.api.callback.Event;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class LegacyDataLossCallbackTest {
    @Test
    void propertyDefaultsToRejectingLossAndExplicitTrueAllowsIt() throws Exception {
        Context context = migrationContext("8", 2);
        var runner = new ApplicationContextRunner().withUserConfiguration(FlywayConfig.class);
        runner.run(application -> assertThatThrownBy(() -> application.getBean(LegacyDataLossCallback.class)
            .handle(Event.BEFORE_EACH_MIGRATE, context))
            .hasMessageContaining("V8 abortada: se perderían 2 filas de meal_logs"));
        runner.withPropertyValues("app.migrations.allow-legacy-data-loss=true")
            .run(application -> assertThatCode(() -> application.getBean(LegacyDataLossCallback.class)
                .handle(Event.BEFORE_EACH_MIGRATE, context)).doesNotThrowAnyException());
    }

    @Test
    void allowsEmptyLegacyTablesAndRejectsUnresolvedEntries() throws Exception {
        var callback = new LegacyDataLossCallback(false);
        assertThatCode(() -> callback.handle(Event.BEFORE_EACH_MIGRATE, migrationContext("8", 0)))
            .doesNotThrowAnyException();
        assertThatCode(() -> callback.handle(Event.BEFORE_EACH_MIGRATE, migrationContext("12", 0)))
            .doesNotThrowAnyException();
        assertThatThrownBy(() -> callback.handle(Event.BEFORE_EACH_MIGRATE, migrationContext("12", 3)))
            .hasMessageContaining("V12 abortada: se perderían 3 filas de food_entries");
        assertThat(callback.supports(Event.BEFORE_EACH_MIGRATE, null)).isTrue();
        assertThat(callback.supports(Event.AFTER_EACH_MIGRATE, null)).isFalse();
    }

    @Test
    void doesNotQueryLegacyTablesForLaterVersions() throws Exception {
        Context context = migrationContext("26", 1);
        new LegacyDataLossCallback(false).handle(Event.BEFORE_EACH_MIGRATE, context);
        verify(context, never()).getConnection();
    }

    private Context migrationContext(String version, long count) throws Exception {
        Context context = mock(Context.class);
        MigrationInfo info = mock(MigrationInfo.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        ResultSet rows = mock(ResultSet.class);
        when(context.getMigrationInfo()).thenReturn(info);
        when(info.getVersion()).thenReturn(MigrationVersion.fromVersion(version));
        when(context.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeQuery(anyString())).thenReturn(rows);
        when(rows.getLong(1)).thenReturn(count);
        return context;
    }
}
