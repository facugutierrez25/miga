package uy.miga;

import org.flywaydb.core.api.FlywayException;
import org.flywaydb.core.api.callback.Callback;
import org.flywaydb.core.api.callback.Context;
import org.flywaydb.core.api.callback.Event;

import java.sql.SQLException;

class LegacyDataLossCallback implements Callback {
    private final boolean allowDataLoss;

    LegacyDataLossCallback(boolean allowDataLoss) {
        this.allowDataLoss = allowDataLoss;
    }

    @Override
    public boolean supports(Event event, Context context) {
        return event == Event.BEFORE_EACH_MIGRATE;
    }

    @Override
    public boolean canHandleInTransaction(Event event, Context context) {
        return true;
    }

    @Override
    public void handle(Event event, Context context) {
        var version = context.getMigrationInfo().getVersion();
        if (version == null) return;
        String query;
        String table;
        switch (version.getVersion()) {
            case "8" -> {
                table = "meal_logs";
                query = "SELECT COUNT(*) FROM meal_logs";
            }
            case "12" -> {
                table = "food_entries";
                query = """
                    SELECT COUNT(*) FROM food_entries fe
                    WHERE NOT EXISTS (
                        SELECT 1 FROM meals m
                        JOIN plan_food_groups pfg ON pfg.plan_id = m.plan_id
                        WHERE m.id = fe.meal_id AND pfg.abbreviation = CASE fe.food_group
                            WHEN 'PROTEINS' THEN 'PRO' WHEN 'GRAINS' THEN 'CER'
                            WHEN 'FRUITS' THEN 'FRU' WHEN 'DAIRY' THEN 'LAC'
                            WHEN 'FATS' THEN 'GRA' WHEN 'VEGETABLES' THEN 'VER'
                        END
                    )
                    """;
            }
            default -> { return; }
        }
        try (var statement = context.getConnection().createStatement();
             var rows = statement.executeQuery(query)) {
            rows.next();
            long count = rows.getLong(1);
            if (count > 0 && !allowDataLoss) {
                throw new FlywayException("V%s abortada: se perderían %d filas de %s. "
                    .formatted(version, count, table)
                    + "Realice un backup y corrija o exporte los datos antes de reintentar. "
                    + "Solo para autorizar esa pérdida, configure app.migrations.allow-legacy-data-loss=true.");
            }
        } catch (SQLException ex) {
            throw new FlywayException("No se pudo verificar la pérdida de datos antes de V" + version, ex);
        }
    }

    @Override
    public String getCallbackName() {
        return "legacy-data-loss-verification";
    }
}
