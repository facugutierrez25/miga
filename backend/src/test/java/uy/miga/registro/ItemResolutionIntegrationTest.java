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

class ItemResolutionIntegrationTest extends RegistroIntegrationTestBase {
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
}
