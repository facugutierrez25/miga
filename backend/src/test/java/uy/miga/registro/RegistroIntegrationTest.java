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

@SpringBootTest(classes = MigaApplication.class, webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class RegistroIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private FilterChainProxy springSecurityFilterChain;
    @Autowired private MockEmailService mockEmailService;
    @Autowired private EmailOutboxWorker outboxWorker;
    @Autowired private MealNoteRepository notes;
    @Autowired private RegistroService registro;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbc;

    @Test
    void resolveGroupsRemembersInPlaceAndUndoRestoresUnknown() throws Exception {
        String date = LocalDate.now().toString();
        JsonNode rules = planRules();
        long group = rules.path("grupos").get(0).path("id").asLong();
        JsonNode before = putNote(date, "200 g zqxalimento");
        JsonNode original = before.path("entries").get(0);
        JsonNode resolved = resolve(date, original.path("id").asLong(), """
            {"kind":"GROUPS","groups":[{"foodGroupId":%d,"portions":2}],"remember":true}
            """.formatted(group));
        JsonNode item = resolved.path("items").get(0);
        assertThat(item.path("quantity").asDouble()).isEqualTo(200);
        assertThat(item.path("unit").asText()).isEqualTo("g");
        assertThat(item.path("portions").asDouble()).isEqualTo(2);
        assertThat(item.path("occurrenceId")).isEqualTo(original.path("occurrenceId"));
        JsonNode meal = getDay(date).path("meals").get(0);
        assertThat(meal.path("items")).hasSize(1);
        assertThat(meal.path("items").get(0).path("id")).isEqualTo(item.path("id"));
        assertThat(meal.path("items").get(0).path("portions").asDouble()).isEqualTo(2);
        assertThat(meal.path("noteVersion").asLong()).isEqualTo(before.path("version").asLong());
        assertThat(planRules().path("planId")).isEqualTo(rules.path("planId"));
        assertThat(planRules().toString()).contains("zqxalimento");
        JsonNode next = putNote(LocalDate.now().minusDays(1).toString(), "100 g zqxalimento").path("entries").get(0);
        assertThat(next.path("portions").asDouble()).isEqualTo(1);
        mockMvc.perform(post("/api/v1/registro/" + date + "/items/resolve/undo")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content(resolved.path("undo").toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].origin").value("UNKNOWN"));
        JsonNode restored = getDay(date).path("meals").get(0).path("items").get(0);
        for (String field : java.util.List.of("food", "quantity", "unit", "originalText", "occurrenceId")) {
            assertThat(restored.path(field)).isEqualTo(original.path(field));
        }
        assertThat(planRules().toString()).doesNotContain("zqxalimento");
    }

    @Test
    void resolveMentionsWithoutRememberAndFlexibleWeekCount() throws Exception {
        String date = LocalDate.now().toString();
        JsonNode rules = planRules();
        JsonNode entries = putNote(date, "zqxflexible, zqxnocuenta").path("entries");
        for (int i = 0; i < 2; i++) {
            JsonNode resolved = resolve(date, entries.get(i).path("id").asLong(),
                "{\"kind\":\"" + (i == 0 ? "FLEXIBLE" : "NOT_COUNTED") + "\",\"remember\":false}");
            assertThat(resolved.path("undo").path("ruleUid").isNull()).isTrue();
            JsonNode item = resolved.path("items").get(0);
            assertThat(item.path("origin").asText()).isEqualTo("MENTION");
            assertThat(item.path("portions").isNull()).isTrue();
            assertThat(item.path("foodGroupId").isNull()).isTrue();
            assertThat(item.path("ruleSource").asText()).isEqualTo("USUARIO");
            mockMvc.perform(post("/api/v1/registro/" + date + "/items/" + item.path("id").asLong() + "/resolve")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\":\"FLEXIBLE\"}"))
                .andExpect(status().isBadRequest());
        }
        assertThat(planRules()).isEqualTo(rules);
        JsonNode week = objectMapper.readTree(mockMvc.perform(get("/api/v1/semana").param("date", date)
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        assertThat(week.path("days")).anySatisfy(day -> {
            assertThat(day.path("date").asText()).isEqualTo(date);
            assertThat(day.path("meals").get(0).path("flexibleCount").asInt()).isEqualTo(1);
        });
    }

    @Test
    void resolveSameAsSyntheticGlobalAndCompoundRules() throws Exception {
        String date = LocalDate.now().toString();
        JsonNode groups = planRules().path("grupos");
        UUID globalUid = UUID.randomUUID();
        jdbc.update("INSERT INTO food_rules(uid, alcance, alimento, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto) VALUES (?, 'GLOBAL', ?, 'NORMAL', ?, 50, 'g', 1)",
            globalUid, "catalogosintetico" + globalUid, groups.get(0).path("clave").asText());
        long id = putNote(date, "200 g zqxcatalogo").path("entries").get(0).path("id").asLong();
        JsonNode result = resolve(date, id, "{\"kind\":\"SAME_AS\",\"ruleUid\":\"" + globalUid + "\",\"remember\":true}");
        assertThat(result.path("items").get(0).path("portions").asDouble()).isEqualTo(4);
        assertThat(result.path("undo").path("ruleUid").isNull()).isFalse();
        createCompound("compuestosintetico", "Cereales", "Grasas");
        UUID compoundUid = jdbc.queryForObject("SELECT uid FROM food_rules WHERE alimento = ? AND plan_id = ?", UUID.class,
            "compuestosintetico", planRules().path("planId").asLong());
        String otherDate = LocalDate.now().minusDays(1).toString();
        id = putNote(otherDate, "2 zqxcompuesto").path("entries").get(0).path("id").asLong();
        result = resolve(otherDate, id, "{\"kind\":\"SAME_AS\",\"ruleUid\":\"" + compoundUid + "\"}");
        assertThat(result.path("items")).hasSize(2);
        for (JsonNode item : result.path("items")) assertThat(item.path("portions").asDouble()).isEqualTo(2);
        assertThat(getDay(otherDate).path("meals").get(0).path("items")).isEqualTo(result.path("items"));
    }

    @Test
    void resolveRejectsInvalidGroupsAndOtherUsersItems() throws Exception {
        String date = LocalDate.now().toString();
        long id = putNote(date, "zqxvalidacion").path("entries").get(0).path("id").asLong();
        long group = planRules().path("grupos").get(0).path("id").asLong();
        for (String body : java.util.List.of("{\"kind\":\"GROUPS\"}", "{\"kind\":\"SAME_AS\"}",
                "{\"kind\":\"GROUPS\",\"groups\":[]}",
                "{\"kind\":\"GROUPS\",\"groups\":[{\"foodGroupId\":9999999,\"portions\":1}]}",
                "{\"kind\":\"GROUPS\",\"groups\":[{\"foodGroupId\":" + group + ",\"portions\":0}]}",
                "{\"kind\":\"GROUPS\",\"groups\":[{\"foodGroupId\":" + group + ",\"portions\":1},{\"foodGroupId\":" + group + ",\"portions\":1}]}")) {
            mockMvc.perform(post("/api/v1/registro/" + date + "/items/" + id + "/resolve")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        }
        String other = registerAndLogin("resolve-" + UUID.randomUUID() + "@miga.uy");
        mockMvc.perform(post("/api/v1/registro/" + date + "/items/" + id + "/resolve")
            .header("Authorization", "Bearer " + other).contentType(MediaType.APPLICATION_JSON).content("{\"kind\":\"FLEXIBLE\"}"))
            .andExpect(status().isNotFound());
    }

    @Test
    void undoPreservesExistingNormalizedUserRule() throws Exception {
        // Una nota de ayer: crear alimentos reinterpreta solo las de hoy.
        String date = LocalDate.now().minusDays(1).toString();
        long id = putNote(date, "zqxalimento").path("entries").get(0).path("id").asLong();
        createCompound("  ZQXALIMÉNTO  ", "Cereales", "Grasas");
        JsonNode before = planRules();
        long group = before.path("grupos").get(0).path("id").asLong();
        JsonNode result = resolve(date, id, """
            {"kind":"GROUPS","groups":[{"foodGroupId":%d,"portions":2}],"remember":true}
            """.formatted(group));
        assertThat(result.path("undo").path("ruleUid").isNull()).isTrue();
        assertThat(planRules()).isEqualTo(before);
        undo(date, result.path("undo"));
        assertThat(planRules()).isEqualTo(before);
    }

    @Test
    void oldUndoAfterResolutionWithoutRememberPreservesRules() throws Exception {
        // Una nota de ayer: crear alimentos reinterpreta solo las de hoy.
        String date = LocalDate.now().minusDays(1).toString();
        long id = putNote(date, "zqxalimento").path("entries").get(0).path("id").asLong();
        JsonNode first = resolve(date, id, "{\"kind\":\"FLEXIBLE\",\"remember\":true}");
        JsonNode restored = undo(date, first.path("undo"));
        resolve(date, restored.path("items").get(0).path("id").asLong(),
            "{\"kind\":\"NOT_COUNTED\",\"remember\":false}");
        createCompound("regla ajena", "Cereales", "Grasas");
        JsonNode before = planRules();
        undo(date, first.path("undo"));
        assertThat(planRules()).isEqualTo(before);
    }

    @Test
    void undoIgnoresClientRuleUidAndDeletesOnlyCreatedRule() throws Exception {
        String date = LocalDate.now().toString();
        createCompound("regla ajena", "Cereales", "Grasas");
        UUID otherUid = jdbc.queryForObject("SELECT uid FROM food_rules WHERE alimento = ? AND plan_id = ?",
            UUID.class, "regla ajena", planRules().path("planId").asLong());
        long id = putNote(date, "zqxalimento").path("entries").get(0).path("id").asLong();
        JsonNode result = resolve(date, id, "{\"kind\":\"FLEXIBLE\",\"remember\":true}");
        var forged = result.path("undo").deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) forged).put("ruleUid", otherUid.toString());
        undo(date, forged);
        assertThat(planRules().toString()).contains("regla ajena").doesNotContain("zqxalimento");
    }

    @Test
    void bareGroupsRememberedRuleRoundTrips() throws Exception {
        String date = LocalDate.now().toString();
        long group = planRules().path("grupos").get(0).path("id").asLong();
        JsonNode original = putNote(date, "zqxalimento").path("entries").get(0);
        assertThat(original.path("unit").isNull()).isTrue();
        resolve(date, original.path("id").asLong(), """
            {"kind":"GROUPS","groups":[{"foodGroupId":%d,"portions":2}],"remember":true}
            """.formatted(group));
        JsonNode next = putNote(LocalDate.now().minusDays(1).toString(), "zqxalimento").path("entries").get(0);
        assertThat(next.path("portions").asDouble()).isEqualTo(2);
    }

    @Test
    void bareCompoundRememberedRuleRoundTrips() throws Exception {
        String date = LocalDate.now().toString();
        JsonNode groups = planRules().path("grupos");
        long id = putNote(date, "zqxalimento").path("entries").get(0).path("id").asLong();
        resolve(date, id, """
            {"kind":"GROUPS","groups":[{"foodGroupId":%d,"portions":2},{"foodGroupId":%d,"portions":0.5}],"remember":true}
            """.formatted(groups.get(0).path("id").asLong(), groups.get(1).path("id").asLong()));
        JsonNode next = putNote(LocalDate.now().minusDays(1).toString(), "zqxalimento").path("entries");
        assertThat(next).hasSize(2);
        assertThat(next.findValues("portions").stream().map(JsonNode::asDouble).toList())
            .containsExactlyInAnyOrder(2.0, 0.5);
    }

    private JsonNode undo(String date, JsonNode body) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/v1/registro/" + date + "/items/resolve/undo")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body.toString()))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode resolve(String date, long id, String body) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/v1/registro/" + date + "/items/" + id + "/resolve")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    void resolveRemembersCompoundAndMentionKindsForFutureNotes() throws Exception {
        String date = LocalDate.now().toString();
        JsonNode groups = planRules().path("grupos");
        for (String kind : java.util.List.of("GROUPS", "FLEXIBLE", "NOT_COUNTED")) {
            String food = "zqx" + kind.toLowerCase();
            long id = putNote(date, "2 " + food).path("entries").get(0).path("id").asLong();
            String body = "{\"kind\":\"" + kind + "\",\"remember\":true";
            if ("GROUPS".equals(kind)) {
                body += ",\"groups\":[{\"foodGroupId\":" + groups.get(0).path("id").asLong()
                    + ",\"portions\":2},{\"foodGroupId\":" + groups.get(1).path("id").asLong() + ",\"portions\":1}]";
            }
            JsonNode result = resolve(date, id, body + "}");
            assertThat(result.path("undo").path("ruleUid").isNull()).isFalse();
            JsonNode next = putNote(LocalDate.now().minusDays(1).toString(), "4 " + food).path("entries");
            if ("GROUPS".equals(kind)) {
                assertThat(next).hasSize(2);
                assertThat(next.findValues("portions").stream().map(JsonNode::asDouble).toList()).containsExactlyInAnyOrder(4.0, 2.0);
                assertThat(getDay(date).path("meals").get(0).path("comparison"))
                    .anySatisfy(g -> assertThat(g.path("recorded").asDouble()).isEqualTo(2));
            } else {
                assertThat(next.get(0).path("origin").asText()).isEqualTo("MENTION");
                assertThat(next.get(0).path("ruleType").asText()).isEqualTo("FLEXIBLE".equals(kind) ? "FLEXIBLE" : "NO_CUENTA");
            }
        }
    }

    private final ObjectMapper objectMapper = new ObjectMapper()
        .findAndRegisterModules();
    private MockMvc mockMvc;
    private String token;
    private Long mealId;

    private static final String PLAN_JSON = """
        {
          "meals": [
            {
              "name": "Desayuno",
              "suggestedTime": "08:00:00",
              "displayOrder": 1,
              "portions": [
                { "foodGroupAbbr": "PRO", "portions": 1.0 },
                { "foodGroupAbbr": "CER", "portions": 2.0 },
                { "foodGroupAbbr": "FRU", "portions": 1.0 },
                { "foodGroupAbbr": "LAC", "portions": 1.0 },
                { "foodGroupAbbr": "GRA", "portions": 0.5 },
                { "foodGroupAbbr": "VER", "portions": 0.0 }
              ]
            }
          ]
        }
        """;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
            .addFilters(springSecurityFilterChain)
            .build();
        mockEmailService.reset();
        token = registerAndLogin("registro-" + java.util.UUID.randomUUID() + "@miga.uy");

        MvcResult planResult = mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, PLAN_JSON)))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode plan = objectMapper.readTree(planResult.getResponse().getContentAsString());
        mealId = plan.path("meals").get(0).path("id").asLong();
    }

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
    void mentionsSurviveReloadWithoutAddingPortions() throws Exception {
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
            patchItem(date, item.path("id").asLong(), "{\"quantity\":2}")
                .andExpect(status().isBadRequest());
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

    private long deleteNoteVersion(String url, long version) throws Exception {
        var result = mockMvc.perform(delete(url + "?version=" + version)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("version").asLong();
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

    private String registerAndLogin(String email) throws Exception {
        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    { "email": "%s", "password": "Segura1234!" }
                    """.formatted(email)))
            .andExpect(status().isCreated());

        outboxWorker.processJobs();
        String verifyToken = mockEmailService.tokenAfterProcessing(outboxWorker, email);
        assertThat(verifyToken).isNotBlank();
        mockMvc.perform(get("/api/v1/auth/verify?token=" + verifyToken))
            .andExpect(status().isOk());

        MvcResult result = mockMvc.perform(post("/api/v1/users/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "email": "%s", "password": "Segura1234!" }
                """.formatted(email)))
            .andExpect(status().isOk())
            .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString())
            .get("token").asText();
    }

    private void createUniqueUserPlan() throws Exception {
        token = registerAndLogin("registro-" + java.util.UUID.randomUUID() + "@miga.uy");
        MvcResult result = mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, PLAN_JSON)))
            .andExpect(status().isOk())
            .andReturn();
        mealId = objectMapper.readTree(result.getResponse().getContentAsString())
            .path("meals").get(0).path("id").asLong();
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

    private JsonNode removeItem(String date, long id, long version) throws Exception {
        var result = mockMvc.perform(delete("/api/v1/registro/" + date + "/items/" + id)
            .param("version", Long.toString(version)).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode putNote(String date, String text) throws Exception {
        JsonNode meals = getDay(date).path("meals");
        JsonNode currentVersion = meals.get(0).path("noteVersion");
        java.util.Map<String, Object> request = new java.util.HashMap<>();
        request.put("text", text);
        request.put("version", currentVersion.isNumber() ? currentVersion.asLong() : null);
        MvcResult result = mockMvc.perform(put("/api/v1/registro/" + date + "/comidas/" + mealId + "/nota")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.noteId").isNumber())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode getDay(String date) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/registro/" + date)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.meals").isArray())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
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

    private org.springframework.test.web.servlet.ResultActions patchItem(String date, long id, String body) throws Exception {
        return mockMvc.perform(patch("/api/v1/registro/" + date + "/items/" + id)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
    }

    private JsonNode planRules() throws Exception {
        return objectMapper.readTree(mockMvc.perform(get("/api/v1/my-plan/reglas")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private long groupId(String name) throws Exception {
        for (JsonNode g : planRules().path("grupos")) {
            if (name.equals(g.path("name").asText())) return g.path("id").asLong();
        }
        throw new AssertionError(name);
    }

    private void createCompound(String food, String... groupNames) throws Exception {
        JsonNode rules = planRules();
        var components = new java.util.ArrayList<java.util.Map<String, Object>>();
        for (String name : groupNames) {
            for (JsonNode g : rules.path("grupos")) {
                if (name.equals(g.path("name").asText())) {
                    components.add(java.util.Map.of("groupUid", g.path("uid").asText(), "porciones", 1));
                }
            }
        }
        mockMvc.perform(post("/api/v1/my-plan/alimentos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of(
                    "planVersion", rules.path("planVersion").asLong(), "alimento", food,
                    "tipo", "COMPUESTO", "componentes", components))))
            .andExpect(status().isCreated());
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
