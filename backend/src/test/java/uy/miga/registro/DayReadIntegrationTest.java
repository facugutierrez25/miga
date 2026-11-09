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

class DayReadIntegrationTest extends DailyLogIntegrationTestBase {
    @Test
    void dayAndWeekShareEveryMealStatus() throws Exception {
        String date = LocalDate.now().toString();
        assertDayAndWeekStatuses(date);
        var saved = putNote(date, "leche");
        assertThat(saved.path("status").asText()).isEqualTo(getDay(date).path("meals").get(0).path("status").asText());
        assertDayAndWeekStatuses(date);
    }

    @Test
    void flexibleFoodWinsWithoutAFlexibleCountingHabit() throws Exception {
        String date = LocalDate.now().toString();
        var habits = objectMapper.readTree(mockMvc.perform(get("/api/v1/habitos")
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        for (JsonNode habit : habits) assertThat(habit.path("countsFlexibleMeals").asBoolean()).isFalse();
        var saved = putNote(date, "zqxflexible");
        var resolved = resolve(date, saved.path("entries").get(0).path("id").asLong(),
            "{\"kind\":\"FLEXIBLE\",\"remember\":false}");
        assertThat(resolved.path("status").asText()).isEqualTo("FLEXIBLE");
        assertThat(getDay(date).path("meals").get(0).path("status").asText()).isEqualTo("FLEXIBLE");
        assertDayAndWeekStatuses(date);
        var restored = undo(date, resolved.path("undo"));
        assertThat(restored.path("status").asText()).isNotEqualTo("FLEXIBLE");
        assertDayAndWeekStatuses(date);
    }

    @Test
    void oneGroupShortAndAnotherOverReturnsMixedAfterCorrection() throws Exception {
        String date = LocalDate.now().toString();
        var saved = putNote(date, "leche");
        patchItem(date, saved.path("entries").get(0).path("id").asLong(), "{\"portions\":10}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("MIXED"));
        assertThat(getDay(date).path("meals").get(0).path("status").asText()).isEqualTo("MIXED");
        assertDayAndWeekStatuses(date);
    }

    @Test
    void mealsWithoutPlanPortionsAreUnplannedInTheWeek() throws Exception {
        mockMvc.perform(put("/api/v1/my-plan").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token,
                "{\"meals\":[{\"name\":\"Desayuno\",\"suggestedTime\":\"08:00:00\",\"displayOrder\":1,"
                    + "\"portions\":[{\"foodGroupAbbr\":\"PRO\",\"portions\":1.0}]},"
                    + "{\"name\":\"Extra\",\"displayOrder\":2,\"portions\":[{\"foodGroupAbbr\":\"PRO\",\"portions\":0.0}]}]}")))
            .andExpect(status().isOk());
        String date = LocalDate.now().toString();
        int checked = 0;
        for (JsonNode day : getWeek(date).path("days")) {
            for (JsonNode meal : day.path("meals")) {
                assertThat(meal.path("planned").asBoolean()).isEqualTo(!"Extra".equals(meal.path("name").asText()));
                checked++;
            }
        }
        assertThat(checked).isPositive();
        assertDayAndWeekStatuses(date);
    }

    @Test
    void answersReturnTheUpdatedMealStatus() throws Exception {
        String date = LocalDate.now().toString();
        var saved = putNote(date, "leche");
        long groupId = saved.path("comparison").get(0).path("foodGroupId").asLong();
        for (boolean consumed : java.util.List.of(true, false)) {
            var response = objectMapper.readTree(mockMvc.perform(post("/api/v1/registro/" + date + "/comidas/" + mealId + "/respuestas")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"foodGroupId\":" + groupId + ",\"consumed\":" + consumed + "}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
            assertThat(response).isEqualTo(getDay(date).path("meals").get(0));
            assertDayAndWeekStatuses(date);
        }
    }

    private JsonNode getWeek(String date) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get("/api/v1/semana").param("date", date)
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
    }

    private void assertDayAndWeekStatuses(String date) throws Exception {
        JsonNode meals = getDay(date).path("meals");
        assertThat(meals).isNotEmpty();
        JsonNode weekDay = null;
        for (JsonNode day : getWeek(date).path("days")) if (date.equals(day.path("date").asText())) weekDay = day;
        assertThat(weekDay).isNotNull();
        for (JsonNode meal : meals) {
            assertThat(meal.path("status").asText()).isIn("EN_PLAN", "CASI", "DE_MAS", "MIXED", "PREGUNTAR",
                "REGISTRADA", "SIN_ANOTAR", "FLEXIBLE");
            JsonNode weekMeal = null;
            for (JsonNode candidate : weekDay.path("meals")) {
                if (candidate.path("mealId").equals(meal.path("mealId"))) weekMeal = candidate;
            }
            assertThat(weekMeal).isNotNull();
            assertThat(weekMeal.path("status")).isEqualTo(meal.path("status"));
        }
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
