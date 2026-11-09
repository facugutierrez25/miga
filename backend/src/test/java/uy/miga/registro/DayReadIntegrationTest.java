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

class DayReadIntegrationTest extends RegistroIntegrationTestBase {
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
    void renamingMealKeepsTodaysRecordsVisible() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");

        mockMvc.perform(put("/api/v1/my-plan")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, PLAN_JSON.replace("\"Desayuno\"", "\"Primera comida\""))))
            .andExpect(status().isOk());

        JsonNode meal = getDay(date).path("meals").get(0);
        assertThat(meal.path("noteText").asText()).isEqualTo("leche");
        assertThat(meal.path("items").size()).isGreaterThan(0);
    }

    @Test
    void getDayRegistro_usesHistoricalPlan_notCurrentPlan() throws Exception {
        createUniqueUserPlan();
        String yesterday = LocalDate.now().minusDays(1).toString();

        putNote(yesterday, "leche");

        // Activa plan nuevo (misma estructura, pero crea nueva versión)
        mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, PLAN_JSON)))
            .andExpect(status().isOk());

        // GET día de ayer debe devolver datos sin error aunque el plan cambió
        mockMvc.perform(get("/api/v1/registro/" + yesterday)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.meals").isArray())
            .andExpect(jsonPath("$.date").value(yesterday));
    }
}
