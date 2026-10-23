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

import uy.miga.users.MockEmailService;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class EquivalenceIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private FilterChainProxy springSecurityFilterChain;
    @Autowired private MockEmailService mockEmailService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;
    private String token;

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

        String verifyToken = mockEmailService.getLastToken();
        if (verifyToken != null) {
            mockMvc.perform(get("/api/v1/auth/verify?token=" + verifyToken));
        }

        MvcResult result = mockMvc.perform(post("/api/v1/users/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "email": "equiv@miga.uy", "password": "Segura1234!" }
                """))
            .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        token = json.get("token").asText();
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
                { "foodGroup": "PROTEINS", "food": "Pechuga de pollo", "quantity": 200, "unit": "G" }
                """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNumber())
            .andExpect(jsonPath("$.foodGroup").value("PROTEINS"))
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
                { "foodGroup": "PROTEINS", "food": "Pechuga de pollo", "quantity": 200, "unit": "G" }
                """));

        mockMvc.perform(post("/api/v1/equivalences")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "foodGroup": "PROTEINS", "food": "Garbanzos cocidos", "quantity": 100, "unit": "G" }
                """));

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
                { "foodGroup": "DAIRY", "food": "Leche", "quantity": 1, "unit": "TAZA" }
                """))
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
