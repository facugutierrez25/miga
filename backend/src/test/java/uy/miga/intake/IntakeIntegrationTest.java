package uy.miga.intake;

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

import uy.miga.users.EmailOutboxWorker;
import uy.miga.users.MockEmailService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class IntakeIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private FilterChainProxy springSecurityFilterChain;
    @Autowired private MockEmailService mockEmailService;
    @Autowired private EmailOutboxWorker outboxWorker;
    @Autowired private FoodEntryRepository repository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;
    private String token;
    private long mealId;
    private long proGroupId;
    private long cerGroupId;
    private long fruGroupId;
    private static final String DATE = "2026-01-15";

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
            .addFilters(springSecurityFilterChain)
            .build();

        mockEmailService.reset();
        String email = "intake" + System.nanoTime() + "@miga.uy";

        mockMvc.perform(post("/api/v1/users")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "email": "%s", "password": "Segura1234!" }
                """.formatted(email)));

        outboxWorker.processJobs();
        String verifyToken = mockEmailService.tokenAfterProcessing(outboxWorker, email);
        if (verifyToken != null) {
            mockMvc.perform(get("/api/v1/auth/verify?token=" + verifyToken));
        }

        MvcResult login = mockMvc.perform(post("/api/v1/users/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "email": "%s", "password": "Segura1234!" }
                """.formatted(email)))
            .andReturn();
        token = objectMapper.readTree(login.getResponse().getContentAsString()).get("token").asText();

        MvcResult plan = mockMvc.perform(put("/api/v1/my-plan")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(uy.miga.PlanVersions.withCurrentVersion(mockMvc, token, """
                { "meals": [{ "name": "Desayuno", "displayOrder": 1,
                  "portions": [
                    { "foodGroupAbbr": "PRO", "portions": 1.0 },
                    { "foodGroupAbbr": "CER", "portions": 1.0 },
                    { "foodGroupAbbr": "FRU", "portions": 1.0 }
                  ] }] }
                """)))
            .andReturn();

        JsonNode planJson = objectMapper.readTree(plan.getResponse().getContentAsString());
        mealId = planJson.get("meals").get(0).get("id").asLong();
        for (JsonNode g : planJson.get("foodGroups")) {
            String abbr = g.get("abbreviation").asText();
            if ("PRO".equals(abbr)) proGroupId = g.get("id").asLong();
            if ("CER".equals(abbr)) cerGroupId = g.get("id").asLong();
            if ("FRU".equals(abbr)) fruGroupId = g.get("id").asLong();
        }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void legacyCompoundWithoutOccurrenceRejectsFlexibleCorrectionsWithoutChangingCounts(boolean alreadyFlexible) throws Exception {
        String date = java.time.LocalDate.now().toString();
        JsonNode note = objectMapper.readTree(mockMvc.perform(put("/api/v1/registro/" + date + "/comidas/" + mealId + "/nota")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"text\":\"zqxlegacy\"}")).andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString());
        long noteId = note.path("noteId").asLong();
        var initial = repository.findByMealNoteIdOrderByIdAsc(noteId);
        FoodEntry source = initial.getFirst();
        repository.deleteAll(initial);
        var siblings = new java.util.ArrayList<FoodEntry>();
        for (long groupId : java.util.List.of(proGroupId, cerGroupId, fruGroupId)) {
            var entry = new FoodEntry(source.getUserId(), source.getUserEmail(), mealId,
                java.time.LocalDate.parse(date), "Sticks de pollo", 1.0, "u", groupId);
            entry.setMealNoteId(noteId);
            entry.setOriginalText("Sticks de pollo");
            entry.setRuleType("COMPUESTO");
            entry.setRuleSource("USUARIO");
            entry.setOrigin(EntryOrigin.USER);
            entry.setPortions(java.math.BigDecimal.ONE);
            siblings.add(entry);
        }
        FoodEntry selected = siblings.getFirst();
        if (alreadyFlexible) {
            selected.setRuleType("FLEXIBLE");
            selected.setFoodGroupId(null);
            selected.setPortions(null);
        }
        repository.saveAllAndFlush(siblings);
        long expectedFlexibleCount = alreadyFlexible ? 1 : 0;
        assertWeekFlexibleCount(date, expectedFlexibleCount);
        String correction = alreadyFlexible
            ? "{\"foodGroupId\":" + proGroupId + ",\"portions\":2}"
            : "{\"flexible\":true}";

        mockMvc.perform(patch("/api/v1/registro/" + date + "/items/" + selected.getId())
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(correction))
            .andExpect(status().isConflict())
            .andExpect(result -> assertThat(result.getResolvedException())
                .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class, exception ->
                    assertThat(exception.getReason()).isEqualTo(
                        "Este alimento se anotó en una versión anterior; editá la nota para corregirlo")));

        var reloaded = repository.findByMealNoteIdOrderByIdAsc(noteId);
        assertThat(reloaded).hasSize(3);
        for (int index = 0; index < siblings.size(); index++) {
            FoodEntry expected = siblings.get(index);
            FoodEntry actual = reloaded.get(index);
            assertThat(actual.getId()).isEqualTo(expected.getId());
            assertThat(actual.getFoodGroupId()).isEqualTo(expected.getFoodGroupId());
            assertThat(actual.getRuleType()).isEqualTo(expected.getRuleType());
            assertThat(actual.getOccurrenceId()).isNull();
            if (expected.getPortions() == null) assertThat(actual.getPortions()).isNull();
            else assertThat(actual.getPortions()).isEqualByComparingTo(expected.getPortions());
        }
        assertWeekFlexibleCount(date, expectedFlexibleCount);
    }

    private void assertWeekFlexibleCount(String date, long expected) throws Exception {
        JsonNode week = objectMapper.readTree(mockMvc.perform(get("/api/v1/semana").param("date", date)
            .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        assertThat(week.path("days")).anySatisfy(day -> {
            assertThat(day.path("date").asText()).isEqualTo(date);
            assertThat(day.path("meals").get(0).path("flexibleCount").asLong()).isEqualTo(expected);
        });
    }

    @Test
    void getEntries_newUser_returnsEmptyList() throws Exception {
        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void addEntry_createsAndReturnsItem() throws Exception {
        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "food": "Pechuga de pollo", "quantity": 200, "unit": "G", "foodGroupId": %d }
                """.formatted(proGroupId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNumber())
            .andExpect(jsonPath("$.mealId").value(mealId))
            .andExpect(jsonPath("$.food").value("Pechuga de pollo"))
            .andExpect(jsonPath("$.quantity").value(200.0))
            .andExpect(jsonPath("$.unit").value("G"))
            .andExpect(jsonPath("$.foodGroupId").value(proGroupId))
            .andExpect(jsonPath("$.consumed").value(false));
    }

    @Test
    void addMultipleEntries_sameMeal_allPersisted() throws Exception {
        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "food": "Pechuga de pollo", "quantity": 200, "unit": "G", "foodGroupId": %d }
                """.formatted(proGroupId)));

        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "food": "Arroz cocido", "quantity": 1, "unit": "TAZA", "foodGroupId": %d }
                """.formatted(cerGroupId)));

        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].food").value("Pechuga de pollo"))
            .andExpect(jsonPath("$[1].food").value("Arroz cocido"));
    }

    @Test
    void markConsumed_updatesAllEntriesForMeal() throws Exception {
        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "food": "Pechuga de pollo", "quantity": 200, "unit": "G", "foodGroupId": %d }
                """.formatted(proGroupId)));

        mockMvc.perform(put("/api/v1/intake/" + DATE + "/" + mealId + "/consumed")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$[0].consumed").value(true));
    }

    @Test
    void unmarkConsumed_resetsConsumedFlag() throws Exception {
        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "food": "Pechuga de pollo", "quantity": 200, "unit": "G", "foodGroupId": %d }
                """.formatted(proGroupId)));

        mockMvc.perform(put("/api/v1/intake/" + DATE + "/" + mealId + "/consumed")
            .header("Authorization", "Bearer " + token));

        mockMvc.perform(delete("/api/v1/intake/" + DATE + "/" + mealId + "/consumed")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$[0].consumed").value(false));
    }

    @Test
    void deleteEntry_removesItem() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "food": "Pechuga de pollo", "quantity": 200, "unit": "G", "foodGroupId": %d }
                """.formatted(proGroupId)))
            .andReturn();

        long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(delete("/api/v1/intake/entries/" + id)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void deleteEntry_otherUsersEntry_returnsNotFound() throws Exception {
        mockMvc.perform(delete("/api/v1/intake/entries/99999")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isNotFound());
    }

    @Test
    void getEntries_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/intake/" + DATE))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void getEntries_onlyReturnsSameDateEntries() throws Exception {
        mockMvc.perform(post("/api/v1/intake/" + DATE + "/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "food": "Manzana", "quantity": 1, "unit": "UNIDAD", "foodGroupId": %d }
                """.formatted(fruGroupId)));

        mockMvc.perform(post("/api/v1/intake/2026-01-16/" + mealId)
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "food": "Banana", "quantity": 1, "unit": "UNIDAD", "foodGroupId": %d }
                """.formatted(fruGroupId)));

        mockMvc.perform(get("/api/v1/intake/" + DATE)
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].food").value("Manzana"));
    }
}
