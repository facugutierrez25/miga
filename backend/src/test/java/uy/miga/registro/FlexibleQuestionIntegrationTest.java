package uy.miga.registro;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class FlexibleQuestionIntegrationTest extends DailyLogIntegrationTestBase {
    @Test
    void yesResolvesBothPreexistingNotesAndCountsBothInWeek() throws Exception {
        resolvePreexistingNotes(true);
    }

    @Test
    void noResolvesBothPreexistingNotesAndKeepsCatalogPortions() throws Exception {
        resolvePreexistingNotes(false);
    }

    private void resolvePreexistingNotes(boolean flexible) throws Exception {
        LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);
        String firstDate = monday.toString();
        String secondDate = monday.plusDays(1).toString();
        JsonNode first = putNote(firstDate, "60 g jamón").path("entries").get(0);
        JsonNode second = putNote(secondDate, "120 g jamón").path("entries").get(0);
        assertThat(first.path("ruleType").asText()).isEqualTo("PREGUNTAR");
        assertThat(second.path("ruleType").asText()).isEqualTo("PREGUNTAR");

        JsonNode firstResult = answer(firstDate, first.path("id").asLong(), flexible);
        JsonNode savedRules = planRules();
        JsonNode pending = getDay(secondDate).path("meals").get(0).path("items").get(0);
        assertThat(pending.path("id")).isEqualTo(second.path("id"));
        assertThat(pending.path("ruleType").asText()).isEqualTo("PREGUNTAR");
        assertThat(pending.path("ruleSource").asText()).isEqualTo("CATALOGO");

        JsonNode secondResult = answer(secondDate, second.path("id").asLong(), flexible);
        assertThat(planRules()).isEqualTo(savedRules);
        String expectedType = "NORMAL";
        assertThat(firstResult.path("items").get(0).path("ruleType").asText()).isEqualTo(expectedType);
        JsonNode resolved = secondResult.path("items").get(0);
        assertThat(resolved.path("ruleType").asText()).isEqualTo(expectedType);
        assertThat(resolved.path("ruleSource").asText()).isEqualTo("USUARIO");
        {
            assertThat(resolved.path("countsFlexible").asBoolean()).isEqualTo(flexible);
            assertThat(resolved.path("foodGroupId")).isEqualTo(second.path("foodGroupId"));
            assertThat(resolved.path("portions").asDouble()).isEqualTo(2);
        }

        assertThat(firstResult.path("items").get(0).path("foodGroupId")).isEqualTo(first.path("foodGroupId"));
        assertThat(firstResult.path("items").get(0).path("portions").asDouble()).isEqualTo(1);
        JsonNode week = objectMapper.readTree(mockMvc.perform(get("/api/v1/semana").param("date", firstDate)
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        int flexibleCount = 0;
        for (JsonNode day : week.path("days")) {
            if (java.util.List.of(firstDate, secondDate).contains(day.path("date").asText())) {
                int count = day.path("meals").get(0).path("flexibleCount").asInt();
                assertThat(count).isEqualTo(flexible ? 1 : 0);
                flexibleCount += count;
            }
        }
        assertThat(flexibleCount).isEqualTo(flexible ? 2 : 0);
    }

    @Test
    void yesCreatesFlexibleRuleAndCountsInWeek() throws Exception {
        String date = LocalDate.now().toString();
        JsonNode note = putNote(date, "60 g jamón");
        assertThat(note.path("status").asText()).isEqualTo("PREGUNTAR");
        JsonNode result = answer(date, note.path("entries").get(0).path("id").asLong(), true);
        assertThat(result.path("status").asText()).isEqualTo("FLEXIBLE");
        assertThat(result.path("items").get(0).path("ruleType").asText()).isEqualTo("NORMAL");
        assertThat(planRules().toString()).contains("jamon cocido", "countsFlexible");
        JsonNode item = result.path("items").get(0);
        assertThat(item.path("countsFlexible").asBoolean()).isTrue();
        assertThat(item.path("portions").asDouble()).isEqualTo(1);
        assertThat(getDay(date).path("summary")).anySatisfy(group -> {
            assertThat(group.path("foodGroupId")).isEqualTo(item.path("foodGroupId"));
            assertThat(group.path("totalRecorded").asDouble()).isEqualTo(1);
        });
        assertThat(putNote(LocalDate.now().minusDays(1).toString(), "60 g jamón").path("status").asText())
            .isEqualTo("FLEXIBLE");
        JsonNode week = objectMapper.readTree(mockMvc.perform(get("/api/v1/semana").param("date", date)
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        assertThat(week.path("days")).anySatisfy(day -> {
            assertThat(day.path("date").asText()).isEqualTo(date);
            assertThat(day.path("meals").get(0).path("flexibleCount").asInt()).isEqualTo(1);
        });
    }

    @Test
    void noCopiesCatalogClassificationAndDoesNotAskAgain() throws Exception {
        String date = LocalDate.now().toString();
        JsonNode original = putNote(date, "60 g jamón").path("entries").get(0);
        JsonNode result = answer(date, original.path("id").asLong(), false);
        JsonNode item = result.path("items").get(0);
        assertThat(item.path("foodGroupId")).isEqualTo(original.path("foodGroupId"));
        assertThat(item.path("portions")).isEqualTo(original.path("portions"));
        assertThat(item.path("ruleType").asText()).isEqualTo("NORMAL");
        assertThat(item.path("ruleSource").asText()).isEqualTo("USUARIO");
        JsonNode next = putNote(LocalDate.now().minusDays(1).toString(), "120 g jamón");
        assertThat(next.path("entries").get(0).path("ruleType").asText()).isEqualTo("NORMAL");
        assertThat(next.path("entries").get(0).path("portions").asDouble()).isEqualTo(2);
    }

    @Test
    void planClassificationSuppressesCatalogQuestion() throws Exception {
        long planId = planRules().path("planId").asLong();
        long groupId = planRules().path("grupos").get(0).path("id").asLong();
        jdbc.update("INSERT INTO food_rules(alcance, plan_id, alimento, tipo, food_group_id, porcion_por_defecto) VALUES ('PLAN', ?, 'jamón', 'NORMAL', ?, 1)",
            planId, groupId);
        JsonNode item = putNote(LocalDate.now().toString(), "jamón").path("entries").get(0);
        assertThat(item.path("ruleType").asText()).isEqualTo("NORMAL");
        assertThat(item.path("ruleSource").asText()).isEqualTo("PLAN");
    }

    private JsonNode answer(String date, long id, boolean flexible) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/v1/registro/" + date + "/items/" + id + "/flexible")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"flexible\":" + flexible + "}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
}
