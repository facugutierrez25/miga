package uy.miga.equivalences;

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

import uy.miga.users.EmailOutboxWorker;
import uy.miga.users.MockEmailService;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class EquivalenceIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private FilterChainProxy springSecurityFilterChain;
    @Autowired private MockEmailService mockEmailService;
    @Autowired private EmailOutboxWorker outboxWorker;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;
    private String token;
    private long proGroupId;
    private long lacGroupId;

    @BeforeEach
    void setup() throws Exception {
        mockEmailService.reset();
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
            .addFilters(springSecurityFilterChain)
            .build();

        try {
            mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    { "email": "equiv@miga.uy", "password": "Segura1234!" }
                    """));
        } catch (Exception ignored) {}

        outboxWorker.processJobs();
        String verifyToken = mockEmailService.getLastToken();
        if (verifyToken != null) {
            mockMvc.perform(get("/api/v1/auth/verify?token=" + verifyToken));
        }

        MvcResult loginResult = mockMvc.perform(post("/api/v1/users/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "email": "equiv@miga.uy", "password": "Segura1234!" }
                """))
            .andReturn();

        JsonNode loginJson = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        token = loginJson.get("token").asText();

        // Guardar un plan para obtener los IDs de los grupos
        MvcResult planResult = mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "meals": [{ "name": "Desayuno", "displayOrder": 1,
                  "portions": [
                    { "foodGroupAbbr": "PRO", "portions": 1.0 },
                    { "foodGroupAbbr": "LAC", "portions": 1.0 }
                  ] }] }
                """))
            .andReturn();

        JsonNode planJson = objectMapper.readTree(planResult.getResponse().getContentAsString());
        for (JsonNode g : planJson.get("foodGroups")) {
            String abbr = g.get("abbreviation").asText();
            if ("PRO".equals(abbr)) proGroupId = g.get("id").asLong();
            if ("LAC".equals(abbr)) lacGroupId = g.get("id").asLong();
        }
    }

    @Test
    void getEquivalences_newUser_returnsEmptyList() throws Exception {
        mockMvc.perform(get("/api/v1/equivalences")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void addEquivalence_createsAndReturnsItem() throws Exception {
        mockMvc.perform(post("/api/v1/equivalences")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "foodGroupId": %d, "food": "Pechuga de pollo", "quantity": 200, "unit": "G" }
                """.formatted(proGroupId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNumber())
            .andExpect(jsonPath("$.foodGroupId").value(proGroupId))
            .andExpect(jsonPath("$.food").value("Pechuga de pollo"))
            .andExpect(jsonPath("$.quantity").value(200.0))
            .andExpect(jsonPath("$.unit").value("G"));
    }

    @Test
    void addMultipleEquivalences_sameGroup_allPersisted() throws Exception {
        mockMvc.perform(post("/api/v1/equivalences")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "foodGroupId": %d, "food": "Pechuga de pollo", "quantity": 200, "unit": "G" }
                """.formatted(proGroupId)));

        mockMvc.perform(post("/api/v1/equivalences")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "foodGroupId": %d, "food": "Garbanzos cocidos", "quantity": 100, "unit": "G" }
                """.formatted(proGroupId)));

        mockMvc.perform(get("/api/v1/equivalences")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].food").value("Pechuga de pollo"))
            .andExpect(jsonPath("$[1].food").value("Garbanzos cocidos"));
    }

    @Test
    void deleteEquivalence_removesItem() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/equivalences")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "foodGroupId": %d, "food": "Leche", "quantity": 1, "unit": "TAZA" }
                """.formatted(lacGroupId)))
            .andReturn();

        long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(delete("/api/v1/equivalences/" + id)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/equivalences")
            .header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void deleteEquivalence_otherUsersItem_returnsNotFound() throws Exception {
        mockMvc.perform(delete("/api/v1/equivalences/99999")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isNotFound());
    }

    @Test
    void getEquivalences_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/equivalences"))
            .andExpect(status().isUnauthorized());
    }
}
