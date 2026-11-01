package uy.miga;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;

import java.sql.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifica invariantes de las migraciones Flyway:
 * - Migración en base vacía crea todas las tablas esperadas.
 * - Backfill V12: food_group varchar → food_group_id FK.
 * - Backfill V18: equivalences → food_rules.
 * - Backfill V21: food_entries.user_id desde user_email.
 * - Backfill V22: meal_notes.plan_id.
 * - V23: índice único de plan vigente.
 * - V26: uid estable entre versiones, habit_uid en registros y verificación de duplicados.
 * - Aislamiento de datos entre dos usuarios tras migración completa.
 */
class MigrationInvariantsTest {

    @SuppressWarnings("resource")
    static final PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("miga")
            .withUsername("miga")
            .withPassword("miga");

    @BeforeAll
    static void startContainer() {
        postgres.start();
    }

    @AfterAll
    static void stopContainer() {
        postgres.stop();
    }

    @BeforeEach
    void resetDatabase() {
        buildFlyway(null).clean();
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    @Test
    void fullMigrationOnEmptyDatabase_createsAllExpectedTables() throws Exception {
        buildFlyway(null).migrate();
        try (Connection c = connect()) {
            assertTableExists(c, "users");
            assertTableExists(c, "plans");
            assertTableExists(c, "plan_food_groups");
            assertTableExists(c, "meals");
            assertTableExists(c, "meal_portions");
            assertTableExists(c, "food_entries");
            assertTableExists(c, "food_rules");
            assertTableExists(c, "meal_notes");
            assertTableExists(c, "plan_habits");
            assertTableExists(c, "habit_logs");
            assertTableNotExists(c, "equivalences");
        }
    }

    /**
     * Inserta datos a nivel V9 (antes de plan_food_groups).
     * V11 crea los grupos para el plan existente via CROSS JOIN.
     * V12 rellena food_group_id desde el varchar food_group.
     */
    @Test
    void v12BackfillMealPortions_resolvesVarcharFoodGroupToId() throws Exception {
        buildFlyway("9").migrate();

        try (Connection c = connect()) {
            long userId = insertUser(c, "v12user@test.com");
            long planId = insertPlan(c, userId);
            long mealId = insertMeal(c, planId, "Desayuno");
            insertMealPortionWithVarcharGroup(c, mealId, "PROTEINS", 1.0);
            insertMealPortionWithVarcharGroup(c, mealId, "GRAINS", 2.0);
            insertEquivalenceWithVarcharGroup(c, "v12user@test.com", "PROTEINS", "Pollo", 200.0, "G");
        }

        buildFlyway(null).migrate();

        try (Connection c = connect()) {
            long nullPortions = queryLong(c,
                "SELECT COUNT(*) FROM meal_portions WHERE food_group_id IS NULL");
            assertThat(nullPortions).as("All meal_portions must have food_group_id after V12").isZero();

            long proCount = queryLong(c, """
                SELECT COUNT(*) FROM meal_portions mp
                JOIN plan_food_groups pfg ON pfg.id = mp.food_group_id
                WHERE pfg.abbreviation = 'PRO' AND mp.portions = 1.0
                """);
            assertThat(proCount).as("PROTEINS portion must map to PRO group").isEqualTo(1);

            long cerCount = queryLong(c, """
                SELECT COUNT(*) FROM meal_portions mp
                JOIN plan_food_groups pfg ON pfg.id = mp.food_group_id
                WHERE pfg.abbreviation = 'CER' AND mp.portions = 2.0
                """);
            assertThat(cerCount).as("GRAINS portion must map to CER group").isEqualTo(1);
        }
    }

    /**
     * V18 migra las equivalencias de usuario a food_rules (alcance USUARIO) y elimina la tabla.
     */
    @Test
    void v18BackfillEquivalences_migratedToFoodRulesAndTableDropped() throws Exception {
        buildFlyway("9").migrate();

        try (Connection c = connect()) {
            long userId = insertUser(c, "v18user@test.com");
            insertPlan(c, userId);
            insertEquivalenceWithVarcharGroup(c, "v18user@test.com", "PROTEINS", "Pechuga", 200.0, "G");
            insertEquivalenceWithVarcharGroup(c, "v18user@test.com", "DAIRY", "Leche", 1.0, "TAZA");
        }

        buildFlyway(null).migrate();

        try (Connection c = connect()) {
            assertTableNotExists(c, "equivalences");

            long rulesCount = queryLong(c,
                "SELECT COUNT(*) FROM food_rules WHERE alcance = 'USUARIO'");
            assertThat(rulesCount).as("Both equivalences must migrate to food_rules").isEqualTo(2);

            long pechugaCount = queryLong(c,
                "SELECT COUNT(*) FROM food_rules WHERE alimento = 'Pechuga' AND alcance = 'USUARIO'");
            assertThat(pechugaCount).as("Pechuga equivalence must be in food_rules").isEqualTo(1);
        }
    }

    /**
     * V21 rellena user_id en food_entries a partir de user_email.
     * Los food_entries se insertan a nivel V20 (con food_group_id ya NOT NULL por V12).
     */
    @Test
    void v21BackfillFoodEntries_resolvesUserEmailToUserId() throws Exception {
        buildFlyway("9").migrate();

        long userId;
        long planId;
        try (Connection c = connect()) {
            userId = insertUser(c, "v21user@test.com");
            planId = insertPlan(c, userId);
        }

        // V10–V20: V11 inserta grupos para el plan existente, V12 requiere food_group_id
        buildFlyway("20").migrate();

        try (Connection c = connect()) {
            long mealId = insertMeal(c, planId, "Almuerzo");
            long proGroupId = queryLong(c,
                "SELECT id FROM plan_food_groups WHERE plan_id = %d AND abbreviation = 'PRO'".formatted(planId));

            c.createStatement().execute("""
                INSERT INTO food_entries (user_email, meal_id, date, food, quantity, unit, food_group_id)
                VALUES ('v21user@test.com', %d, '2025-06-01', 'Arroz', 1.0, 'TAZA', %d)
                """.formatted(mealId, proGroupId));
        }

        buildFlyway(null).migrate();

        try (Connection c = connect()) {
            long nullCount = queryLong(c,
                "SELECT COUNT(*) FROM food_entries WHERE user_id IS NULL");
            assertThat(nullCount).as("food_entries must have user_id after V21").isZero();

            long entryCount = queryLong(c, """
                SELECT COUNT(*) FROM food_entries fe
                JOIN users u ON u.id = fe.user_id
                WHERE u.email = 'v21user@test.com' AND fe.food = 'Arroz'
                """);
            assertThat(entryCount).as("food_entry must link to correct user").isEqualTo(1);
        }
    }

    /**
     * V22 rellena meal_notes.plan_id con el plan vigente en la fecha de la nota.
     */
    @Test
    void v22BackfillMealNotes_resolvesPlanId() throws Exception {
        buildFlyway("9").migrate();

        long userId;
        long planId;
        try (Connection c = connect()) {
            userId = insertUser(c, "v22user@test.com");
            planId = insertPlan(c, userId);
        }

        buildFlyway("21").migrate();

        try (Connection c = connect()) {
            long mealId = insertMeal(c, planId, "Cena");
            c.createStatement().execute("""
                INSERT INTO meal_notes (user_id, fecha, meal_id, texto)
                VALUES (%d, CURRENT_DATE, %d, 'leche con cereales y fruta')
                """.formatted(userId, mealId));
        }

        buildFlyway(null).migrate();

        try (Connection c = connect()) {
            long nullNotes = queryLong(c,
                "SELECT COUNT(*) FROM meal_notes WHERE plan_id IS NULL");
            assertThat(nullNotes).as("meal_notes must have plan_id after V22").isZero();

            long noteCount = queryLong(c,
                "SELECT COUNT(*) FROM meal_notes WHERE plan_id = %d".formatted(planId));
            assertThat(noteCount).as("meal_note must reference the correct plan").isEqualTo(1);
        }
    }

    /**
     * V23 crea índice parcial único: no pueden existir dos planes vigentes para el mismo usuario.
     */
    @Test
    void v23UniqueIndex_preventsSecondCurrentPlanPerUser() throws Exception {
        buildFlyway(null).migrate();

        try (Connection c = connect()) {
            long userId = insertUser(c, "v23user@test.com");
            c.createStatement().execute("""
                INSERT INTO plans (user_id, created_at, updated_at, is_current)
                VALUES (%d, now(), now(), true)
                """.formatted(userId));

            boolean violated = false;
            try {
                c.createStatement().execute("""
                    INSERT INTO plans (user_id, created_at, updated_at, is_current)
                    VALUES (%d, now(), now(), true)
                    """.formatted(userId));
            } catch (SQLException e) {
                violated = true;
            }
            assertThat(violated).as("Unique index must prevent two current plans").isTrue();
        }
    }

    /**
     * V26 asigna el mismo uid a los grupos de igual abreviatura en distintas versiones
     * del plan de un usuario y copia el uid del hábito a sus registros.
     */
    @Test
    void v26Backfill_sharesGroupUidAcrossVersionsAndCopiesHabitUid() throws Exception {
        buildFlyway("25").migrate();

        long oldPlanId;
        long newPlanId;
        try (Connection c = connect()) {
            long userId = insertUser(c, "v26user@test.com");
            oldPlanId = insertPlan(c, userId);
            c.createStatement().execute(
                "UPDATE plans SET is_current = false, superseded_at = now() WHERE id = " + oldPlanId);
            newPlanId = insertPlan(c, userId);
            for (long planId : new long[]{oldPlanId, newPlanId}) {
                c.createStatement().execute("""
                    INSERT INTO plan_food_groups (plan_id, name, abbreviation, display_order)
                    VALUES (%d, 'Huevo', 'HUE', 1)
                    """.formatted(planId));
            }
            c.createStatement().execute("""
                INSERT INTO plan_habits (plan_id, name, habit_type, daily_goal)
                VALUES (%d, 'Agua', 'CANTIDAD', 2)
                """.formatted(oldPlanId));
            long habitId = queryLong(c, "SELECT MAX(id) FROM plan_habits");
            c.createStatement().execute("""
                INSERT INTO habit_logs (user_id, plan_habit_id, log_date, value)
                VALUES (%d, %d, CURRENT_DATE, 1.5)
                """.formatted(userId, habitId));
        }

        buildFlyway(null).migrate();

        try (Connection c = connect()) {
            long distinctUids = queryLong(c, """
                SELECT COUNT(DISTINCT uid) FROM plan_food_groups
                WHERE abbreviation = 'HUE' AND plan_id IN (%d, %d)
                """.formatted(oldPlanId, newPlanId));
            assertThat(distinctUids).as("versiones del mismo grupo comparten uid").isEqualTo(1);

            long mismatched = queryLong(c, """
                SELECT COUNT(*) FROM habit_logs l
                JOIN plan_habits h ON h.id = l.plan_habit_id
                WHERE l.habit_uid IS DISTINCT FROM h.uid
                """);
            assertThat(mismatched).as("cada registro lleva el uid de su hábito").isZero();
        }
    }

    /**
     * V26 aborta si un plan tiene dos grupos con la misma abreviatura, sin borrar datos.
     */
    @Test
    void v26_abortsOnDuplicateAbbreviationWithinPlan() throws Exception {
        buildFlyway("25").migrate();

        try (Connection c = connect()) {
            long planId = insertPlan(c, insertUser(c, "v26dup@test.com"));
            for (int i = 1; i <= 2; i++) {
                c.createStatement().execute("""
                    INSERT INTO plan_food_groups (plan_id, name, abbreviation, display_order)
                    VALUES (%d, 'Grupo %d', 'DUP', %d)
                    """.formatted(planId, i, i));
            }
        }

        assertThatThrownBy(() -> buildFlyway(null).migrate())
            .hasStackTraceContaining("V26 abortada");

        try (Connection c = connect()) {
            assertThat(queryLong(c, "SELECT COUNT(*) FROM plan_food_groups WHERE abbreviation = 'DUP'"))
                .isEqualTo(2);
        }
    }

    /**
     * Los food_entries de dos usuarios permanecen aislados tras el backfill de V21.
     */
    @Test
    void twoUsers_foodEntriesIsolatedAfterMigration() throws Exception {
        buildFlyway("9").migrate();

        try (Connection c = connect()) {
            insertUser(c, "iso-a@test.com");
            insertPlan(c, queryLong(c, "SELECT id FROM users WHERE email = 'iso-a@test.com'"));
            insertUser(c, "iso-b@test.com");
            insertPlan(c, queryLong(c, "SELECT id FROM users WHERE email = 'iso-b@test.com'"));
        }

        buildFlyway("20").migrate();

        try (Connection c = connect()) {
            long planA = queryLong(c,
                "SELECT p.id FROM plans p JOIN users u ON u.id = p.user_id WHERE u.email = 'iso-a@test.com'");
            long planB = queryLong(c,
                "SELECT p.id FROM plans p JOIN users u ON u.id = p.user_id WHERE u.email = 'iso-b@test.com'");
            long mealA = insertMeal(c, planA, "Desayuno");
            long mealB = insertMeal(c, planB, "Desayuno");
            long proA = queryLong(c,
                "SELECT id FROM plan_food_groups WHERE plan_id = %d AND abbreviation = 'PRO'".formatted(planA));
            long proB = queryLong(c,
                "SELECT id FROM plan_food_groups WHERE plan_id = %d AND abbreviation = 'PRO'".formatted(planB));

            c.createStatement().execute("""
                INSERT INTO food_entries (user_email, meal_id, date, food, quantity, unit, food_group_id)
                VALUES ('iso-a@test.com', %d, '2025-08-01', 'Pollo A', 100.0, 'G', %d)
                """.formatted(mealA, proA));
            c.createStatement().execute("""
                INSERT INTO food_entries (user_email, meal_id, date, food, quantity, unit, food_group_id)
                VALUES ('iso-b@test.com', %d, '2025-08-01', 'Pollo B', 200.0, 'G', %d)
                """.formatted(mealB, proB));
        }

        buildFlyway(null).migrate();

        try (Connection c = connect()) {
            long countA = queryLong(c, """
                SELECT COUNT(*) FROM food_entries fe
                JOIN users u ON u.id = fe.user_id
                WHERE u.email = 'iso-a@test.com'
                """);
            long countB = queryLong(c, """
                SELECT COUNT(*) FROM food_entries fe
                JOIN users u ON u.id = fe.user_id
                WHERE u.email = 'iso-b@test.com'
                """);
            assertThat(countA).as("User A should have exactly 1 entry").isEqualTo(1);
            assertThat(countB).as("User B should have exactly 1 entry").isEqualTo(1);
        }
    }

    @Test
    void v8RejectsMealLogLossUnlessExplicitlyAllowed() throws Exception {
        buildFlyway("7").migrate();
        try (Connection c = connect()) {
            long userId = insertUser(c, "legacy-log@example.test");
            long mealId = insertMeal(c, insertPlan(c, userId), "Desayuno");
            c.createStatement().execute("INSERT INTO meal_logs (user_id, meal_id, logged_date) VALUES (%d, %d, CURRENT_DATE)"
                .formatted(userId, mealId));
        }
        assertThatThrownBy(() -> buildFlyway(null).migrate())
            .hasStackTraceContaining("V8 abortada: se perderían 1 filas de meal_logs")
            .hasStackTraceContaining("app.migrations.allow-legacy-data-loss=true");
        try (Connection c = connect()) {
            assertThat(queryLong(c, "SELECT COUNT(*) FROM meal_logs")).isEqualTo(1);
        }
        buildFlyway(null, true).migrate();
        try (Connection c = connect()) {
            assertTableNotExists(c, "meal_logs");
        }
    }

    @Test
    void v12RejectsUnresolvedEntriesFromV7UnlessExplicitlyAllowed() throws Exception {
        buildFlyway("7").migrate();
        try (Connection c = connect()) {
            long userId = insertUser(c, "legacy-entry@example.test");
            insertPlan(c, userId);
            // V7 permite entradas sin una comida existente; V8 les asigna PROTEINS.
            c.createStatement().execute("""
                INSERT INTO food_entries (user_email, meal_id, date, food, quantity, unit)
                VALUES ('legacy-entry@example.test', -1, CURRENT_DATE, 'Sintético', 1, 'G')
                """);
        }
        assertThatThrownBy(() -> buildFlyway(null).migrate())
            .hasStackTraceContaining("V12 abortada: se perderían 1 filas de food_entries");
        try (Connection c = connect()) {
            assertThat(queryLong(c, "SELECT COUNT(*) FROM food_entries")).isEqualTo(1);
            assertThat(queryLong(c, "SELECT COUNT(*) FROM food_entries WHERE food_group = 'PROTEINS'"))
                .isEqualTo(1);
        }
        buildFlyway(null, true).migrate();
        try (Connection c = connect()) {
            assertThat(queryLong(c, "SELECT COUNT(*) FROM food_entries")).isZero();
        }
    }

    @Test
    void v12RejectsUnknownGroupEvenWhenMealExists() throws Exception {
        buildFlyway("9").migrate();
        try (Connection c = connect()) {
            long userId = insertUser(c, "unknown-group@example.test");
            long mealId = insertMeal(c, insertPlan(c, userId), "Desayuno");
            c.createStatement().execute("""
                INSERT INTO food_entries (user_email, meal_id, date, food, quantity, unit, food_group)
                VALUES ('unknown-group@example.test', %d, CURRENT_DATE, 'Sintético', 1, 'G', 'UNKNOWN')
                """.formatted(mealId));
        }
        assertThatThrownBy(() -> buildFlyway(null).migrate())
            .hasStackTraceContaining("V12 abortada: se perderían 1 filas de food_entries");
        try (Connection c = connect()) {
            assertThat(queryLong(c, "SELECT COUNT(*) FROM food_entries WHERE food_group = 'UNKNOWN'"))
                .isEqualTo(1);
        }
        buildFlyway(null, true).migrate();
        try (Connection c = connect()) {
            assertThat(queryLong(c, "SELECT COUNT(*) FROM food_entries")).isZero();
        }
    }

    @Test
    void springStartsWithHibernateValidationAfterUpgradeFromV9() throws Exception {
        buildFlyway("9").migrate();
        try (Connection c = connect()) {
            long userId = insertUser(c, "upgrade@example.test");
            long mealId = insertMeal(c, insertPlan(c, userId), "Desayuno");
            insertMealPortionWithVarcharGroup(c, mealId, "PROTEINS", 1);
            insertEquivalenceWithVarcharGroup(c, "upgrade@example.test", "PROTEINS", "Pollo sintético", 100, "G");
            c.createStatement().execute("""
                INSERT INTO food_entries (user_email, meal_id, date, food, quantity, unit, food_group)
                VALUES ('upgrade@example.test', %d, CURRENT_DATE, 'Pollo sintético', 100, 'G', 'PROTEINS')
                """.formatted(mealId));
        }
        try (var context = new org.springframework.boot.builder.SpringApplicationBuilder(MigaApplication.class)
                .profiles("test")
                .run("--spring.datasource.url=" + postgres.getJdbcUrl(),
                    "--spring.datasource.driver-class-name=org.postgresql.Driver",
                    "--spring.datasource.username=" + postgres.getUsername(),
                    "--spring.datasource.password=" + postgres.getPassword(),
                    "--spring.jpa.hibernate.ddl-auto=validate", "--server.port=0")) {
            assertThat(context.isActive()).isTrue();
            assertThat(context.getBean(jakarta.persistence.EntityManagerFactory.class).isOpen()).isTrue();
            try (Connection c = connect()) {
                assertThat(queryLong(c, "SELECT COUNT(*) FROM food_entries")).isEqualTo(1);
                assertThat(queryLong(c, "SELECT COUNT(*) FROM food_rules WHERE alimento = 'Pollo sintético'"))
                    .isEqualTo(1);
            }
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Una migración aplicada cuyo contenido cambió hace fallar la migración por checksum, en
     * lugar de pasar en silencio (el arranque ya no ejecuta repair por defecto).
     */
    @Test
    void changedAppliedMigrationFailsValidationInsteadOfPassingSilently() throws Exception {
        buildFlyway(null).migrate();
        try (Connection c = connect()) {
            c.createStatement().execute("UPDATE flyway_schema_history SET checksum = 12345 WHERE version = '14'");
        }

        Flyway flyway = buildFlyway(null);
        assertThatThrownBy(() -> new FlywayConfig().flywayMigrationStrategy(false).migrate(flyway))
            .hasStackTraceContaining("checksum");
    }

    @Test
    void v34FillsMissingColorsPreservingExistingOnesAndVersions() throws Exception {
        buildFlyway("33").migrate();
        long planId;
        long secondPlanId;
        try (Connection c = connect()) {
            planId = insertPlan(c, insertUser(c, "colors@test.com"));
            secondPlanId = insertPlan(c, insertUser(c, "colors-other@test.com"));
            c.createStatement().execute("""
                INSERT INTO plan_food_groups (plan_id, name, abbreviation, display_order)
                SELECT %d, 'Custom ' || n, 'C' || n, n FROM generate_series(1, 12) n
                """.formatted(secondPlanId));
            c.createStatement().execute("""
                INSERT INTO plan_food_groups (plan_id, name, abbreviation, display_order, clave, color, uid)
                VALUES (%1$d, 'Protein', 'PRO', 1, 'proteinas', null, gen_random_uuid()),
                       (%1$d, 'Reserved', 'RES', 20, null, '#A8822E', gen_random_uuid()),
                       (%1$d, 'Custom', 'CUS', 2, null, '#0e6e6b', gen_random_uuid()),
                       (%1$d, 'Custom 2', 'CU2', 3, null, null, gen_random_uuid())
                """.formatted(planId));
        }
        buildFlyway(null).migrate();
        try (Connection c = connect()) {
            assertThat(queryLong(c, "SELECT count(*) FROM plan_food_groups WHERE plan_id = " + planId +
                " AND ((abbreviation = 'PRO' AND color = '#C0704A') OR (abbreviation = 'RES' AND color = '#A8822E')" +
                " OR (abbreviation = 'CUS' AND color = '#0e6e6b') OR (abbreviation = 'CU2' AND color = '#B5627A'))"))
                .isEqualTo(4);
            assertThat(queryLong(c, "SELECT display_order FROM plan_food_groups WHERE plan_id = " + planId + " AND abbreviation = 'RES'"))
                .isEqualTo(20);
            for (int i = 0; i < 12; i++) {
                String hex = uy.miga.plans.GroupColors.PALETTE.get(i % 10).hex();
                assertThat(queryLong(c, "SELECT count(*) FROM plan_food_groups WHERE plan_id = " + secondPlanId +
                    " AND display_order = " + (i + 1) + " AND color = '" + hex + "'" )).isEqualTo(1);
            }
        }
    }

    @Test
    void v34KeepsTheSameColorForAGroupAcrossPlanVersions() throws Exception {
        buildFlyway("33").migrate();
        long older;
        long newer;
        try (Connection c = connect()) {
            long user = insertUser(c, "colors-versions@test.com");
            older = insertPlan(c, user);
            c.createStatement().execute("UPDATE plans SET is_current = false, superseded_at = now() WHERE id = " + older);
            newer = insertPlan(c, user);
            c.createStatement().execute("""
                INSERT INTO plan_food_groups (plan_id, name, abbreviation, display_order, clave, color, uid)
                VALUES (%1$d, 'Protein', 'PRO', 1, 'proteinas', null, gen_random_uuid()),
                       (%1$d, 'Propio', 'PRP', 2, null, null, '00000000-0000-0000-0000-0000000000aa'),
                       (%2$d, 'Otro', 'OTR', 1, null, '#C0704A', gen_random_uuid()),
                       (%2$d, 'Propio', 'PRP', 2, null, null, '00000000-0000-0000-0000-0000000000aa'),
                       (%1$d, 'Cereal', 'CER', 3, 'cereales_tuberculos', '#0e6e6b', '00000000-0000-0000-0000-0000000000bb'),
                       (%2$d, 'Cereal', 'CER', 3, 'cereales_tuberculos', null, '00000000-0000-0000-0000-0000000000bb')
                """.formatted(older, newer));
        }
        buildFlyway(null).migrate();
        try (Connection c = connect()) {
            assertThat(queryLong(c, "SELECT count(DISTINCT color) FROM plan_food_groups WHERE uid = '00000000-0000-0000-0000-0000000000aa'"))
                .isEqualTo(1);
            assertThat(queryLong(c, "SELECT count(*) FROM plan_food_groups WHERE uid = '00000000-0000-0000-0000-0000000000bb' AND color = '#0e6e6b'"))
                .isEqualTo(2);
            assertThat(queryLong(c, "SELECT count(*) FROM plan_food_groups WHERE plan_id = " + newer + " AND abbreviation = 'OTR' AND color = '#C0704A'"))
                .isEqualTo(1);
        }
    }

    private Flyway buildFlyway(String target) {
        return buildFlyway(target, false);
    }

    private Flyway buildFlyway(String target, boolean allowDataLoss) {
        var cfg = Flyway.configure()
            .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
            .locations("classpath:db/migration")
            .cleanDisabled(false)
            .callbacks(new FlywayConfig().legacyDataLossCallback(allowDataLoss));
        if (target != null) {
            cfg = cfg.target(target);
        }
        return cfg.load();
    }

    private Connection connect() throws SQLException {
        return DriverManager.getConnection(
            postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private long insertUser(Connection c, String email) throws SQLException {
        c.createStatement().execute("""
            INSERT INTO users (email, password_hash, role)
            VALUES ('%s', 'hash', 'PATIENT')
            """.formatted(email));
        return queryLong(c, "SELECT MAX(id) FROM users");
    }

    private long insertPlan(Connection c, long userId) throws SQLException {
        c.createStatement().execute("""
            INSERT INTO plans (user_id, created_at, updated_at, is_current)
            VALUES (%d, now() - INTERVAL '1 day', now(), true)
            """.formatted(userId));
        return queryLong(c, "SELECT MAX(id) FROM plans");
    }

    private long insertMeal(Connection c, long planId, String name) throws SQLException {
        c.createStatement().execute("""
            INSERT INTO meals (plan_id, name, display_order)
            VALUES (%d, '%s', 1)
            """.formatted(planId, name));
        return queryLong(c, "SELECT MAX(id) FROM meals");
    }

    private void insertMealPortionWithVarcharGroup(Connection c, long mealId, String group, double portions)
            throws SQLException {
        c.createStatement().execute("""
            INSERT INTO meal_portions (meal_id, food_group, portions)
            VALUES (%d, '%s', %s)
            """.formatted(mealId, group, portions));
    }

    private void insertEquivalenceWithVarcharGroup(Connection c, String userEmail, String group,
            String food, double qty, String unit) throws SQLException {
        c.createStatement().execute("""
            INSERT INTO equivalences (user_email, food_group, food, quantity, unit)
            VALUES ('%s', '%s', '%s', %s, '%s')
            """.formatted(userEmail, group, food, qty, unit));
    }

    private long queryLong(Connection c, String sql) throws SQLException {
        try (ResultSet rs = c.createStatement().executeQuery(sql)) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private void assertTableExists(Connection c, String name) throws SQLException {
        try (ResultSet rs = c.getMetaData().getTables(null, "public", name, new String[]{"TABLE"})) {
            assertThat(rs.next()).as("Table '%s' should exist", name).isTrue();
        }
    }

    private void assertTableNotExists(Connection c, String name) throws SQLException {
        try (ResultSet rs = c.getMetaData().getTables(null, "public", name, new String[]{"TABLE"})) {
            assertThat(rs.next()).as("Table '%s' should not exist", name).isFalse();
        }
    }
}
