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

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
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
            .content(PLAN_JSON))
            .andExpect(status().isOk());
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
            .content(PLAN_JSON))
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
        assertThat(csv).contains("Fecha,Datos");
        assertThat(csv.lines().count()).isGreaterThanOrEqualTo(8);
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
        String verifyToken = mockEmailService.getLastToken();
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
