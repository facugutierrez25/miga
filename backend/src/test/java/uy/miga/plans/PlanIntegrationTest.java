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
}
