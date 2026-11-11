package uy.miga.registro;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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

class NoteIntegrationTest extends DailyLogIntegrationTestBase {
    @Test
    void longUnrecognizedMentionSurvivesReload() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        String text = "z".repeat(700);
        putNote(date, text);
        JsonNode item = getDay(date).path("meals").get(0).path("items").get(0);
        assertThat(item.path("food").asText()).isEqualTo(text);
        assertThat(item.path("originalText").asText()).isEqualTo(text);
        assertThat(item.path("portions").isNull()).isTrue();
    }

    @Test
    void mentionsSurviveReloadWithoutPortionsAndUnknownMentionsRejectCorrections() throws Exception {
        createUniqueUserPlan();
        for (String type : java.util.List.of("FLEXIBLE", "NO_CUENTA")) {
            JsonNode rules = planRules();
            mockMvc.perform(post("/api/v1/my-plan/alimentos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of(
                    "planVersion", rules.path("planVersion").asLong(), "alimento", type.toLowerCase(),
                    "sinonimos", java.util.List.of(), "tipo", type))))
                .andExpect(status().isCreated());
        }
        String date = LocalDate.now().toString();
        JsonNode saved = putNote(date, "mate, flexible, no_cuenta, xyzdesconocido");
        assertThat(saved.path("entries").size()).isEqualTo(4);
        JsonNode day = getDay(date);
        JsonNode meal = day.path("meals").get(0);
        assertThat(meal.path("items")).isEqualTo(saved.path("entries"));
        for (JsonNode item : meal.path("items")) {
            assertThat(item.path("foodGroupId").isNull()).isTrue();
            assertThat(item.path("portions").isNull()).isTrue();
            assertThat(item.path("occurrenceId").asText()).isNotBlank();
            assertThat(item.path("origin").asText()).isIn("MENTION", "UNKNOWN");
            if ("MENTION".equals(item.path("origin").asText())) {
                assertThat(item.path("appliedRule").asText()).isNotBlank();
            }
            if ("UNKNOWN".equals(item.path("origin").asText())) {
                patchItem(date, item.path("id").asLong(), "{\"quantity\":2}")
                    .andExpect(status().isBadRequest());
            }
        }
        for (JsonNode group : meal.path("comparison")) {
            assertThat(group.path("recorded").asDouble()).isZero();
        }
        for (JsonNode group : day.path("summary")) {
            assertThat(group.path("totalRecorded").asDouble()).isZero();
        }
        JsonNode week = objectMapper.readTree(mockMvc.perform(get("/api/v1/semana").param("date", date)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        boolean found = false;
        for (JsonNode weekDay : week.path("days")) {
            if (!date.equals(weekDay.path("date").asText())) continue;
            found = true;
            assertThat(weekDay.path("totalRecorded").decimalValue()).isZero();
            assertThat(weekDay.path("meals").get(0).path("flexibleCount").asInt()).isEqualTo(1);
        }
        assertThat(found).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"LIBRE", "NO_CUENTA", "FLEXIBLE"})
    void recognizedMentionsCanBeCorrectedToFlexibleAndBackToGroups(String type) throws Exception {
        createUniqueUserPlan();
        JsonNode rules = planRules();
        String food = type.toLowerCase(java.util.Locale.ROOT);
        mockMvc.perform(post("/api/v1/my-plan/alimentos")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(java.util.Map.of(
                "planVersion", rules.path("planVersion").asLong(), "alimento", food,
                "sinonimos", java.util.List.of(), "tipo", type))))
            .andExpect(status().isCreated());
        String date = LocalDate.now().toString();
        JsonNode item = putNote(date, food).path("entries").get(0);
        assertThat(item.path("origin").asText()).isEqualTo("MENTION");
        assertThat(item.path("ruleType").asText()).isEqualTo(type);
        long id = item.path("id").asLong();
        patchItem(date, id, "{\"flexible\":true}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("FLEXIBLE"))
            .andExpect(jsonPath("$.items[0].ruleType").value("FLEXIBLE"))
            .andExpect(jsonPath("$.items[0].foodGroupId").isEmpty())
            .andExpect(jsonPath("$.items[0].portions").isEmpty());
        long groupId = getDay(date).path("summary").get(0).path("foodGroupId").asLong();
        patchItem(date, id, "{\"foodGroupId\":" + groupId + ",\"portions\":1}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].ruleType").value("NORMAL"))
            .andExpect(jsonPath("$.items[0].foodGroupId").value(groupId))
            .andExpect(jsonPath("$.items[0].portions").value(1));
        JsonNode reloaded = getDay(date).path("meals").get(0).path("items").get(0);
        assertThat(reloaded.path("foodGroupId").asLong()).isEqualTo(groupId);
        assertThat(reloaded.path("portions").asInt()).isEqualTo(1);
    }

    @Test
    void saveNote_withRecognizedFood_returnsInterpretation() throws Exception {
        String date = LocalDate.now().toString();

        MvcResult result = mockMvc.perform(post("/api/v1/registro/" + date + "/" + mealId + "/note")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche, pan, manzana"}
                """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.noteId").isNumber())
            .andExpect(jsonPath("$.items").isArray())
            .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.path("items").size()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void saveNote_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/registro/" + LocalDate.now() + "/" + mealId + "/note")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche"}
                """))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void getNote_afterSave_returnsStoredText() throws Exception {
        String date = LocalDate.now().toString();

        mockMvc.perform(post("/api/v1/registro/" + date + "/" + mealId + "/note")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche"}
                """))
            .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/registro/" + date + "/" + mealId + "/note")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.text").value("leche"));
    }

    @Test
    void getNote_whenNotExists_returns200WithNull() throws Exception {
        mockMvc.perform(get("/api/v1/registro/" + LocalDate.now() + "/99999/note")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
    }

    @Test
    void saveNote_reinterprets_whenUpdated() throws Exception {
        String date = LocalDate.now().toString();
        String url = "/api/v1/registro/" + date + "/" + mealId + "/note";

        mockMvc.perform(post(url)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche"}
                """))
            .andExpect(status().isCreated());

        mockMvc.perform(post(url)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche, manzana"}
                """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.items.length()").value(2));
    }

    @Test
    void noteVersionsRejectStaleClientsAndKeepItemsOnIdenticalText() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode first = putNote(date, "leche");
        JsonNode identical = putNote(date, "leche");
        assertThat(identical.path("version")).isEqualTo(first.path("version"));
        assertThat(identical.path("entries")).isEqualTo(first.path("entries"));
        JsonNode updated = putNote(date, "pan");
        assertThat(updated.path("version").asLong()).isGreaterThan(first.path("version").asLong());
        String url = "/api/v1/registro/" + date + "/comidas/" + mealId + "/nota";
        mockMvc.perform(put(url).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"text\":\"manzana\",\"version\":" + first.path("version").asLong() + "}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("NOTE_CONFLICT"))
            .andExpect(jsonPath("$.error").value(
                "Esta nota cambió en otro dispositivo. Recargá para ver la versión actual."));
        mockMvc.perform(put(url).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"manzana\"}"))
            .andExpect(status().isConflict());
        JsonNode meal = getDay(date).path("meals").get(0);
        assertThat(meal.path("noteText").asText()).isEqualTo("pan");
        assertThat(meal.path("noteVersion")).isEqualTo(updated.path("version"));
    }

    @Test
    void missingNoteRejectsNonNullVersion() throws Exception {
        createUniqueUserPlan();
        mockMvc.perform(put("/api/v1/registro/" + LocalDate.now() + "/comidas/" + mealId + "/nota")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"text\":\"leche\",\"version\":0}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOTE_CONFLICT"));
    }

    @Test
    void deletingNoteClearsTheMealAndRespectsTheVersion() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode before = getDay(date);
        long groupId = before.path("summary").get(0).path("foodGroupId").asLong();
        JsonNode saved = putNote(date, "leche, manzana");
        mockMvc.perform(post("/api/v1/registro/" + date + "/comidas/" + mealId + "/respuestas")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"foodGroupId\":" + groupId + ",\"consumed\":true}"))
            .andExpect(status().isCreated());
        String url = "/api/v1/registro/" + date + "/comidas/" + mealId + "/nota";

        mockMvc.perform(delete(url).header("Authorization", "Bearer " + token))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOTE_CONFLICT"));
        mockMvc.perform(delete(url + "?version=" + (saved.path("version").asLong() + 1))
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isConflict());

        long previousVersion = saved.path("version").asLong();
        long clearedVersion = deleteNoteVersion(url, previousVersion);
        assertThat(clearedVersion).isGreaterThan(previousVersion);
        JsonNode meal = getDay(date).path("meals").get(0);
        assertThat(meal.path("noteText").asText("")).isEmpty();
        assertThat(meal.path("items")).isEmpty();
        assertThat(getDay(date).path("summary")).isEqualTo(before.path("summary"));
        long secondVersion = deleteNoteVersion(url, clearedVersion);
        assertThat(secondVersion).isGreaterThan(clearedVersion);
        for (int attempt = 0; attempt < 2; attempt++) {
            mockMvc.perform(delete(url + "?version=" + previousVersion)
                    .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
            mockMvc.perform(put(url).header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"text\":\"leche\",\"version\":" + previousVersion + "}"))
                .andExpect(status().isConflict());
            if (attempt == 0) {
                mockMvc.perform(put(url).header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"leche\",\"version\":" + secondVersion + "}"))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.entries").isNotEmpty());
            }
        }
    }

    @Test
    void deletingNoteOfAnotherUsersMealIsForbidden() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");
        Long ownerMeal = mealId;
        createUniqueUserPlan();
        mockMvc.perform(delete("/api/v1/registro/" + date + "/comidas/" + ownerMeal + "/nota?version=0")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    void emptyNotesAreNotSuggestedOrCountedAsPlanUsage() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode saved = putNote(date, "leche");
        MealNote note = notes.findById(saved.path("noteId").asLong()).orElseThrow();
        Long planId = note.getPlanId();
        assertThat(registro.planHasNotes(planId)).isTrue();
        deleteNoteVersion("/api/v1/registro/" + date + "/comidas/" + mealId + "/nota", saved.path("version").asLong());
        for (String text : new String[]{"", " \t\n "}) {
            note = notes.findById(note.getId()).orElseThrow();
            note.setText(text);
            notes.saveAndFlush(note);
            assertThat(registro.planHasNotes(planId)).isFalse();
            mockMvc.perform(get("/api/v1/registro/sugerencias?mealId=" + mealId)
                    .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        }
    }

    @Test
    void putNota_isIdempotent() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode first = putNote(date, "leche");
        JsonNode second = putNote(date, "leche");

        assertThat(second.path("noteId").asLong()).isEqualTo(first.path("noteId").asLong());
    }

    @Test
    void putNota_differentText_updatesInterpretation() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        putNote(date, "leche");
        JsonNode updated = putNote(date, "leche, manzana");

        assertThat(updated.path("items").size()).isEqualTo(2);
    }

    @Test
    void putNota_unauthorized_returns403() throws Exception {
        createUniqueUserPlan();
        String tokenB = registerAndLogin("registro-" + java.util.UUID.randomUUID() + "@miga.uy");

        mockMvc.perform(put("/api/v1/registro/" + LocalDate.now() + "/comidas/" + mealId + "/nota")
            .header("Authorization", "Bearer " + tokenB)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche"}
                """))
            .andExpect(status().isForbidden());
    }

    @Test
    void putNota_returnsPersistedEntriesWithRealIds() throws Exception {
        createUniqueUserPlan();
        String date = LocalDate.now().toString();
        JsonNode saved = putNote(date, "leche");

        JsonNode entries = saved.path("entries");
        JsonNode dayItems = getDay(date).path("meals").get(0).path("items");
        assertThat(entries.size()).isEqualTo(dayItems.size()).isGreaterThan(0);
        assertThat(entries.get(0).path("id").asLong()).isEqualTo(dayItems.get(0).path("id").asLong());
        assertThat(entries.get(0).path("occurrenceId").asText()).isNotBlank();
    }

    @Test
    void compoundRule_sharesOccurrenceAndStoresReadableRule() throws Exception {
        createUniqueUserPlan();
        createCompound("barrita sintetica", "Proteínas", "Cereales", "Grasas");
        String date = LocalDate.now().toString();

        JsonNode entries = putNote(date, "1 barrita sintetica").path("entries");

        assertThat(entries.size()).isEqualTo(3);
        assertThat(entries.findValuesAsText("occurrenceId")).containsOnly(entries.get(0).path("occurrenceId").asText());
        assertThat(entries.get(0).path("appliedRule").asText())
            .isEqualTo("1 barrita sintetica = 1 Proteínas + 1 Cereales + 1 Grasas");
        assertThat(getDay(date).path("meals").get(0).path("items").get(0).path("appliedRule").asText())
            .startsWith("1 barrita sintetica =");
    }

    @Test
    void getSugerencias_afterMultipleNotes_returnsTopTexts() throws Exception {
        createUniqueUserPlan();
        for (int dayOffset = 0; dayOffset < 3; dayOffset++) {
            putNote(LocalDate.now().minusDays(dayOffset).toString(), "leche");
        }

        mockMvc.perform(get("/api/v1/registro/sugerencias")
            .param("mealId", mealId.toString())
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
            .andExpect(jsonPath("$[0]").value("leche"));
    }

    @Test
    void twoUserIsolation_cannotPutNotaOnOtherUserMeal() throws Exception {
        createUniqueUserPlan();
        long mealIdA = mealId;
        String tokenB = registerAndLogin("registro-" + UUID.randomUUID() + "@miga.uy");

        mockMvc.perform(put("/api/v1/registro/" + LocalDate.now() + "/comidas/" + mealIdA + "/nota")
            .header("Authorization", "Bearer " + tokenB)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "intento"}
                """))
            .andExpect(status().isForbidden());
    }

    @Test
    void historicalNote_afterPlanChange_preservesOriginalPlanContext() throws Exception {
        createUniqueUserPlan();
        String yesterday = LocalDate.now().minusDays(1).toString();
        String today = LocalDate.now().toString();

        // Guarda nota con plan original (ayer)
        JsonNode firstNote = putNote(yesterday, "leche");
        long noteId = firstNote.path("noteId").asLong();

        // Activa un plan nuevo hoy con estructura diferente
        mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, PLAN_JSON)))
            .andExpect(status().isOk())
            .andReturn();

        // Re-guarda la nota de ayer — debe usar el plan original (el noteId debe ser el mismo)
        MvcResult reNoteResult = mockMvc.perform(put("/api/v1/registro/" + yesterday + "/comidas/" + mealId + "/nota")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"text": "leche", "version": 0}
                """))
            .andExpect(status().isCreated())
            .andReturn();

        JsonNode reNoteJson = objectMapper.readTree(reNoteResult.getResponse().getContentAsString());
        assertThat(reNoteJson.path("noteId").asLong()).isEqualTo(noteId);
    }

    @Test
    void measuredCompoundScalesEveryGroupAndSurvivesReload() throws Exception {
        JsonNode rules = planRules();
        var components = new java.util.ArrayList<java.util.Map<String, Object>>();
        var groupIds = new java.util.ArrayList<Long>();
        for (JsonNode group : rules.path("grupos")) {
            if (!java.util.List.of("Cereales", "Verduras").contains(group.path("name").asText())) continue;
            components.add(java.util.Map.of("groupUid", group.path("uid").asText(), "porciones", 1));
            groupIds.add(group.path("id").asLong());
        }
        assertThat(components).hasSize(2);
        mockMvc.perform(post("/api/v1/my-plan/alimentos")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(java.util.Map.of(
                "planVersion", rules.path("planVersion").asLong(), "alimento", "Tarta",
                "tipo", "COMPUESTO", "cantidadPorPorcion", 150, "unidad", "g", "componentes", components))))
            .andExpect(status().isCreated());
        String date = LocalDate.now().toString();
        JsonNode entries = putNote(date, "200 g de tarta").path("entries");
        assertThat(entries.size()).isEqualTo(2);
        assertThat(entries.findValues("foodGroupId").stream().map(JsonNode::asLong).toList())
            .containsExactlyInAnyOrderElementsOf(groupIds);
        for (JsonNode entry : entries) {
            assertThat(entry.path("portions").decimalValue()).isEqualByComparingTo("1.333");
            assertThat(entry.path("uncertain").asBoolean()).isFalse();
        }
        JsonNode meal = getDay(date).path("meals").get(0);
        assertThat(meal.path("items")).isEqualTo(entries);
        for (JsonNode group : meal.path("comparison")) {
            if (groupIds.contains(group.path("foodGroupId").asLong())) {
                assertThat(group.path("recorded").decimalValue()).isEqualByComparingTo("1.333");
            }
        }
    }
}
