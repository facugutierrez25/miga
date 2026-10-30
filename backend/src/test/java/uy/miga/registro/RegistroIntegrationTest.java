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
import uy.miga.users.MockEmailService;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = MigaApplication.class, webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class RegistroIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private FilterChainProxy springSecurityFilterChain;
    @Autowired private MockEmailService mockEmailService;

    private final ObjectMapper objectMapper = new ObjectMapper()
        .findAndRegisterModules();
    private MockMvc mockMvc;
    private String token;
    private Long mealId;

    private static final String PLAN_JSON = """
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
        token = registerAndLogin("registro@miga.uy");

        MvcResult planResult = mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(PLAN_JSON))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode plan = objectMapper.readTree(planResult.getResponse().getContentAsString());
        mealId = plan.path("meals").get(0).path("id").asLong();
    }

    @Test
    void saveNote_withRecognizedFood_returnsInterpretation() throws Exception {
        String date = LocalDate.now().toString();

        MvcResult result = mockMvc.perform(post("/api/v1/registro/" + date + "/" + mealId + "/note")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche, pan, manzana"}
                """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.noteId").isNumber())
            .andExpect(jsonPath("$.items").isArray())
            .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.path("items").size()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void saveNote_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/registro/" + LocalDate.now() + "/" + mealId + "/note")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche"}
                """))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void getNote_afterSave_returnsStoredText() throws Exception {
        String date = LocalDate.now().toString();

        mockMvc.perform(post("/api/v1/registro/" + date + "/" + mealId + "/note")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche"}
                """))
            .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/registro/" + date + "/" + mealId + "/note")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.text").value("leche"));
    }

    @Test
    void getNote_whenNotExists_returns200WithNull() throws Exception {
        mockMvc.perform(get("/api/v1/registro/" + LocalDate.now() + "/99999/note")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
    }

    @Test
    void saveNote_reinterprets_whenUpdated() throws Exception {
        String date = LocalDate.now().toString();
        String url = "/api/v1/registro/" + date + "/" + mealId + "/note";

        mockMvc.perform(post(url)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche"}
                """))
            .andExpect(status().isCreated());

        mockMvc.perform(post(url)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche, manzana"}
                """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.items.length()").value(2));
    }

    @Test
    void getDayComparison_afterNote_returnsStatuses() throws Exception {
        String date = LocalDate.now().toString();

        mockMvc.perform(post("/api/v1/registro/" + date + "/" + mealId + "/note")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche"}
                """))
            .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/registro/" + date + "/comparacion")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.meals").isArray());
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

    private void createUniqueUserPlan() throws Exception {
        token = registerAndLogin("registro-" + java.util.UUID.randomUUID() + "@miga.uy");
        MvcResult result = mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(PLAN_JSON))
            .andExpect(status().isOk())
            .andReturn();
        mealId = objectMapper.readTree(result.getResponse().getContentAsString())
            .path("meals").get(0).path("id").asLong();
    }

    private JsonNode putNote(String date, String text) throws Exception {
        MvcResult result = mockMvc.perform(put("/api/v1/registro/" + date + "/comidas/" + mealId + "/nota")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(java.util.Map.of("text", text))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.noteId").isNumber())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode getDay(String date) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/registro/" + date)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.meals").isArray())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    @Test
    void getDayRegistro_afterNote_returnsMealsAndSummary() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");

        mockMvc.perform(get("/api/v1/registro/" + date)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.meals").isArray())
            .andExpect(jsonPath("$.meals[0].noteText").value("leche"))
            .andExpect(jsonPath("$.summary").isArray())
            .andExpect(jsonPath("$.summary.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
    }

    @Test
    void putNota_isIdempotent() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode first = putNote(date, "leche");
        JsonNode second = putNote(date, "leche");

        assertThat(second.path("noteId").asLong()).isEqualTo(first.path("noteId").asLong());
    }

    @Test
    void putNota_differentText_updatesInterpretation() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");
        JsonNode updated = putNote(date, "leche, manzana");

        assertThat(updated.path("items").size()).isEqualTo(2);
    }

    @Test
    void putNota_unauthorized_returns403() throws Exception {
        createUniqueUserPlan();
        String tokenB = registerAndLogin("registro-" + java.util.UUID.randomUUID() + "@miga.uy");

        mockMvc.perform(put("/api/v1/registro/" + LocalDate.now() + "/comidas/" + mealId + "/nota")
            .header("Authorization", "Bearer " + tokenB)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche"}
                """))
            .andExpect(status().isForbidden());
    }

    @Test
    void patchItem_updatesQuantityAndGroup() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");
        JsonNode items = getDay(date).path("meals").get(0).path("items");
        assertThat(items.size()).isGreaterThanOrEqualTo(1);
        long itemId = items.get(0).path("id").asLong();

        mockMvc.perform(patch("/api/v1/registro/" + date + "/items/" + itemId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"quantity": 3, "unit": "u", "foodGroupId": null, "portions": null, "saveAsRule": false}
                """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.quantity").value(3));
    }

    @Test
    void patchItem_saveAsRule_doesNotThrow() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "huevo");
        JsonNode items = getDay(date).path("meals").get(0).path("items");
        assertThat(items.size()).isGreaterThanOrEqualTo(1);
        JsonNode item = items.get(0);
        assertThat(item.path("foodGroupId").isNumber()).isTrue();

        mockMvc.perform(patch("/api/v1/registro/" + date + "/items/" + item.path("id").asLong())
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"quantity": 1, "unit": "u", "foodGroupId": %d, "portions": 1, "saveAsRule": true}
                """.formatted(item.path("foodGroupId").asLong())))
            .andExpect(status().isOk());
    }

    @Test
    void saveRespuesta_consumed_createsEntry() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");
        JsonNode before = getDay(date).path("meals").get(0).path("items");
        long foodGroupId = before.isEmpty() ? 1L : before.get(0).path("foodGroupId").asLong();

        mockMvc.perform(post("/api/v1/registro/" + date + "/comidas/" + mealId + "/respuestas")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"foodGroupId": %d, "consumed": true}
                """.formatted(foodGroupId)))
            .andExpect(status().isCreated());

        JsonNode after = getDay(date).path("meals").get(0).path("items");
        assertThat(after.size()).isEqualTo(before.size() + 1);
        assertThat(after).anySatisfy(item -> {
            assertThat(item.path("foodGroupId").asLong()).isEqualTo(foodGroupId);
            assertThat(item.path("origin").asText()).isEqualTo("USUARIO");
        });
    }

    @Test
    void saveRespuesta_notConsumed_noEntry() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");
        JsonNode before = getDay(date).path("meals").get(0).path("items");
        long foodGroupId = before.isEmpty() ? 1L : before.get(0).path("foodGroupId").asLong();

        mockMvc.perform(post("/api/v1/registro/" + date + "/comidas/" + mealId + "/respuestas")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"foodGroupId": %d, "consumed": false}
                """.formatted(foodGroupId)))
            .andExpect(status().isCreated());

        JsonNode after = getDay(date).path("meals").get(0).path("items");
        assertThat(after.size()).isEqualTo(before.size());
    }

    @Test
    void getSugerencias_afterMultipleNotes_returnsTopTexts() throws Exception {
        createUniqueUserPlan();
        for (int dayOffset = 0; dayOffset < 3; dayOffset++) {
            putNote(LocalDate.now().minusDays(dayOffset).toString(), "leche");
        }

        mockMvc.perform(get("/api/v1/registro/sugerencias")
            .param("mealId", mealId.toString())
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
            .andExpect(jsonPath("$[0]").value("leche"));
    }

    @Test
    void twoUserIsolation_cannotPatchOtherUserItem() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");
        JsonNode items = getDay(date).path("meals").get(0).path("items");
        assertThat(items.size()).isGreaterThanOrEqualTo(1);
        long itemId = items.get(0).path("id").asLong();
        String tokenB = registerAndLogin("registro-" + java.util.UUID.randomUUID() + "@miga.uy");

        mockMvc.perform(patch("/api/v1/registro/" + date + "/items/" + itemId)
            .header("Authorization", "Bearer " + tokenB)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"quantity": 3, "unit": "u", "foodGroupId": null, "portions": null, "saveAsRule": false}
                """))
            .andExpect(status().isNotFound());
    }
}
