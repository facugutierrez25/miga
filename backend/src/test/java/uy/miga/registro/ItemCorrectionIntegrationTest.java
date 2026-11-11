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

class ItemCorrectionIntegrationTest extends DailyLogIntegrationTestBase {
    @Test
    void responsesAreIdempotentAndCanBeRemoved() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode before = getDay(date);
        long groupId = before.path("summary").get(0).path("foodGroupId").asLong();
        String url = "/api/v1/registro/" + date + "/comidas/" + mealId + "/respuestas";
        String yes = "{\"foodGroupId\":" + groupId + ",\"consumed\":true}";
        mockMvc.perform(post(url).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(yes)).andExpect(status().isCreated());
        JsonNode first = getDay(date);
        mockMvc.perform(post(url).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(yes)).andExpect(status().isCreated());
        JsonNode repeated = getDay(date);
        assertThat(repeated.path("summary")).isEqualTo(first.path("summary"));
        assertThat(repeated.path("meals").get(0).path("items")).hasSize(1);
        assertThat(repeated.path("meals").get(0).path("items").get(0).path("origin").asText())
            .isEqualTo("RESPUESTA");
        assertThat(repeated.path("summary").get(0).path("totalRecorded").decimalValue())
            .isEqualByComparingTo("1");
        mockMvc.perform(post(url).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"foodGroupId\":" + groupId + ",\"consumed\":false}"))
            .andExpect(status().isCreated());
        JsonNode removed = getDay(date);
        assertThat(removed.path("meals").get(0).path("items")).isEmpty();
        assertThat(removed.path("summary")).isEqualTo(before.path("summary"));
    }

    @Test
    void removeMentionPreservesCorrectionAndUpdatesNoteAndExport() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode saved = putNote(date, "leche, manzana");
        long milkId = saved.path("entries").get(0).path("id").asLong();
        long appleId = saved.path("entries").get(1).path("id").asLong();
        mockMvc.perform(patch("/api/v1/registro/" + date + "/items/" + milkId)
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"quantity\":3}" )).andExpect(status().isOk());
        long version = getDay(date).path("meals").get(0).path("noteVersion").asLong();
        JsonNode result = removeItem(date, appleId, version);
        assertThat(result.path("noteText").asText()).isEqualTo("leche");
        assertThat(result.path("noteVersion").asLong()).isGreaterThan(version);
        assertThat(result.path("items").size()).isEqualTo(1);
        assertThat(result.path("items").get(0).path("quantity").asDouble()).isEqualTo(3);
        assertThat(putNote(date, "leche").path("entries")).isEqualTo(result.path("items"));
        String csv = mockMvc.perform(get("/api/v1/semana/export").param("date", date)
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        assertThat(csv).contains("leche").doesNotContain("manzana");
        mockMvc.perform(delete("/api/v1/registro/" + date + "/items/" + milkId).param("version", "-1")
            .header("Authorization", "Bearer " + token)).andExpect(status().isConflict());
        JsonNode empty = removeItem(date, milkId, result.path("noteVersion").asLong());
        assertThat(empty.path("noteText").asText()).isEmpty();
        assertThat(empty.path("items").isEmpty()).isTrue();
    }

    @Test
    void removeCompoundDeletesAllItsGroupsAndRejectsOtherUsers() throws Exception {
        createUniqueUserPlan();
        createCompound("barrita sintetica", "Proteínas", "Cereales", "Grasas");
        String date = LocalDate.now().toString();
        JsonNode saved = putNote(date, "1 barrita sintetica, leche");
        JsonNode result = removeItem(date, saved.path("entries").get(1).path("id").asLong(), saved.path("version").asLong());
        assertThat(result.path("noteText").asText()).isEqualTo("leche");
        assertThat(result.path("items").size()).isEqualTo(1);
        long id = result.path("items").get(0).path("id").asLong();
        createUniqueUserPlan();
        mockMvc.perform(delete("/api/v1/registro/" + date + "/items/" + id).param("version", "0")
            .header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
    }

    @Test
    void removeConnectorMentionAndRepeatedOccurrence() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode saved = putNote(date, "leche con pan y una manzana");
        assertThat(saved.path("entries").size()).isEqualTo(3);
        JsonNode result = removeItem(date, saved.path("entries").get(2).path("id").asLong(), saved.path("version").asLong());
        assertThat(result.path("noteText").asText()).isEqualTo("leche con pan");
        saved = putNote(date, "leche, manzana, leche");
        result = removeItem(date, saved.path("entries").get(2).path("id").asLong(), saved.path("version").asLong());
        assertThat(result.path("noteText").asText()).isEqualTo("leche, manzana");
        assertThat(result.path("items").get(0).path("id")).isEqualTo(saved.path("entries").get(0).path("id"));
        mockMvc.perform(delete("/api/v1/registro/" + LocalDate.now().minusDays(1) + "/items/" + result.path("items").get(0).path("id").asLong())
            .param("version", result.path("noteVersion").asText()).header("Authorization", "Bearer " + token))
            .andExpect(status().isNotFound());
    }

    @Test
    void removeRejectsResponsesAndUnmatchedTextWithoutChanges() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode saved = putNote(date, "leche, manzana");
        long groupId = saved.path("entries").get(0).path("foodGroupId").asLong();
        mockMvc.perform(post("/api/v1/registro/" + date + "/comidas/" + mealId + "/respuestas")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"foodGroupId\":" + groupId + ",\"consumed\":true}"))
            .andExpect(status().isCreated());
        JsonNode before = getDay(date).path("meals").get(0);
        long responseId = before.path("items").get(2).path("id").asLong();
        mockMvc.perform(delete("/api/v1/registro/" + date + "/items/" + responseId)
            .param("version", before.path("noteVersion").asText()).header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
        MealNote note = notes.findById(saved.path("noteId").asLong()).orElseThrow();
        note.setText("leche, pan");
        notes.saveAndFlush(note);
        before = getDay(date).path("meals").get(0);
        mockMvc.perform(delete("/api/v1/registro/" + date + "/items/" + saved.path("entries").get(1).path("id").asLong())
            .param("version", before.path("noteVersion").asText()).header("Authorization", "Bearer " + token))
            .andExpect(status().isUnprocessableEntity());
        assertThat(getDay(date).path("meals").get(0)).isEqualTo(before);
    }

    @Test
    void removingTheLastMentionKeepsResponsesOfTheMeal() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode saved = putNote(date, "leche");
        long groupId = saved.path("entries").get(0).path("foodGroupId").asLong();
        mockMvc.perform(post("/api/v1/registro/" + date + "/comidas/" + mealId + "/respuestas")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"foodGroupId\":" + groupId + ",\"consumed\":true}"))
            .andExpect(status().isCreated());
        JsonNode meal = removeItem(date, saved.path("entries").get(0).path("id").asLong(),
            getDay(date).path("meals").get(0).path("noteVersion").asLong());
        assertThat(meal.path("noteText").asText()).isEmpty();
        assertThat(meal.path("items")).hasSize(1);
        assertThat(meal.path("items").get(0).path("origin").asText()).isEqualTo("RESPUESTA");
    }

    @Test
    void patchItem_updatesQuantityAndGroup() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");
        JsonNode items = getDay(date).path("meals").get(0).path("items");
        assertThat(items.size()).isGreaterThanOrEqualTo(1);
        long itemId = items.get(0).path("id").asLong();

        mockMvc.perform(patch("/api/v1/registro/" + date + "/items/" + itemId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"quantity": 3, "unit": "u", "foodGroupId": null, "portions": null, "saveAsRule": false}
                """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replacedItemIds[0]").value(itemId))
            .andExpect(jsonPath("$.items[0].quantity").value(3))
            .andExpect(jsonPath("$.items[0].origin").value("USUARIO"));
    }

    @Test
    void patchItem_saveAsRule_doesNotThrow() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "huevo");
        JsonNode items = getDay(date).path("meals").get(0).path("items");
        assertThat(items.size()).isGreaterThanOrEqualTo(1);
        JsonNode item = items.get(0);
        assertThat(item.path("foodGroupId").isNumber()).isTrue();

        mockMvc.perform(patch("/api/v1/registro/" + date + "/items/" + item.path("id").asLong())
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"quantity": 1, "unit": "u", "foodGroupId": %d, "portions": 1, "saveAsRule": true}
                """.formatted(item.path("foodGroupId").asLong())))
            .andExpect(status().isOk());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void repeatedCorrectionsAsRuleUseLatestValuesAndBumpRevision(boolean compound) throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode entry = putNote(date, "leche").path("entries").get(0);
        long id = entry.path("id").asLong();
        long revision = planRules().path("planVersion").asLong();
        for (int portions : java.util.List.of(2, 3)) {
            String body = compound
                ? """
                    {"quantity":1,"saveAsRule":true,"grupos":[{"foodGroupId":%d,"porciones":%d},{"foodGroupId":%d,"porciones":1}]}
                    """.formatted(groupId("Proteínas"), portions, groupId("Grasas"))
                : """
                    {"quantity":1,"unit":"u","foodGroupId":%d,"portions":%d,"saveAsRule":true}
                    """.formatted(entry.path("foodGroupId").asLong(), portions);
            JsonNode patched = objectMapper.readTree(patchItem(date, id, body).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
            id = patched.path("items").get(0).path("id").asLong();
            JsonNode rules = planRules();
            assertThat(rules.path("planVersion").asLong()).isGreaterThan(revision);
            revision = rules.path("planVersion").asLong();
            assertThat(rules.path("alimentos").size()).isEqualTo(1);
        }
        JsonNode next = putNote(LocalDate.now().minusDays(1).toString(), "1 leche u").path("entries");
        assertThat(next.size()).isEqualTo(compound ? 2 : 1);
        assertThat(next.findValues("portions").stream().map(JsonNode::asDouble).toList())
            .anySatisfy(portions -> assertThat(portions).isCloseTo(3.0, org.assertj.core.data.Offset.offset(0.01)));
    }

    @Test
    void savingHistoricalCorrectionAsRuleReturnsVersionConflict() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().minusDays(1).toString();
        JsonNode entry = putNote(date, "leche").path("entries").get(0);
        JsonNode rules = planRules();
        mockMvc.perform(post("/api/v1/my-plan/grupos").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(java.util.Map.of("name", "Nuevo", "planVersion", rules.path("planVersion").asLong()))))
            .andExpect(status().isCreated());
        patchItem(date, entry.path("id").asLong(), "{\"saveAsRule\":true}")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"))
            .andExpect(jsonPath("$.error").value("El plan cambió en otra sesión. Recargá para ver la versión actual."));
    }

    @Test
    void patchItem_quantityOnly_rescalesPortions() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode entry = putNote(date, "leche").path("entries").get(0);
        double portions = entry.path("portions").asDouble();

        patchItem(date, entry.path("id").asLong(),
            "{\"quantity\": %s}".formatted(entry.path("quantity").asDouble() * 2))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].portions").value(portions * 2));
    }

    @Test
    void patchItem_withGroups_splitsAndSavesCompoundRule() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode entry = putNote(date, "leche").path("entries").get(0);
        long proteins = groupId("Proteínas");
        long fats = groupId("Grasas");

        patchItem(date, entry.path("id").asLong(), """
            {"quantity": 1, "grupos": [{"foodGroupId": %d, "porciones": 1}, {"foodGroupId": %d, "porciones": 0.5}],
             "saveAsRule": true}
            """.formatted(proteins, fats))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replacedItemIds[0]").value(entry.path("id").asLong()))
            .andExpect(jsonPath("$.items.length()").value(2))
            .andExpect(jsonPath("$.items[0].origin").value("USUARIO"));

        String nextDay = LocalDate.now().minusDays(1).toString();
        JsonNode next = putNote(nextDay, "2 leche").path("entries");
        assertThat(next.size()).isEqualTo(2);
        assertThat(next.findValues("portions").stream().map(JsonNode::asDouble).toList())
            .containsExactlyInAnyOrder(2.0, 1.0);
    }

    @Test
    void patchItem_rejectsWrongDateForeignGroupAndAmbiguousBody() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        long id = putNote(date, "leche").path("entries").get(0).path("id").asLong();

        patchItem(LocalDate.now().minusDays(1).toString(), id, "{\"quantity\": 1}")
            .andExpect(status().isNotFound());
        patchItem(date, id, "{\"foodGroupId\": 999999}")
            .andExpect(status().isBadRequest());
        patchItem(date, id, "{\"quantity\": 0}")
            .andExpect(status().isBadRequest());
        patchItem(date, id, """
            {"foodGroupId": %d, "grupos": [{"foodGroupId": %d, "porciones": 1}, {"foodGroupId": %d, "porciones": 1}]}
            """.formatted(groupId("Grasas"), groupId("Proteínas"), groupId("Grasas")))
            .andExpect(status().isBadRequest());
    }

    @Test
    void saveRespuesta_consumed_createsEntry() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");
        JsonNode before = getDay(date).path("meals").get(0).path("items");
        long foodGroupId = before.isEmpty() ? 1L : before.get(0).path("foodGroupId").asLong();

        mockMvc.perform(post("/api/v1/registro/" + date + "/comidas/" + mealId + "/respuestas")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"foodGroupId": %d, "consumed": true}
                """.formatted(foodGroupId)))
            .andExpect(status().isCreated());

        JsonNode after = getDay(date).path("meals").get(0).path("items");
        assertThat(after.size()).isEqualTo(before.size() + 1);
        assertThat(after).anySatisfy(item -> {
            assertThat(item.path("foodGroupId").asLong()).isEqualTo(foodGroupId);
            assertThat(item.path("origin").asText()).isEqualTo("RESPUESTA");
        });
    }

    @Test
    void saveRespuesta_notConsumed_noEntry() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");
        JsonNode before = getDay(date).path("meals").get(0).path("items");
        long foodGroupId = before.isEmpty() ? 1L : before.get(0).path("foodGroupId").asLong();

        mockMvc.perform(post("/api/v1/registro/" + date + "/comidas/" + mealId + "/respuestas")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"foodGroupId": %d, "consumed": false}
                """.formatted(foodGroupId)))
            .andExpect(status().isCreated());

        JsonNode after = getDay(date).path("meals").get(0).path("items");
        assertThat(after.size()).isEqualTo(before.size());
    }

    @Test
    void twoUserIsolation_cannotPatchOtherUserItem() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");
        JsonNode items = getDay(date).path("meals").get(0).path("items");
        assertThat(items.size()).isGreaterThanOrEqualTo(1);
        long itemId = items.get(0).path("id").asLong();
        String tokenB = registerAndLogin("registro-" + java.util.UUID.randomUUID() + "@miga.uy");

        mockMvc.perform(patch("/api/v1/registro/" + date + "/items/" + itemId)
            .header("Authorization", "Bearer " + tokenB)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"quantity": 3, "unit": "u", "foodGroupId": null, "portions": null, "saveAsRule": false}
                """))
            .andExpect(status().isNotFound());
    }

    @Test
    void twoUserIsolation_cannotSaveRespuestaOnOtherUserMeal() throws Exception {
        createUniqueUserPlan();
        long mealIdA = mealId;
        String tokenB = registerAndLogin("registro-" + UUID.randomUUID() + "@miga.uy");

        mockMvc.perform(post("/api/v1/registro/" + LocalDate.now() + "/comidas/" + mealIdA + "/respuestas")
            .header("Authorization", "Bearer " + tokenB)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"foodGroupId": 1, "consumed": true}
                """))
            .andExpect(status().isForbidden());
    }
    @Test
    void compoundOccurrenceBecomesOneFlexibleEntryAndReturnsToOneGroup() throws Exception {
        createUniqueUserPlan();
        createCompound("Sticks de pollo", "Proteínas", "Grasas", "Cereales");
        String date = LocalDate.now().toString();
        JsonNode original = putNote(date, "Sticks de pollo").path("entries");
        assertThat(original).hasSize(3);
        assertThat(original).allSatisfy(item -> {
            assertThat(item.path("ruleType").asText()).isEqualTo("COMPUESTO");
            assertThat(item.path("ruleSource").asText()).isEqualTo("USUARIO");
        });
        var originalIds = new java.util.ArrayList<Long>();
        original.forEach(item -> originalIds.add(item.path("id").asLong()));
        long selectedId = original.get(1).path("id").asLong();
        JsonNode corrected = objectMapper.readTree(patchItem(date, selectedId, "{\"flexible\":true}")
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        var replacedIds = new java.util.ArrayList<Long>();
        corrected.path("replacedItemIds").forEach(id -> replacedIds.add(id.asLong()));
        assertThat(replacedIds).containsExactlyElementsOf(originalIds);
        assertThat(corrected.path("items")).hasSize(1);
        assertThat(corrected.path("items").get(0).path("id").asLong()).isEqualTo(selectedId);
        JsonNode day = getDay(date);
        JsonNode meal = day.path("meals").get(0);
        assertThat(meal.path("items")).isEqualTo(corrected.path("items"));
        assertThat(meal.path("status").asText()).isEqualTo("FLEXIBLE");
        assertThat(meal.path("comparison")).allSatisfy(group ->
            assertThat(group.path("recorded").asDouble()).isZero());
        assertThat(day.path("summary")).allSatisfy(group ->
            assertThat(group.path("totalRecorded").asDouble()).isZero());
        JsonNode week = objectMapper.readTree(mockMvc.perform(get("/api/v1/semana").param("date", date)
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        assertThat(week.path("days")).anySatisfy(weekDay -> {
            assertThat(weekDay.path("date").asText()).isEqualTo(date);
            assertThat(weekDay.path("meals").get(0).path("flexibleCount").asInt()).isEqualTo(1);
        });
        long proteinId = groupId("Proteínas");
        patchItem(date, selectedId, "{\"foodGroupId\":" + proteinId + ",\"portions\":2}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.replacedItemIds[0]").value(selectedId))
            .andExpect(jsonPath("$.items[0].ruleType").value("NORMAL"));
        day = getDay(date);
        meal = day.path("meals").get(0);
        assertThat(meal.path("items")).hasSize(1);
        assertThat(meal.path("items").get(0).path("occurrenceId")).isEqualTo(original.get(0).path("occurrenceId"));
        assertThat(meal.path("status").asText()).isNotEqualTo("FLEXIBLE");
        for (JsonNode group : day.path("summary")) {
            assertThat(group.path("totalRecorded").asDouble())
                .isEqualTo(group.path("foodGroupId").asLong() == proteinId ? 2 : 0);
        }
    }

    @Test
    void flexibleCorrectionCanBeSavedAndCorrectedBack() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode saved = putNote(date, "leche");
        JsonNode entry = saved.path("entries").get(0);
        long id = entry.path("id").asLong();
        long groupId = entry.path("foodGroupId").asLong();
        String url = "/api/v1/registro/" + date + "/items/" + id;
        mockMvc.perform(patch(url).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"flexible": true, "saveAsRule": true}
                """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("FLEXIBLE"))
            .andExpect(jsonPath("$.items[0].ruleType").value("FLEXIBLE"))
            .andExpect(jsonPath("$.items[0].foodGroupId").isEmpty())
            .andExpect(jsonPath("$.items[0].portions").isEmpty());
        JsonNode week = objectMapper.readTree(mockMvc.perform(get("/api/v1/semana").param("date", date)
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        assertThat(week.path("days")).anySatisfy(day -> {
            assertThat(day.path("date").asText()).isEqualTo(date);
            assertThat(day.path("meals").get(0).path("status").asText()).isEqualTo("FLEXIBLE");
            assertThat(day.path("meals").get(0).path("flexibleCount").asInt()).isEqualTo(1);
        });
        String exported = mockMvc.perform(get("/api/v1/semana/export").param("date", date)
            .param("format", "csv").param("incluir", "porciones")
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("text/csv"))
            .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(exported).contains("Flexible");
        assertThat(putNote(date, "leche").path("entries").get(0).path("ruleType").asText())
            .isEqualTo("FLEXIBLE");
        id = getDay(date).path("meals").get(0).path("items").get(0).path("id").asLong();
        mockMvc.perform(patch("/api/v1/registro/" + date + "/items/" + id)
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"foodGroupId\":" + groupId + ",\"portions\":1,\"saveAsRule\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].foodGroupId").value(groupId))
            .andExpect(jsonPath("$.items[0].portions").value(1));
        assertThat(getDay(date).path("meals").get(0).path("status").asText()).isNotEqualTo("FLEXIBLE");
    }
}
