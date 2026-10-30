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
import uy.miga.users.MockEmailService;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
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
}
