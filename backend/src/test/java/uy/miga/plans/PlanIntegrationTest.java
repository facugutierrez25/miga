package uy.miga.plans;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.security.web.FilterChainProxy;
import uy.miga.users.EmailOutboxWorker;
import uy.miga.users.MockEmailService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class PlanIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private FilterChainProxy springSecurityFilterChain;

    @Autowired
    private MockEmailService mockEmailService;

    @Autowired
    private EmailOutboxWorker outboxWorker;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;
    private String token;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(springSecurityFilterChain)
                .build();

        mockEmailService.reset();
        token = registerAndLogin("plan-" + java.util.UUID.randomUUID() + "@miga.uy");
    }

    @Test
    void getMyPlan_whenNoPlan_returns404() throws Exception {
        String sinPlanToken = registerAndLogin("sinplan-" + java.util.UUID.randomUUID() + "@miga.uy");

        mockMvc.perform(get("/api/v1/my-plan")
                .header("Authorization", "Bearer " + sinPlanToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void saveAndRetrieveMyPlan_returns200() throws Exception {
        String planJson = """
                {
                  "meals": [
                    {
                      "name": "Desayuno",
                      "suggestedTime": "08:00:00",
                      "displayOrder": 1,
                      "portions": [
                        { "foodGroupAbbr": "PRO", "portions": 1.0 },
                        { "foodGroupAbbr": "CER", "portions": 2.0 },
                        { "foodGroupAbbr": "FRU", "portions": 1.0 },
                        { "foodGroupAbbr": "LAC", "portions": 1.0 },
                        { "foodGroupAbbr": "GRA", "portions": 0.5 },
                        { "foodGroupAbbr": "VER", "portions": 0.0 }
                      ]
                    }
                  ]
                }
                """;

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, planJson)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.foodGroups").isArray())
                .andExpect(jsonPath("$.meals[0].name").value("Desayuno"))
                .andExpect(jsonPath("$.meals[0].portions").isArray());

        mockMvc.perform(get("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals[0].name").value("Desayuno"));
    }

    @Test
    void saveMyPlan_withInvalidPortions_returns400() throws Exception {
        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, """
                        {
                          "meals": [
                            {
                              "name": "Desayuno",
                              "displayOrder": 1,
                              "portions": [
                                { "foodGroupAbbr": "PRO", "portions": 0.3 }
                              ]
                            }
                          ]
                        }
                        """)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void saveMyPlan_withoutToken_returns401() throws Exception {
        mockMvc.perform(put("/api/v1/my-plan")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        { "meals": [] }
                        """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void updateMyPlan_secondSaveArchivesFirstAndReturnsNewPlan() throws Exception {
        String histToken = registerAndLogin("historial-" + java.util.UUID.randomUUID() + "@miga.uy");

        String primerPlan = """
                {
                  "meals": [{
                    "name": "Desayuno",
                    "displayOrder": 1,
                    "portions": [
                      { "foodGroupAbbr": "PRO", "portions": 1.0 },
                      { "foodGroupAbbr": "CER", "portions": 1.0 },
                      { "foodGroupAbbr": "FRU", "portions": 1.0 },
                      { "foodGroupAbbr": "LAC", "portions": 1.0 },
                      { "foodGroupAbbr": "GRA", "portions": 0.5 },
                      { "foodGroupAbbr": "VER", "portions": 0.0 }
                    ]
                  }]
                }
                """;

        String segundoPlan = """
                {
                  "meals": [
                    {
                      "name": "Almuerzo",
                      "displayOrder": 1,
                      "portions": [
                        { "foodGroupAbbr": "PRO", "portions": 2.0 },
                        { "foodGroupAbbr": "CER", "portions": 2.0 },
                        { "foodGroupAbbr": "FRU", "portions": 1.0 },
                        { "foodGroupAbbr": "LAC", "portions": 0.0 },
                        { "foodGroupAbbr": "GRA", "portions": 1.0 },
                        { "foodGroupAbbr": "VER", "portions": 1.0 }
                      ]
                    },
                    {
                      "name": "Cena",
                      "displayOrder": 2,
                      "portions": [
                        { "foodGroupAbbr": "PRO", "portions": 1.5 },
                        { "foodGroupAbbr": "CER", "portions": 1.0 },
                        { "foodGroupAbbr": "FRU", "portions": 0.0 },
                        { "foodGroupAbbr": "LAC", "portions": 0.0 },
                        { "foodGroupAbbr": "GRA", "portions": 0.5 },
                        { "foodGroupAbbr": "VER", "portions": 2.0 }
                      ]
                    }
                  ]
                }
                """;

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + histToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, histToken, primerPlan)))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + histToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, histToken, segundoPlan)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals[0].name").value("Almuerzo"))
                .andExpect(jsonPath("$.meals[1].name").value("Cena"));

        mockMvc.perform(get("/api/v1/my-plan")
                .header("Authorization", "Bearer " + histToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals.length()").value(2))
                .andExpect(jsonPath("$.meals[0].name").value("Almuerzo"));

        mockMvc.perform(get("/api/v1/my-plan/historial")
                .header("Authorization", "Bearer " + histToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].mealCount").value(1));
    }

    @Test
    void getPlanHistory_withNoHistory_returnsEmptyArray() throws Exception {
        String freshToken = registerAndLogin("sinhistorial-" + java.util.UUID.randomUUID() + "@miga.uy");

        mockMvc.perform(get("/api/v1/my-plan/historial")
                .header("Authorization", "Bearer " + freshToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void getPlanHistory_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/my-plan/historial"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void saveMyPlan_withSameContent_doesNotCreateHistoryEntry() throws Exception {
        String token = registerAndLogin("sincambios-" + java.util.UUID.randomUUID() + "@miga.uy");

        String plan = """
                {
                  "meals": [{
                    "name": "Desayuno",
                    "displayOrder": 1,
                    "portions": [
                      { "foodGroupAbbr": "PRO", "portions": 1.0 },
                      { "foodGroupAbbr": "CER", "portions": 2.0 },
                      { "foodGroupAbbr": "FRU", "portions": 1.0 },
                      { "foodGroupAbbr": "LAC", "portions": 1.0 },
                      { "foodGroupAbbr": "GRA", "portions": 0.5 },
                      { "foodGroupAbbr": "VER", "portions": 0.0 }
                    ]
                  }]
                }
                """;

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, plan)))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, plan)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/my-plan/historial")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    private static final String PLAN_UNA_COMIDA = """
            {
              "meals": [{
                "name": "Desayuno",
                "displayOrder": 1,
                "portions": [
                  { "foodGroupAbbr": "PRO", "portions": 1.0 },
                  { "foodGroupAbbr": "CER", "portions": 2.0 },
                  { "foodGroupAbbr": "FRU", "portions": 1.0 },
                  { "foodGroupAbbr": "LAC", "portions": 1.0 },
                  { "foodGroupAbbr": "GRA", "portions": 0.5 },
                  { "foodGroupAbbr": "VER", "portions": 0.0 }
                ]
              }]
            }
            """;

    @Test
    void saveMyPlan_returnsVersion() throws Exception {
        String t = registerAndLogin("version-" + java.util.UUID.randomUUID() + "@miga.uy");

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, t, PLAN_UNA_COMIDA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").isNumber());
    }

    @Test
    void saveMyPlan_withCorrectClientVersion_returns200() throws Exception {
        String t = registerAndLogin("version-ok-" + java.util.UUID.randomUUID() + "@miga.uy");

        MvcResult first = mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, t, PLAN_UNA_COMIDA)))
                .andExpect(status().isOk())
                .andReturn();

        long version = objectMapper.readTree(first.getResponse().getContentAsString())
                .get("version").asLong();

        String planConVersion = """
                {
                  "meals": [{
                    "name": "Almuerzo",
                    "displayOrder": 1,
                    "portions": [
                      { "foodGroupAbbr": "PRO", "portions": 2.0 },
                      { "foodGroupAbbr": "CER", "portions": 1.0 },
                      { "foodGroupAbbr": "FRU", "portions": 0.0 },
                      { "foodGroupAbbr": "LAC", "portions": 0.0 },
                      { "foodGroupAbbr": "GRA", "portions": 1.0 },
                      { "foodGroupAbbr": "VER", "portions": 1.0 }
                    ]
                  }],
                  "clientVersion": %d
                }
                """.formatted(version);

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content(planConVersion))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals[0].name").value("Almuerzo"));
    }

    @Test
    void saveMyPlan_withOutdatedClientVersion_returns409() throws Exception {
        String t = registerAndLogin("version-conflict-" + java.util.UUID.randomUUID() + "@miga.uy");

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, t, PLAN_UNA_COMIDA)))
                .andExpect(status().isOk());

        String planVersionObsoleta = """
                {
                  "meals": [{
                    "name": "Cena",
                    "displayOrder": 1,
                    "portions": [
                      { "foodGroupAbbr": "PRO", "portions": 1.0 },
                      { "foodGroupAbbr": "CER", "portions": 0.0 },
                      { "foodGroupAbbr": "FRU", "portions": 0.0 },
                      { "foodGroupAbbr": "LAC", "portions": 0.0 },
                      { "foodGroupAbbr": "GRA", "portions": 0.5 },
                      { "foodGroupAbbr": "VER", "portions": 1.0 }
                    ]
                  }],
                  "clientVersion": 9999
                }
                """;

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content(planVersionObsoleta))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PLAN_CONFLICT"));
    }

    @Test
    void saveMyPlan_withoutClientVersion_whenPlanExists_returnsConflict() throws Exception {
        String t = registerAndLogin("version-noenvio-" + java.util.UUID.randomUUID() + "@miga.uy");

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, t, PLAN_UNA_COMIDA)))
                .andExpect(status().isOk());

        String planSinVersion = """
                {
                  "meals": [{
                    "name": "Cena",
                    "displayOrder": 1,
                    "portions": [
                      { "foodGroupAbbr": "PRO", "portions": 1.0 },
                      { "foodGroupAbbr": "CER", "portions": 0.0 },
                      { "foodGroupAbbr": "FRU", "portions": 0.0 },
                      { "foodGroupAbbr": "LAC", "portions": 0.0 },
                      { "foodGroupAbbr": "GRA", "portions": 0.5 },
                      { "foodGroupAbbr": "VER", "portions": 1.0 }
                    ]
                  }]
                }
                """;

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content(planSinVersion))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PLAN_CONFLICT"));
    }

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    @Test
    void concurrentFirstCreations_leaveOneCurrentPlanAndLoserGetsConflict() throws Exception {
        String email = "primera-" + java.util.UUID.randomUUID() + "@miga.uy";
        String t = registerAndLogin(email);

        java.util.List<Integer> statuses = runConcurrently(2, () -> mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content(PLAN_UNA_COMIDA))
            .andReturn().getResponse().getStatus());

        assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        assertThat(jdbc.queryForObject("""
            select count(*) from plans p join users u on u.id = p.user_id
            where p.is_current and u.email = ?
            """, Long.class, email)).isEqualTo(1);
    }

    @Test
    void concurrentUpdatesWithSameVersion_onlyOneWins() throws Exception {
        String t = registerAndLogin("dos-ediciones-" + java.util.UUID.randomUUID() + "@miga.uy");
        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content(PLAN_UNA_COMIDA))
            .andExpect(status().isOk());
        String edited = uy.miga.PlanVersions.withCurrentVersion(mockMvc, t,
            PLAN_UNA_COMIDA.replace("Desayuno", "Desayuno editado"));

        java.util.List<Integer> statuses = runConcurrently(2, () -> mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content(edited))
            .andReturn().getResponse().getStatus());

        assertThat(statuses).containsExactlyInAnyOrder(200, 409);
    }

    // Lanza las tareas a la vez (con una barrera) y devuelve el status HTTP de cada una.
    private java.util.List<Integer> runConcurrently(int count, java.util.concurrent.Callable<Integer> task)
            throws Exception {
        var executor = java.util.concurrent.Executors.newFixedThreadPool(count);
        var start = new java.util.concurrent.CountDownLatch(1);
        try {
            var futures = new java.util.ArrayList<java.util.concurrent.Future<Integer>>();
            for (int i = 0; i < count; i++) {
                futures.add(executor.submit(() -> {
                    start.await();
                    return task.call();
                }));
            }
            start.countDown();
            var statuses = new java.util.ArrayList<Integer>();
            for (var future : futures) {
                statuses.add(future.get(30, java.util.concurrent.TimeUnit.SECONDS));
            }
            return statuses;
        } finally {
            executor.shutdownNow();
        }
    }


    @Test
    void versionCopiesConfigurationRulesAndActiveHabits() throws Exception {
        String t = registerAndLogin("copy-" + java.util.UUID.randomUUID() + "@miga.uy");
        savePlan(t, PLAN_UNA_COMIDA);
        long oldId = jdbc.queryForObject("select max(id) from plans", Long.class);
        jdbc.update("update plans set modo_registro = 'LIBRE', margen_porciones = 1.5 where id = ?", oldId);
        jdbc.update("insert into plan_food_groups (plan_id, name, abbreviation, display_order, clave, color, preguntar_si_falta, opcional) values (?, 'Grupo propio', 'ABC', 9, 'propio', '#123456', true, true)", oldId);
        long groupId = jdbc.queryForObject("select id from plan_food_groups where plan_id = ? and abbreviation = 'ABC'", Long.class, oldId);
        jdbc.update("insert into food_rules (plan_id, user_id, alcance, alimento, tipo, food_group_id, cantidad_por_porcion, unidad) select id, user_id, 'USUARIO', 'Alimento sintético', 'NORMAL', ?, 100, 'g' from plans where id = ?", groupId, oldId);
        mockMvc.perform(post("/api/v1/habitos").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Hábito sintético\",\"habitType\":\"SI_NO\",\"displayOrder\":1}"))
                .andExpect(status().isCreated());
        jdbc.update("insert into food_rules (plan_id, alcance, alimento, tipo, componentes) values (?, 'PLAN', 'Compuesto sintético', 'COMPUESTO', cast(? as jsonb))",
                oldId, "[{\"foodGroupId\":" + groupId + ",\"porciones\":2},{\"standardGroupKey\":\"frutas\",\"porciones\":1}]");
        jdbc.update("insert into plan_habits (plan_id, name, habit_type, archived_at) values (?, 'Archivado', 'SI_NO', now())", oldId);
        savePlan(t, PLAN_UNA_COMIDA.replace("Desayuno", "Cena"));
        long newId = jdbc.queryForObject("select max(id) from plans", Long.class);
        assertThat(newId).isNotEqualTo(oldId);
        assertThat(jdbc.queryForList("select uid, name, abbreviation, clave, color, display_order, preguntar_si_falta, opcional from plan_food_groups where plan_id = ? order by display_order", oldId))
                .isEqualTo(jdbc.queryForList("select uid, name, abbreviation, clave, color, display_order, preguntar_si_falta, opcional from plan_food_groups where plan_id = ? order by display_order", newId));
        assertThat(jdbc.queryForMap("select modo_registro, margen_porciones from plans where id = ?", oldId))
                .isEqualTo(jdbc.queryForMap("select modo_registro, margen_porciones from plans where id = ?", newId));
        assertThat(jdbc.queryForList("select uid, name, habit_type, unit, daily_goal, step, period, display_order, created_at from plan_habits where plan_id = ? and archived_at is null", oldId))
                .isEqualTo(jdbc.queryForList("select uid, name, habit_type, unit, daily_goal, step, period, display_order, created_at from plan_habits where plan_id = ?", newId));
        assertThat(jdbc.queryForList("select uid, overrides_rule_uid, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, user_id, alcance from food_rules where plan_id = ? order by alimento", oldId))
                .hasSize(2);
        long newGroupId = jdbc.queryForObject("select id from plan_food_groups where plan_id = ? and abbreviation = 'ABC'", Long.class, newId);
        assertThat(jdbc.queryForObject("select (componentes->0->>'foodGroupId')::bigint from food_rules where plan_id = ? and alcance = 'PLAN'", Long.class, newId)).isEqualTo(newGroupId);
        assertThat(jdbc.queryForObject("select food_group_id from food_rules where plan_id = ? and alcance = 'USUARIO'", Long.class, newId)).isEqualTo(newGroupId);
        mockMvc.perform(get("/api/v1/habitos").header("Authorization", "Bearer " + t))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("Hábito sintético"));
    }

    @Test
    void unmappedComponentRollsBackNewVersion() throws Exception {
        String t = registerAndLogin("rollback-" + java.util.UUID.randomUUID() + "@miga.uy");
        savePlan(t, PLAN_UNA_COMIDA);
        long oldId = jdbc.queryForObject("select max(id) from plans", Long.class);
        jdbc.update("insert into food_rules (plan_id, alcance, alimento, tipo, componentes) values (?, 'PLAN', 'Inv�lido', 'COMPUESTO', '[{\"foodGroupId\":-1,\"porciones\":1}]'::jsonb)", oldId);
        assertThatThrownBy(() -> savePlan(t, PLAN_UNA_COMIDA.replace("Desayuno", "Cena")))
                .hasRootCauseInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("select is_current from plans where id = ?", Boolean.class, oldId)).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from plans where user_id = (select user_id from plans where id = ?)", Long.class, oldId)).isEqualTo(1);
    }

    private void savePlan(String t, String json) throws Exception {
        mockMvc.perform(put("/api/v1/my-plan").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, t, json))).andExpect(status().isOk());
    }

    private String registerAndLogin(String email) throws Exception {
        mockMvc.perform(post("/api/v1/users")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            { "email": "%s", "password": "Segura1234!" }
                            """.formatted(email)))
            .andExpect(status().isCreated());

        outboxWorker.processJobs();
        String verifyToken = mockEmailService.tokenAfterProcessing(outboxWorker, email);
        assertThat(verifyToken).isNotBlank();
        mockMvc.perform(get("/api/v1/auth/verify?token=" + verifyToken))
            .andExpect(status().isOk());

        MvcResult result = mockMvc.perform(post("/api/v1/users/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        { "email": "%s", "password": "Segura1234!" }
                        """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("token").asText();
    }

    @Test void historyReturnsOnlyLatest50Versions() throws Exception {
        String address = "history-" + java.util.UUID.randomUUID() + "@miga.uy";
        String historyToken = registerAndLogin(address);
        Long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, address);
        jdbc.update("""
            INSERT INTO plans (user_id, created_at, updated_at, is_current, superseded_at)
            SELECT ?, TIMESTAMPTZ '2025-01-01 12:00:00+00' + i * INTERVAL '1 day',
                NOW(), false, TIMESTAMPTZ '2025-01-02 12:00:00+00' + i * INTERVAL '1 day'
            FROM generate_series(1, 55) AS i
            """, userId);
        String result = mockMvc.perform(get("/api/v1/my-plan/historial").header("Authorization", "Bearer " + historyToken))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode history = objectMapper.readTree(result);
        assertThat(history.isArray()).isTrue();
        assertThat(history.size()).isEqualTo(50);
        var expected = jdbc.queryForList("SELECT (created_at AT TIME ZONE 'America/Montevideo')::date::text FROM plans WHERE user_id = ? ORDER BY superseded_at DESC, id DESC LIMIT 50", String.class, userId);
        for (int index = 0; index < 50; index++) {
            assertThat(history.get(index).path("createdAt").asText()).isEqualTo(expected.get(index));
        }
    }
}
