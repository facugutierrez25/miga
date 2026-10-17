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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class RegistroIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private FilterChainProxy springSecurityFilterChain;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;
    private String token;
    private long mealId;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(springSecurityFilterChain)
                .build();

        String email = "registro" + System.nanoTime() + "@miga.uy";

        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        { "email": "%s", "password": "Segura1234!" }
                        """.formatted(email)));

        MvcResult loginResult = mockMvc.perform(post("/api/v1/users/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        { "email": "%s", "password": "Segura1234!" }
                        """.formatted(email)))
                .andReturn();

        token = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .get("token").asText();

        // Crear un plan y obtener el ID de la primera comida
        MvcResult planResult = mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "meals": [{
                            "name": "Desayuno",
                            "suggestedTime": "08:00:00",
                            "displayOrder": 0,
                            "portions": [{ "foodGroup": "PROTEINS", "portions": 2 }]
                          }]
                        }
                        """))
                .andReturn();

        JsonNode plan = objectMapper.readTree(planResult.getResponse().getContentAsString());
        mealId = plan.get("meals").get(0).get("id").asLong();
    }

    @Test
    void getHoy_sinRegistros_devuelveListaVacia() throws Exception {
        mockMvc.perform(get("/api/v1/registro/hoy")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void getHoy_sinToken_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/registro/hoy"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void markEaten_marcaComidaYApareceEnHoy() throws Exception {
        mockMvc.perform(post("/api/v1/registro/hoy/" + mealId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/registro/hoy")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value(mealId));
    }

    @Test
    void markEaten_idempotente_noCreaDuplicado() throws Exception {
        mockMvc.perform(post("/api/v1/registro/hoy/" + mealId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/registro/hoy/" + mealId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        MvcResult result = mockMvc.perform(get("/api/v1/registro/hoy")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode lista = objectMapper.readTree(result.getResponse().getContentAsString());
        assert lista.size() == 1;
    }

    @Test
    void unmarkEaten_desmarcaComida() throws Exception {
        mockMvc.perform(post("/api/v1/registro/hoy/" + mealId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(delete("/api/v1/registro/hoy/" + mealId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/registro/hoy")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }
}
