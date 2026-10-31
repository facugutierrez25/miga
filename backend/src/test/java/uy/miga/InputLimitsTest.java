package uy.miga;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class InputLimitsTest {
    private final JsonMapper mapper = JsonMapper.builder().findAndAddModules().build();

    private MockMvc mvc(String controllerName) throws Exception {
        var constructor = Class.forName("uy.miga." + controllerName).getDeclaredConstructors()[0];
        constructor.setAccessible(true);
        var dependencies = Arrays.stream(constructor.getParameterTypes()).map(type -> mock(type)).toArray();
        return MockMvcBuilders.standaloneSetup(constructor.newInstance(dependencies))
            .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test void oversizedPasswordsReturn400() throws Exception {
        var mvc = mvc("users.UserController");
        for (String path : List.of("/api/v1/users", "/api/v1/users/login")) {
            mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("email", "test@miga.uy", "password", "Aa1!" + "a".repeat(125)))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isArray());
        }
    }

    @Test void oversizedNotesReturn400OnBothRoutes() throws Exception {
        var mvc = mvc("registro.RegistroController");
        String body = mapper.writeValueAsString(Map.of("text", "a".repeat(2001)));
        mvc.perform(put("/api/v1/registro/2026-01-01/comidas/1/nota").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/registro/2026-01-01/1/note").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest());
    }

    @Test void oversizedRuleNamesAndSynonymsReturn400() throws Exception {
        var mvc = mvc("planrules.PlanRulesController");
        for (var body : List.of(
            Map.of("planVersion", 0, "alimento", "a".repeat(101), "tipo", "LIBRE"),
            Map.of("planVersion", 0, "alimento", "Arroz", "tipo", "LIBRE", "sinonimos", List.of("a".repeat(101))),
            Map.of("planVersion", 0, "alimento", "Arroz", "tipo", "LIBRE", "sinonimos", java.util.Collections.nCopies(21, "alias")))) {
            mvc.perform(post("/api/v1/my-plan/alimentos").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
        }
    }

    @Test void invalidHabitStepsReturn400OnBothRoutes() throws Exception {
        for (String step : List.of("0", "-1", "100001")) {
            String body = "{\"planVersion\":0,\"name\":\"Agua\",\"habitType\":\"CANTIDAD\",\"period\":\"DIA\",\"displayOrder\":1,\"step\":" + step + "}";
            mvc("habitos.WeekController").perform(post("/api/v1/habitos").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isArray());
            mvc("planrules.PlanRulesController").perform(post("/api/v1/my-plan/habitos").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        }
    }

    @Test void invalidLogValuesReturn400() throws Exception {
        for (String value : List.of("-1", "100001", "null")) {
            mvc("habitos.WeekController").perform(put("/api/v1/habitos/1/log").param("date", "2026-01-01")
                .contentType(MediaType.APPLICATION_JSON).content("{\"value\":" + value + "}"))
                .andExpect(status().isBadRequest());
        }
    }

    @Test void oversizedManualFoodNameReturns400() throws Exception {
        mvc("intake.IntakeController").perform(post("/api/v1/intake/2026-01-01/1")
            .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of(
                "food", "a".repeat(101), "quantity", 1, "unit", "u", "foodGroupId", 1))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isArray());
    }
}
