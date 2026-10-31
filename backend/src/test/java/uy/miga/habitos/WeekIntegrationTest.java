package uy.miga.habitos;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import uy.miga.MigaApplication;
import uy.miga.users.EmailOutboxWorker;
import uy.miga.users.MockEmailService;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = MigaApplication.class, webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class WeekIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private FilterChainProxy springSecurityFilterChain;
    @Autowired private MockEmailService mockEmailService;
    @Autowired private EmailOutboxWorker outboxWorker;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbc;
    private MockMvc mockMvc;
    private String token;

    private static final String PLAN_JSON = """
        {
          "meals": [{
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
          }]
        }
        """;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
            .addFilters(springSecurityFilterChain)
            .build();
        mockEmailService.reset();
        token = registerAndLogin("semana-" + UUID.randomUUID() + "@miga.uy");
        mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, PLAN_JSON)))
            .andExpect(status().isOk());
    }

    @Test
    void removedMentionDisappearsFromWeekAndExports() throws Exception {
        String date = LocalDate.now().toString();
        JsonNode plan = objectMapper.readTree(mockMvc.perform(get("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)).andReturn().getResponse().getContentAsString());
        long mealId = plan.path("meals").get(0).path("id").asLong();
        JsonNode note = objectMapper.readTree(mockMvc.perform(put("/api/v1/registro/" + date + "/comidas/" + mealId + "/nota")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"text\":\"leche, manzana\",\"version\":null}"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        mockMvc.perform(delete("/api/v1/registro/" + date + "/items/" + note.path("entries").get(1).path("id").asLong())
            .param("version", note.path("version").asText()).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
        String week = mockMvc.perform(get("/api/v1/semana").param("date", date)
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        assertThat(week).contains("leche").doesNotContain("manzana");
        String csv = mockMvc.perform(get("/api/v1/semana/export").param("date", date)
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        assertThat(csv).contains("leche").doesNotContain("manzana");
        byte[] xlsx = mockMvc.perform(get("/api/v1/semana/export").param("date", date).param("format", "xlsx")
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray();
        try (var workbook = new org.dhatim.fastexcel.reader.ReadableWorkbook(new java.io.ByteArrayInputStream(xlsx))) {
            String cells = workbook.getFirstSheet().read().stream()
                .map(row -> row.getCellText(1)).collect(java.util.stream.Collectors.joining(" "));
            assertThat(cells).contains("leche").doesNotContain("manzana");
        }
    }

    @Test
    void getWeek_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/semana")).andExpect(status().isUnauthorized());
    }

    @Test
    void getWeek_returns7Days() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/semana")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.days").isArray())
            .andExpect(jsonPath("$.days.length()").value(7))
            .andExpect(jsonPath("$.weekStart").isString())
            .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.path("days").size()).isEqualTo(7);
    }

    @Test
    void getWeek_withDate_returnsCorrectWeek() throws Exception {
        String monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY).toString();
        mockMvc.perform(get("/api/v1/semana")
            .param("date", monday)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.weekStart").value(monday));
    }

    @Test
    void createHabit_andListHabits() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/habitos")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"name":"Agua","habitType":"CANTIDAD","unit":"vasos","dailyGoal":8,"step":1,"period":"DIA","displayOrder":1}
                """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNumber())
            .andExpect(jsonPath("$.name").value("Agua"))
            .andReturn();

        JsonNode created = objectMapper.readTree(result.getResponse().getContentAsString());
        long habitId = created.path("id").asLong();

        mockMvc.perform(get("/api/v1/habitos")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.id == " + habitId + ")].name").value("Agua"));
    }

    @Test
    void logHabit_isIdempotent() throws Exception {
        long habitId = createHabit("Pasos", "CONTADOR", "pasos");

        String date = LocalDate.now().toString();
        logHabit(habitId, date, 5);
        JsonNode second = logHabit(habitId, date, 5);
        assertThat(second.path("value").asDouble()).isEqualTo(5.0);
    }

    @Test
    void logHabit_updatesValue() throws Exception {
        long habitId = createHabit("Agua", "CANTIDAD", "vasos");
        String date = LocalDate.now().toString();
        logHabit(habitId, date, 3);
        JsonNode updated = logHabit(habitId, date, 8);
        assertThat(updated.path("value").asDouble()).isEqualTo(8.0);
    }

    @Test
    void getWeek_showsHabitLogsInDays() throws Exception {
        long habitId = createHabit("Ejercicio", "SI_NO", null);
        String today = LocalDate.now().toString();
        logHabit(habitId, today, 1);

        MvcResult result = mockMvc.perform(get("/api/v1/semana")
            .param("date", today)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode todayNode = null;
        for (JsonNode day : body.path("days")) {
            if (day.path("date").asText().equals(today)) {
                todayNode = day;
                break;
            }
        }
        assertThat(todayNode).isNotNull();
        assertThat(todayNode.path("habitLogs").size()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void twoUsers_cannotSeeEachOthersLogs() throws Exception {
        long habitId = createHabit("Agua", "CANTIDAD", "vasos");
        String today = LocalDate.now().toString();
        logHabit(habitId, today, 5);

        String tokenB = registerAndLogin("semana-otro-" + UUID.randomUUID() + "@miga.uy");
        mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + tokenB)
            .contentType(MediaType.APPLICATION_JSON)
            .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, tokenB, PLAN_JSON)))
            .andExpect(status().isOk());

        MvcResult result = mockMvc.perform(get("/api/v1/semana")
            .param("date", today)
            .header("Authorization", "Bearer " + tokenB))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        for (JsonNode day : body.path("days")) {
            if (day.path("date").asText().equals(today)) {
                assertThat(day.path("habitLogs").size()).isEqualTo(0);
            }
        }
    }

    @Test
    void exportCsv_returnsValidCsv() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/semana/export")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn();

        String csv = result.getResponse().getContentAsString();
        assertThat(csv).contains("Fecha", "Desayuno");
        assertThat(csv.lines().count()).isGreaterThanOrEqualTo(8);
    }

    @Test
    void historicalPlansNotesAndExportsStayIsolated() throws Exception {
        LocalDate monday = LocalDate.of(2026, 1, 5);
        JsonNode plan = objectMapper.readTree(mockMvc.perform(get("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)).andReturn().getResponse().getContentAsString());
        long oldMeal = plan.path("meals").get(0).path("id").asLong();
        long oldPlan = jdbc.queryForObject("SELECT plan_id FROM meals WHERE id = ?", Long.class, oldMeal);
        long user = jdbc.queryForObject("SELECT user_id FROM plans WHERE id = ?", Long.class, oldPlan);
        jdbc.update("UPDATE plans SET created_at = ?::date WHERE id = ?", monday.toString(), oldPlan);
        mockMvc.perform(put("/api/v1/my-plan").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token,
                PLAN_JSON.replace("Desayuno", "Almuerzo")))).andExpect(status().isOk());
        long newPlan = jdbc.queryForObject("SELECT id FROM plans WHERE user_id = ? AND is_current", Long.class, user);
        jdbc.update("UPDATE plans SET superseded_at = ?::date WHERE id = ?", monday.plusDays(3).toString(), oldPlan);
        jdbc.update("UPDATE plans SET created_at = ?::date, modo_registro = 'LIBRE' WHERE id = ?", monday.plusDays(3).toString(), newPlan);
        long newMeal = jdbc.queryForObject("SELECT id FROM meals WHERE plan_id = ?", Long.class, newPlan);
        String note = "=texto privado; con \"comillas\"\nsegunda l\u00ednea";
        jdbc.update("INSERT INTO meal_notes(user_id, fecha, meal_id, texto, plan_id) VALUES (?, ?, ?, ?, ?)",
            user, monday.plusDays(3), newMeal, note, newPlan);
        JsonNode week = objectMapper.readTree(mockMvc.perform(get("/api/v1/semana").param("date", monday.toString())
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(week.path("days").get(0).path("totalGoal").asDouble()).isEqualTo(5.5);
        assertThat(week.path("days").get(0).path("meals").get(0).path("name").asText()).isEqualTo("Desayuno");
        assertThat(week.path("days").get(3).path("totalGoal").asDouble()).isZero();
        assertThat(week.path("days").get(3).path("meals").get(0).path("status").asText()).isEqualTo("REGISTRADA");
        String csv = mockMvc.perform(get("/api/v1/semana/export").param("date", monday.toString())
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(csv).contains("Desayuno", "Almuerzo", "'=texto privado", "segunda l\u00ednea");
        byte[] xlsx = mockMvc.perform(get("/api/v1/semana/export").param("date", monday.toString()).param("format", "xlsx")
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try (var workbook = new org.dhatim.fastexcel.reader.ReadableWorkbook(new java.io.ByteArrayInputStream(xlsx))) {
            assertThat(workbook.getFirstSheet().read().get(4).getCellText(2)).isEqualTo("'" + note);
        }
        String other = registerAndLogin("isolation-" + UUID.randomUUID() + "@miga.uy");
        String otherWeek = mockMvc.perform(get("/api/v1/semana").param("date", monday.toString())
            .header("Authorization", "Bearer " + other)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(otherWeek).doesNotContain("texto privado", "Almuerzo");
        for (String format : java.util.List.of("csv", "xlsx")) {
            byte[] bytes = mockMvc.perform(get("/api/v1/semana/export").param("date", monday.toString()).param("format", format)
                .header("Authorization", "Bearer " + other)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
            if (format.equals("csv")) assertThat(new String(bytes, java.nio.charset.StandardCharsets.UTF_8)).doesNotContain("texto privado", "Almuerzo");
            else try (var workbook = new org.dhatim.fastexcel.reader.ReadableWorkbook(new java.io.ByteArrayInputStream(bytes))) {
                assertThat(workbook.getFirstSheet().read().getFirst().getCellCount()).isEqualTo(1);
            }
        }
    }

    @Test
    void flexibleHabitCountsMentionsAndRewritingReplacesTheCount() throws Exception {
        JsonNode rules = objectMapper.readTree(mockMvc.perform(get("/api/v1/my-plan/reglas")
            .header("Authorization", "Bearer " + token)).andReturn().getResponse().getContentAsString());
        mockMvc.perform(post("/api/v1/my-plan/alimentos").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"planVersion":%d,"alimento":"galleta especial","sinonimos":[],"tipo":"FLEXIBLE"}
                """.formatted(rules.path("planVersion").asLong()))).andExpect(status().isCreated());
        long habit = objectMapper.readTree(mockMvc.perform(post("/api/v1/habitos")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"name":"Flexibles","habitType":"CONTADOR","countsFlexibleMeals":true,"step":1,"displayOrder":1}
                """)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asLong();
        JsonNode plan = objectMapper.readTree(mockMvc.perform(get("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)).andReturn().getResponse().getContentAsString());
        long meal = plan.path("meals").get(0).path("id").asLong();
        String today = LocalDate.now().toString();
        for (String text : java.util.List.of("galleta especial, galleta especial", "galleta especial, galleta especial", "galleta especial")) {
            mockMvc.perform(post("/api/v1/registro/" + today + "/" + meal + "/note")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of("text", text)))).andExpect(status().isCreated());
            JsonNode week = objectMapper.readTree(mockMvc.perform(get("/api/v1/semana").param("date", today)
                .header("Authorization", "Bearer " + token)).andReturn().getResponse().getContentAsString());
            for (JsonNode day : week.path("days")) if (day.path("date").asText().equals(today)) {
                assertThat(day.path("habitLogs").get(0).path("habitId").asLong()).isEqualTo(habit);
                assertThat(day.path("habitLogs").get(0).path("value").asInt()).isEqualTo(text.contains(",") ? 2 : 1);
            }
        }
        mockMvc.perform(put("/api/v1/habitos/" + habit + "/log").param("date", today)
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content("{\"value\":99}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void habitOfAnEarlierPlanCanBeLoggedOnItsDayButNotToday() throws Exception {
        long oldHabit = createHabit("Agua", "CANTIDAD", "lt");
        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token,
                    PLAN_JSON.replace("Desayuno", "Desayuno nuevo"))))
            .andExpect(status().isOk());
        String yesterday = java.time.LocalDate.now().minusDays(1).toString();

        logHabit(oldHabit, yesterday, 1.5);

        int todayStatus = mockMvc.perform(put("/api/v1/habitos/" + oldHabit + "/log")
                .param("date", java.time.LocalDate.now().toString())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"value\":1}"))
            .andReturn().getResponse().getStatus();
        org.assertj.core.api.Assertions.assertThat(todayStatus).isEqualTo(400);
    }

    @Test
    void mealWithNoteIsNeverShownAsNotRecorded() throws Exception {
        JsonNode plan = objectMapper.readTree(mockMvc.perform(get("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token))
            .andReturn().getResponse().getContentAsString());
        long mealId = plan.path("meals").get(0).path("id").asLong();
        String today = java.time.LocalDate.now().toString();
        mockMvc.perform(put("/api/v1/registro/" + today + "/comidas/" + mealId + "/nota")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"text\":\"leche\",\"version\":null}"))
            .andExpect(status().isCreated());

        JsonNode week = objectMapper.readTree(mockMvc.perform(get("/api/v1/semana").param("date", today)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        for (JsonNode day : week.path("days")) {
            if (!today.equals(day.path("date").asText())) continue;
            for (JsonNode meal : day.path("meals")) {
                if (meal.path("mealId").asLong() == mealId) {
                    org.assertj.core.api.Assertions.assertThat(meal.path("status").asText())
                        .isIn("CASI", "EN_PLAN", "DE_MAS", "REGISTRADA", "PREGUNTAR");
                    return;
                }
            }
        }
        throw new AssertionError("no se encontró la comida de hoy en la semana");
    }

    private long createHabit(String name, String type, String unit) throws Exception {
        String unitJson = unit != null ? "\"" + unit + "\"" : "null";
        MvcResult result = mockMvc.perform(post("/api/v1/habitos")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"name":"%s","habitType":"%s","unit":%s,"dailyGoal":null,"step":1,"period":"DIA","displayOrder":1}
                """.formatted(name, type, unitJson)))
            .andExpect(status().isCreated())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asLong();
    }

    private JsonNode logHabit(long habitId, String date, double value) throws Exception {
        MvcResult result = mockMvc.perform(put("/api/v1/habitos/" + habitId + "/log")
            .param("date", date)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"value\":" + value + "}"))
            .andExpect(status().isCreated())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private String registerAndLogin(String email) throws Exception {
        try {
            mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    { "email": "%s", "password": "Segura1234!" }
                    """.formatted(email)));
        } catch (Exception ignored) {}
        outboxWorker.processJobs();
        String verifyToken = mockEmailService.getTokenFor(email);
        if (verifyToken != null) {
            mockMvc.perform(get("/api/v1/auth/verify?token=" + verifyToken));
        }
        MvcResult result = mockMvc.perform(post("/api/v1/users/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "email": "%s", "password": "Segura1234!" }
                """.formatted(email)))
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
            .get("token").asText();
    }
}
