package uy.miga.registro;

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
abstract class RegistroIntegrationTestBase {

    @Autowired protected WebApplicationContext context;
    @Autowired protected FilterChainProxy springSecurityFilterChain;
    @Autowired protected MockEmailService mockEmailService;
    @Autowired protected EmailOutboxWorker outboxWorker;
    @Autowired protected MealNoteRepository notes;
    @Autowired protected RegistroService registro;
    @Autowired protected org.springframework.jdbc.core.JdbcTemplate jdbc;

    protected JsonNode undo(String date, JsonNode body) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/v1/registro/" + date + "/items/resolve/undo")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body.toString()))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    protected JsonNode resolve(String date, long id, String body) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/v1/registro/" + date + "/items/" + id + "/resolve")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    protected final ObjectMapper objectMapper = new ObjectMapper()
        .findAndRegisterModules();
    protected MockMvc mockMvc;
    protected String token;
    protected Long mealId;

    protected static final String PLAN_JSON = """
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

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
            .addFilters(springSecurityFilterChain)
            .build();
        mockEmailService.reset();
        token = registerAndLogin("registro-" + java.util.UUID.randomUUID() + "@miga.uy");

        MvcResult planResult = mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, PLAN_JSON)))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode plan = objectMapper.readTree(planResult.getResponse().getContentAsString());
        mealId = plan.path("meals").get(0).path("id").asLong();
    }

    protected long deleteNoteVersion(String url, long version) throws Exception {
        var result = mockMvc.perform(delete(url + "?version=" + version)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("version").asLong();
    }

    protected String registerAndLogin(String email) throws Exception {
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

    protected void createUniqueUserPlan() throws Exception {
        token = registerAndLogin("registro-" + java.util.UUID.randomUUID() + "@miga.uy");
        MvcResult result = mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, PLAN_JSON)))
            .andExpect(status().isOk())
            .andReturn();
        mealId = objectMapper.readTree(result.getResponse().getContentAsString())
            .path("meals").get(0).path("id").asLong();
    }

    protected JsonNode removeItem(String date, long id, long version) throws Exception {
        var result = mockMvc.perform(delete("/api/v1/registro/" + date + "/items/" + id)
            .param("version", Long.toString(version)).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    protected JsonNode putNote(String date, String text) throws Exception {
        JsonNode meals = getDay(date).path("meals");
        JsonNode currentVersion = meals.get(0).path("noteVersion");
        java.util.Map<String, Object> request = new java.util.HashMap<>();
        request.put("text", text);
        request.put("version", currentVersion.isNumber() ? currentVersion.asLong() : null);
        MvcResult result = mockMvc.perform(put("/api/v1/registro/" + date + "/comidas/" + mealId + "/nota")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.noteId").isNumber())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    protected JsonNode getDay(String date) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/registro/" + date)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.meals").isArray())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    protected org.springframework.test.web.servlet.ResultActions patchItem(String date, long id, String body) throws Exception {
        return mockMvc.perform(patch("/api/v1/registro/" + date + "/items/" + id)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
    }

    protected JsonNode planRules() throws Exception {
        return objectMapper.readTree(mockMvc.perform(get("/api/v1/my-plan/reglas")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    protected long groupId(String name) throws Exception {
        for (JsonNode g : planRules().path("grupos")) {
            if (name.equals(g.path("name").asText())) return g.path("id").asLong();
        }
        throw new AssertionError(name);
    }

    protected void createCompound(String food, String... groupNames) throws Exception {
        JsonNode rules = planRules();
        var components = new java.util.ArrayList<java.util.Map<String, Object>>();
        for (String name : groupNames) {
            for (JsonNode g : rules.path("grupos")) {
                if (name.equals(g.path("name").asText())) {
                    components.add(java.util.Map.of("groupUid", g.path("uid").asText(), "porciones", 1));
                }
            }
        }
        mockMvc.perform(post("/api/v1/my-plan/alimentos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of(
                    "planVersion", rules.path("planVersion").asLong(), "alimento", food,
                    "tipo", "COMPUESTO", "componentes", components))))
            .andExpect(status().isCreated());
    }

}
