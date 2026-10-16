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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class PlanIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private FilterChainProxy springSecurityFilterChain;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;
    private String token;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(springSecurityFilterChain)
                .build();

        // Registrar y hacer login para obtener el token
        try {
            mockMvc.perform(post("/api/v1/users")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            { "email": "plan@miga.uy", "password": "Segura1234!" }
                            """));
        } catch (Exception ignored) {}

        MvcResult result = mockMvc.perform(post("/api/v1/users/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        { "email": "plan@miga.uy", "password": "Segura1234!" }
                        """))
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        token = json.get("token").asText();
    }

    @Test
    void getMyPlan_whenNoPlan_returns404() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        { "email": "sinplan@miga.uy", "password": "Segura1234!" }
                        """));

        MvcResult loginResult = mockMvc.perform(post("/api/v1/users/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        { "email": "sinplan@miga.uy", "password": "Segura1234!" }
                        """))
                .andReturn();

        String sinPlanToken = objectMapper
                .readTree(loginResult.getResponse().getContentAsString())
                .get("token").asText();

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
                        { "foodGroup": "PROTEINS", "portions": 1.0 },
                        { "foodGroup": "GRAINS",   "portions": 2.0 },
                        { "foodGroup": "FRUITS",   "portions": 1.0 },
                        { "foodGroup": "DAIRY",    "portions": 1.0 },
                        { "foodGroup": "FATS",     "portions": 0.5 },
                        { "foodGroup": "VEGETABLES","portions": 0.0 }
                      ]
                    }
                  ]
                }
                """;

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(planJson))
                .andExpect(status().isOk())
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
                .content("""
                        {
                          "meals": [
                            {
                              "name": "Desayuno",
                              "displayOrder": 1,
                              "portions": [
                                { "foodGroup": "PROTEINS", "portions": 0.3 }
                              ]
                            }
                          ]
                        }
                        """))
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
        String histToken = registerAndLogin("historial@miga.uy");

        String primerPlan = """
                {
                  "meals": [{
                    "name": "Desayuno",
                    "displayOrder": 1,
                    "portions": [
                      { "foodGroup": "PROTEINS",   "portions": 1.0 },
                      { "foodGroup": "GRAINS",     "portions": 1.0 },
                      { "foodGroup": "FRUITS",     "portions": 1.0 },
                      { "foodGroup": "DAIRY",      "portions": 1.0 },
                      { "foodGroup": "FATS",       "portions": 0.5 },
                      { "foodGroup": "VEGETABLES", "portions": 0.0 }
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
                        { "foodGroup": "PROTEINS",   "portions": 2.0 },
                        { "foodGroup": "GRAINS",     "portions": 2.0 },
                        { "foodGroup": "FRUITS",     "portions": 1.0 },
                        { "foodGroup": "DAIRY",      "portions": 0.0 },
                        { "foodGroup": "FATS",       "portions": 1.0 },
                        { "foodGroup": "VEGETABLES", "portions": 1.0 }
                      ]
                    },
                    {
                      "name": "Cena",
                      "displayOrder": 2,
                      "portions": [
                        { "foodGroup": "PROTEINS",   "portions": 1.5 },
                        { "foodGroup": "GRAINS",     "portions": 1.0 },
                        { "foodGroup": "FRUITS",     "portions": 0.0 },
                        { "foodGroup": "DAIRY",      "portions": 0.0 },
                        { "foodGroup": "FATS",       "portions": 0.5 },
                        { "foodGroup": "VEGETABLES", "portions": 2.0 }
                      ]
                    }
                  ]
                }
                """;

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + histToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(primerPlan))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + histToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(segundoPlan))
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
        String freshToken = registerAndLogin("sinhistorial@miga.uy");

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
        String token = registerAndLogin("sincambios@miga.uy");

        String plan = """
                {
                  "meals": [{
                    "name": "Desayuno",
                    "displayOrder": 1,
                    "portions": [
                      { "foodGroup": "PROTEINS",   "portions": 1.0 },
                      { "foodGroup": "GRAINS",     "portions": 2.0 },
                      { "foodGroup": "FRUITS",     "portions": 1.0 },
                      { "foodGroup": "DAIRY",      "portions": 1.0 },
                      { "foodGroup": "FATS",       "portions": 0.5 },
                      { "foodGroup": "VEGETABLES", "portions": 0.0 }
                    ]
                  }]
                }
                """;

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(plan))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(plan))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/my-plan/historial")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    private String registerAndLogin(String email) throws Exception {
        try {
            mockMvc.perform(post("/api/v1/users")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            { "email": "%s", "password": "Segura1234!" }
                            """.formatted(email)));
        } catch (Exception ignored) {}

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
