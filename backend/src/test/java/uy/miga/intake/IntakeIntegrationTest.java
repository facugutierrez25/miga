package uy.miga.intake;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class IntakeIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private FilterChainProxy springSecurityFilterChain;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;
    private String token;
    private long mealId;
    private static final String DATE = "2026-01-15";
    private static final String ENTRY_JSON = """
            { "food": "Pechuga de pollo", "quantity": 200, "unit": "G", "foodGroup": "PROTEINS" }
            """;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
            .addFilters(springSecurityFilterChain)
            .build();

        String email = "intake" + System.nanoTime() + "@miga.uy";

        mockMvc.perform(post("/api/v1/users")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "email": "%s", "password": "Segura1234!" }
                """.formatted(email)));

        MvcResult login = mockMvc.perform(post("/api/v1/users/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "email": "%s", "password": "Segura1234!" }
                """.formatted(email)))
            .andReturn();
        token = objectMapper.readTree(login.getResponse().getContentAsString()).get("token").asText();

        MvcResult plan = mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "meals": [{ "name": "Desayuno", "displayOrder": 1,
                  "portions": [{ "foodGroup": "PROTEINS", "portions": 1 }] }] }
                """))
            .andReturn();
        mealId = objectMapper.readTree(plan.getResponse().getContentAsString())
            .get("meals").get(0).get("id").asLong();
    }

    @Test
    void getEntries_newUser_returnsEmptyList() throws Exception {
        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void addEntry_createsAndReturnsItem() throws Exception {
        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(ENTRY_JSON))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNumber())
            .andExpect(jsonPath("$.mealId").value(mealId))
            .andExpect(jsonPath("$.food").value("Pechuga de pollo"))
            .andExpect(jsonPath("$.quantity").value(200.0))
            .andExpect(jsonPath("$.unit").value("G"))
            .andExpect(jsonPath("$.foodGroup").value("PROTEINS"))
            .andExpect(jsonPath("$.consumed").value(false));
    }

    @Test
    void addMultipleEntries_sameMeal_allPersisted() throws Exception {
        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(ENTRY_JSON));

        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "food": "Arroz cocido", "quantity": 1, "unit": "TAZA", "foodGroup": "GRAINS" }
                """));

        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].food").value("Pechuga de pollo"))
            .andExpect(jsonPath("$[1].food").value("Arroz cocido"));
    }

    @Test
    void markConsumed_updatesAllEntriesForMeal() throws Exception {
        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(ENTRY_JSON));

        mockMvc.perform(put("/api/v1/intake/" + DATE + "/" + mealId + "/consumed")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$[0].consumed").value(true));
    }

    @Test
    void unmarkConsumed_resetsConsumedFlag() throws Exception {
        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(ENTRY_JSON));

        mockMvc.perform(put("/api/v1/intake/" + DATE + "/" + mealId + "/consumed")
            .header("Authorization", "Bearer " + token));

        mockMvc.perform(delete("/api/v1/intake/" + DATE + "/" + mealId + "/consumed")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$[0].consumed").value(false));
    }

    @Test
    void deleteEntry_removesItem() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(ENTRY_JSON))
            .andReturn();

        long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(delete("/api/v1/intake/entries/" + id)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void deleteEntry_otherUsersEntry_returnsNotFound() throws Exception {
        mockMvc.perform(delete("/api/v1/intake/entries/99999")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isNotFound());
    }

    @Test
    void getEntries_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/intake/" + DATE))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void getEntries_onlyReturnsSameDateEntries() throws Exception {
        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "food": "Manzana", "quantity": 1, "unit": "UNIDAD", "foodGroup": "FRUITS" }
                """));

        mockMvc.perform(post("/api/v1/intake/2026-01-16/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "food": "Banana", "quantity": 1, "unit": "UNIDAD", "foodGroup": "FRUITS" }
                """));

        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].food").value("Manzana"));
    }
}
