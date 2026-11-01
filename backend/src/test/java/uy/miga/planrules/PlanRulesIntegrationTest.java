package uy.miga.planrules;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import uy.miga.users.EmailOutboxWorker;
import uy.miga.users.MockEmailService;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class PlanRulesIntegrationTest {
    @org.springframework.test.context.bean.override.mockito.MockitoBean java.time.Clock clock;
    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    @Autowired MockEmailService email;
    @Autowired EmailOutboxWorker outbox;
    @Autowired JdbcTemplate jdbc;
    final ObjectMapper mapper = new ObjectMapper();
    MockMvc mvc;
    String token;
    JsonNode state;
    static final String BASE = "/api/v1/my-plan/";
    @BeforeEach void setup() throws Exception {
        var zone = java.time.ZoneId.of("America/Montevideo");
        var localDate = LocalDate.now(zone);
        var fixed = java.time.Clock.fixed(localDate.plusDays(1).atTime(1, 30).toInstant(java.time.ZoneOffset.UTC), zone);
        org.mockito.Mockito.when(clock.getZone()).thenReturn(zone);
        org.mockito.Mockito.when(clock.instant()).thenReturn(fixed.instant());
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        token = account();
        request(put("/api/v1/my-plan"), uy.miga.PlanVersions.withCurrentVersion(mvc, token, Map.of("meals", List.of(
            Map.of("name", "Desayuno", "displayOrder", 1, "portions", List.of(Map.of("foodGroupAbbr", "PRO", "portions", 1))),
            Map.of("name", "Almuerzo", "displayOrder", 2, "portions", List.of(Map.of("foodGroupAbbr", "CER", "portions", 1))),
            Map.of("name", "Cena", "displayOrder", 3, "portions", List.of(Map.of("foodGroupAbbr", "GRA", "portions", 1)))))), 200);
        state = request(get(BASE+"reglas"), null, 200);
    }
    String account() throws Exception {
        String address = "rules-"+UUID.randomUUID()+"@miga.uy";
        email.reset();
        mvc.perform(post("/api/v1/users").contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(Map.of("email", address, "password", "Segura1234!")))).andExpect(status().isCreated());
        outbox.processJobs();
        mvc.perform(get("/api/v1/auth/verify").param("token", email.tokenAfterProcessing(outbox, address))).andExpect(status().isOk());
        return mapper.readTree(mvc.perform(post("/api/v1/users/login").contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(Map.of("email", address, "password", "Segura1234!"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("token").asText();
    }
    JsonNode request(MockHttpServletRequestBuilder req, Object body, int expected) throws Exception {
        req.header("Authorization", "Bearer "+token);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        String result = mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return result.isEmpty() ? mapper.nullNode() : mapper.readTree(result);
    }
    ObjectNode body(Object value) {
        ObjectNode result = mapper.valueToTree(value); result.put("planVersion", state.path("planVersion").asLong()); return result;
    }
    JsonNode group(String name) { for (JsonNode g: state.path("grupos")) if (name.equals(g.path("name").asText())) return g; throw new AssertionError(name); }
    JsonNode habit(String name) { for (JsonNode h: state.path("habitos")) if (name.equals(h.path("name").asText())) return h; throw new AssertionError(name); }
    void addGroup(String name, Map<String,Object> fields) throws Exception {
        Map<String,Object> values = new HashMap<>(fields); values.put("name", name);
        state = request(post(BASE+"grupos"), body(values), 201);
    }
    @Test
    void legacyGroupGoalIsIgnoredAndAbsentFromResponses() throws Exception {
        addGroup("Legado", Map.of("metaDiaria", 99));
        assertThat(group("Legado").has("metaDiaria")).isFalse();
        String uid = group("Legado").path("uid").asText();
        state = request(put(BASE + "grupos/" + uid), body(Map.of("name", "Legado", "metaDiaria", 50)), 200);
        assertThat(group("Legado").has("metaDiaria")).isFalse();
        JsonNode plan = request(get("/api/v1/my-plan"), null, 200);
        for (JsonNode g : plan.path("foodGroups")) assertThat(g.has("metaDiaria")).isFalse();
        JsonNode day = request(get("/api/v1/registro/" + LocalDate.now(clock)), null, 200);
        for (JsonNode summary : day.path("summary")) assertThat(summary.has("dailyGoal")).isFalse();
        for (JsonNode meal : day.path("meals")) {
            for (JsonNode comparison : meal.path("comparison")) assertThat(comparison.has("dailyGoal")).isFalse();
        }
    }
    void addHabit(String name, String type, String period, double goal, double step) throws Exception {
        state = request(post(BASE+"habitos"), body(Map.of("name", name, "habitType", type, "period", period, "goal", goal, "step", step, "unit", "lt")), 201);
    }
    List<Long> meals() throws Exception {
        JsonNode plan = request(get("/api/v1/my-plan"), null, 200);
        List<Long> result = new ArrayList<>(); plan.path("meals").forEach(m -> result.add(m.path("id").asLong())); return result;
    }
    // Versión de cada nota guardada (fecha/comida → versión), para editarla como un cliente al día.
    private final Map<String, Long> noteVersions = new HashMap<>();

    JsonNode note(long meal, LocalDate date, String text) throws Exception {
        String key = date + "/" + meal;
        Map<String, Object> body = new HashMap<>();
        body.put("text", text);
        body.put("version", noteVersions.containsKey(key) ? noteVersions.get(key) : currentNoteVersion(meal, date));
        JsonNode saved = request(put("/api/v1/registro/"+date+"/comidas/"+meal+"/nota"), body, 201);
        noteVersions.put(key, saved.path("version").asLong());
        return saved;
    }

    private Long currentNoteVersion(long meal, LocalDate date) throws Exception {
        for (JsonNode m : request(get("/api/v1/registro/" + date), null, 200).path("meals")) {
            if (m.path("mealId").asLong() == meal && m.hasNonNull("noteVersion")) return m.path("noteVersion").asLong();
        }
        return null;
    }
    @ParameterizedTest @ValueSource(strings={"grupos", "alimentos", "habitos"})
    void mutationContracts(String resource) throws Exception {
        Map<String,Object> values = switch(resource) {
            case "grupos" -> Map.of("name", "Temporal");
            case "alimentos" -> Map.of("alimento", "sintetico", "tipo", "NORMAL", "groupUid", group("Proteínas").path("uid").asText());
            default -> Map.of("name", "Temporal", "habitType", "CONTADOR", "period", "SEMANA");
        };
        String array = switch(resource) { case "grupos" -> "grupos"; case "alimentos" -> "alimentos"; default -> "habitos"; };
        ObjectNode valid = body(values);
        JsonNode invalid = request(post(BASE+resource), body(Map.of()), 400); assertThat(invalid.path("code").asText()).isEqualTo("VALIDATION");
        state = request(post(BASE+resource), valid, 201);
        JsonNode created = state.path(array).get(state.path(array).size()-1);
        String uid = created.path("uid").asText();
        assertThat(request(post(BASE+resource), valid, 409).path("code").asText()).isEqualTo("VERSION_CONFLICT");
        request(put(BASE+resource+"/"+uid), valid, 409);
        request(delete(BASE+resource+"/"+uid).param("planVersion", valid.path("planVersion").asText()), null, 409);
        request(put(BASE+resource+"/"+uid), body(Map.of()), 400);
        // The UID is real, but belongs to a different user.
        String owner = token; JsonNode ownerState = state;
        token = account();
        request(put("/api/v1/my-plan"), uy.miga.PlanVersions.withCurrentVersion(mvc, token, Map.of("meals",List.of(Map.of("name","Otra", "displayOrder",1,"portions",List.of(Map.of("foodGroupAbbr","PRO","portions",1)))))),200);
        state = request(get(BASE+"reglas"),null,200);
        Map<String,Object> foreignValues = new HashMap<>(values);
        if (resource.equals("alimentos")) foreignValues.put("groupUid", group("Proteínas").path("uid").asText());
        assertThat(request(put(BASE+resource+"/"+uid),body(foreignValues),404).path("code").asText()).isEqualTo("NOT_FOUND");
        request(delete(BASE+resource+"/"+uid).param("planVersion",state.path("planVersion").asText()),null,404);
        token=owner; state=ownerState;
        long revision=state.path("planVersion").asLong();
        state=request(put(BASE+resource+"/"+uid),body(values),200);
        assertThat(state.path("planVersion").asLong()).isGreaterThan(revision);
        state=request(delete(BASE+resource+"/"+uid).param("planVersion",state.path("planVersion").asText()),null,200);
        for(JsonNode remaining:state.path(array)) assertThat(remaining.path("uid").asText()).isNotEqualTo(uid);
    }
    @Test void groupOrderAndUniqueness() throws Exception {
        addGroup("Árbol", Map.of()); addGroup("Arbolito", Map.of());
        assertThat(group("Árbol").path("abbreviation").asText()).isEqualTo("ARB");
        assertThat(group("Arbolito").path("abbreviation").asText()).isEqualTo("ARB1");
        request(post(BASE+"grupos"),body(Map.of("name","Duplicado","abbreviation","PRO")),409);
        addGroup("Clave",Map.of("clave","unica"));
        request(post(BASE+"grupos"),body(Map.of("name","Duplicado","clave","unica")),409);
        // Un color fuera de la paleta al crear se reemplaza por el primero libre.
        state=request(post(BASE+"grupos"),body(Map.of("name","Color","color","red")),201);
        assertThat(group("Color").path("color").asText()).matches("#[0-9A-F]{6}").isNotEqualTo("red");
        List<String> uids=new ArrayList<>(); state.path("grupos").forEach(g -> uids.add(g.path("uid").asText())); Collections.reverse(uids);
        ObjectNode order=body(Map.of("uids",uids)); state=request(put(BASE+"grupos/orden"),order,200);
        assertThat(state.path("grupos").get(0).path("uid").asText()).isEqualTo(uids.getFirst());
        request(put(BASE+"grupos/orden"),order,409);
        request(put(BASE+"grupos/orden"),body(Map.of("uids",List.of(uids.getFirst(),uids.getFirst()))),400);
        request(put(BASE+"grupos/orden"),body(Map.of("uids",List.of(UUID.randomUUID()))),400);
        request(put(BASE+"grupos/orden"),body(Map.of()),400);
    }
    @Test void usedGroupsAreRejectedIncludingCompoundReferences() throws Exception {
        String uid=group("Proteínas").path("uid").asText();
        JsonNode error=request(delete(BASE+"grupos/"+uid).param("planVersion",state.path("planVersion").asText()),null,409);
        assertThat(error.path("code").asText()).isEqualTo("GROUP_IN_USE"); assertThat(error.path("comidas").asInt()).isEqualTo(1);
        addGroup("Propio",Map.of()); String custom=group("Propio").path("uid").asText();
        state=request(post(BASE+"alimentos"),body(Map.of("alimento","compuesto prueba","tipo","COMPUESTO","componentes",List.of(
            Map.of("groupUid",custom,"porciones",1),Map.of("groupUid",uid,"porciones",1)))),201);
        error=request(delete(BASE+"grupos/"+custom).param("planVersion",state.path("planVersion").asText()),null,409);
        assertThat(error.path("alimentos").asInt()).isEqualTo(1);
        request(post(BASE+"alimentos"),body(Map.of("alimento","mal","tipo","COMPUESTO","componentes",List.of(Map.of("groupUid",custom,"porciones",1)))),400);
        request(post(BASE+"alimentos"),body(Map.of("alimento","mal","tipo","NORMAL","groupUid",UUID.randomUUID())),404);
    }
    @Test void editingKeepsLegacyLongNamesAndSynonymsButRejectsNewOnes() throws Exception {
        state=request(post(BASE+"alimentos"),body(Map.of("alimento","heredado","tipo","NORMAL","groupUid",group("Proteínas").path("uid").asText())),201);
        String uid=null;
        for (JsonNode r: state.path("alimentos")) if ("heredado".equals(r.path("alimento").asText())) uid=r.path("uid").asText();
        String longName="h".repeat(150), longSynonym="s".repeat(150);
        // Datos guardados antes de los topes nuevos.
        jdbc.update("update food_rules set alimento=?, sinonimos=? where uid=?::uuid", longName, new String[]{longSynonym}, uid);
        state=request(get(BASE+"reglas"),null,200);
        Map<String,Object> keep=Map.of("alimento",longName,"sinonimos",List.of(longSynonym),"tipo","NORMAL",
            "groupUid",group("Proteínas").path("uid").asText(),"porcionPorDefecto",2);
        state=request(put(BASE+"alimentos/"+uid),body(keep),200);
        request(put(BASE+"alimentos/"+uid),body(Map.of("alimento",longName,"sinonimos",List.of(longSynonym,"n".repeat(101)),"tipo","NORMAL",
            "groupUid",group("Proteínas").path("uid").asText())),400);
        request(put(BASE+"alimentos/"+uid),body(Map.of("alimento","x".repeat(101),"tipo","NORMAL",
            "groupUid",group("Proteínas").path("uid").asText())),400);
    }

    @Test void usedVersionIsCopiedOnceAndHistoricalNotesAndItemsStayIntact() throws Exception {
        long old=state.path("planId").asLong(); long meal=meals().getFirst();
        state=request(post(BASE+"alimentos"),body(Map.of("alimento","sintetico","tipo","NORMAL","groupUid",group("Proteínas").path("uid").asText())),201);
        note(meal,LocalDate.now(clock).minusDays(1),"1 sintetico");
        var oldNotes=jdbc.queryForList("select * from meal_notes where plan_id=?",old);
        var oldItems=jdbc.queryForList("select * from food_entries where meal_id=?",meal);
        assertThat(oldItems).hasSize(1);
        addGroup("Nuevo",Map.of()); long copy=state.path("planId").asLong(); assertThat(copy).isNotEqualTo(old);
        assertThat(jdbc.queryForList("select * from meal_notes where plan_id=?",old)).isEqualTo(oldNotes);
        assertThat(jdbc.queryForList("select * from food_entries where meal_id=?",meal)).isEqualTo(oldItems);
        assertThat(meals()).hasSize(3).doesNotContain(meal);
        assertThat(jdbc.queryForObject("select count(*) from meal_portions where meal_id in (select id from meals where plan_id=?)",Integer.class,copy)).isEqualTo(3);
        addGroup("Segundo",Map.of()); assertThat(state.path("planId").asLong()).isEqualTo(copy);
    }
    @Test void planForDateMatchesHistoricalNotesAndIsScopedToUser() throws Exception {
        LocalDate yesterday = LocalDate.now(clock).minusDays(1);
        JsonNode original = request(get("/api/v1/my-plan"), null, 200);
        long meal = meals().getFirst();
        note(meal, yesterday, "1 manzana");
        addGroup("New group", Map.of());
        assertThat(meals()).doesNotContain(meal);
        JsonNode historical = request(get("/api/v1/my-plan").param("date", yesterday.toString()), null, 200);
        // La versión del plan viejo cambia al reemplazarlo; lo que importa son sus comidas y grupos.
        assertThat(historical.path("meals")).isEqualTo(original.path("meals"));
        assertThat(historical.path("foodGroups")).isEqualTo(original.path("foodGroups"));
        List<Long> historicalMeals = new ArrayList<>();
        historical.path("meals").forEach(m -> historicalMeals.add(m.path("id").asLong()));
        JsonNode day = request(get("/api/v1/registro/" + yesterday), null, 200);
        assertThat(day.path("meals")).isNotEmpty();
        for (JsonNode entry : day.path("meals")) {
            assertThat(historicalMeals).contains(entry.path("mealId").asLong());
        }
        assertThat(request(get("/api/v1/my-plan").param("date", yesterday.minusYears(1).toString()), null, 200).path("meals"))
            .isEqualTo(original.path("meals"));
        token = account();
        request(get("/api/v1/my-plan").param("date", yesterday.toString()), null, 404);
        request(get("/api/v1/my-plan"), null, 404);
    }

    @Test void completeAcceptanceThroughApi() throws Exception {
        addGroup("Huevo",Map.of("clave","huevos")); addGroup("Panificados",Map.of("clave","panificados"));
        addGroup("Aceite",Map.of("preguntarSiFalta",true)); addGroup("Dulces",Map.of("opcional",true));
        assertThat(group("Huevo").path("uid")).isNotEqualTo(group("Panificados").path("uid"));
        assertThat(group("Aceite").path("preguntarSiFalta").asBoolean()).isTrue();
        assertThat(group("Dulces").path("opcional").asBoolean()).isTrue();
        addHabit("agua","CANTIDAD","DIA",2,0.5); addHabit("fuerza","CONTADOR","SEMANA",3,1); addHabit("flexibles","CONTADOR","SEMANA",3,1);
        assertThat(habit("agua").path("goal").asDouble()).isEqualTo(2); assertThat(habit("agua").path("step").asDouble()).isEqualTo(0.5);
        List<Map<String,Object>> components=new ArrayList<>(); List<Long> groupIds=new ArrayList<>();
        for(String name:List.of("Proteínas","Cereales","Grasas")) {
            components.add(Map.of("groupUid",group(name).path("uid").asText(),"porciones",1)); groupIds.add(group(name).path("id").asLong());
        }
        state=request(post(BASE+"alimentos"),body(Map.of("alimento","barrita","tipo","COMPUESTO","componentes",components)),201);
        assertThat(state.path("alimentos").get(0).path("textoRegla").asText()).isEqualTo("1 barrita = 1 Proteínas + 1 Cereales + 1 Grasas");
        var ids=meals(); String[] texts={"1 barrita","media barrita","2 barritas"}; double[] portions={1,0.5,2};
        for(int i=0;i<3;i++) note(ids.get(i),LocalDate.now(clock),texts[i]);
        JsonNode day=request(get("/api/v1/registro/"+LocalDate.now(clock)),null,200);
        for(int i=0;i<3;i++) {
            JsonNode items=day.path("meals").get(i).path("items"); assertThat(items.size()).isEqualTo(3);
            for(JsonNode item:items) { assertThat(item.path("portions").asDouble()).isEqualTo(portions[i]); assertThat(groupIds).contains(item.path("foodGroupId").asLong()); }
        }
    }
    @Test void catalogAdjustmentWinsForGlobalSynonymAndCanBeRemoved() throws Exception {
        String food="catalogo"+UUID.randomUUID().toString().replace("-",""); String synonym="alias"+food;
        UUID uid=UUID.randomUUID();
        jdbc.update("insert into food_rules(uid,alcance,alimento,sinonimos,tipo,standard_group_key) values (?,'GLOBAL',?,array[?],'NORMAL','proteinas')",uid,food,synonym);
        JsonNode catalog=request(get(BASE+"catalogo").param("q",synonym.toUpperCase()),null,200); assertThat(catalog.size()).isEqualTo(1);
        ObjectNode version=body(Map.of());
        state=request(post(BASE+"catalogo/"+uid+"/ajustar"),version,201);
        request(post(BASE+"catalogo/"+uid+"/ajustar"),version,409);
        request(post(BASE+"catalogo/"+uid+"/ajustar"),body(Map.of()),409);
        request(post(BASE+"catalogo/"+UUID.randomUUID()+"/ajustar"),body(Map.of()),404);
        request(post(BASE+"catalogo/"+uid+"/ajustar"),Map.of(),400);
        String adjustment=state.path("alimentos").get(0).path("uid").asText();
        state=request(put(BASE+"alimentos/"+adjustment),body(Map.of("alimento",food,"sinonimos",List.of(synonym),"tipo","NORMAL","groupUid",group("Cereales").path("uid").asText(),"overridesRuleUid",uid)),200);
        long cereals=group("Cereales").path("id").asLong(), protein=group("Proteínas").path("id").asLong();
        catalog=request(get(BASE+"catalogo").param("q",food),null,200); assertThat(catalog.get(0).path("ajustadoPorUid").asText()).isEqualTo(adjustment);
        long meal=meals().getFirst(); note(meal,LocalDate.now(clock),"1 "+synonym);
        assertThat(jdbc.queryForObject("select food_group_id from food_entries where meal_id=?",Long.class,meal)).isEqualTo(cereals);
        state=request(delete(BASE+"alimentos/"+adjustment).param("planVersion",state.path("planVersion").asText()),null,200);
        long newMeal=meals().getFirst(); note(newMeal,LocalDate.now(clock),"2 "+synonym);
        long newProtein=group("Proteínas").path("id").asLong();
        assertThat(newProtein).isNotEqualTo(protein);
        assertThat(jdbc.queryForObject("select food_group_id from food_entries where meal_id=?",Long.class,newMeal)).isEqualTo(newProtein);
    }
    @Test void habitContinuityAndArchival() throws Exception {
        addHabit("Agua","CANTIDAD","DIA",2,0.5);
        String uid=habit("Agua").path("uid").asText(); long oldHabit=habit("Agua").path("id").asLong();
        request(put("/api/v1/habitos/"+oldHabit+"/log").param("date",LocalDate.now(clock).toString()),Map.of("value",1),201);
        addGroup("Copia",Map.of()); long newHabit=habit("Agua").path("id").asLong(); assertThat(newHabit).isNotEqualTo(oldHabit);
        JsonNode week=request(get("/api/v1/semana"),null,200);
        boolean found=false; for(JsonNode day:week.path("days")) for(JsonNode log:day.path("habitLogs")) if(log.path("habitId").asLong()==newHabit) found=true;
        assertThat(found).isTrue();
        request(put("/api/v1/habitos/"+newHabit+"/log").param("date",LocalDate.now(clock).toString()),Map.of("value",1.5),201);
        assertThat(jdbc.queryForObject("select count(*) from habit_logs where habit_uid=?",Integer.class,UUID.fromString(uid))).isEqualTo(1);
        state=request(delete(BASE+"habitos/"+uid).param("planVersion",state.path("planVersion").asText()),null,200);
        assertThat(state.path("habitos").size()).isZero();
        assertThat(request(get("/api/v1/habitos"),null,200).size()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from habit_logs where habit_uid=?",Integer.class,UUID.fromString(uid))).isEqualTo(1);
        assertThat(jdbc.queryForObject("select archived_at is not null from plan_habits where plan_id=? and uid=?",Boolean.class,state.path("planId").asLong(),UUID.fromString(uid))).isTrue();
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void concurrentMutationsHaveOneWinner(boolean used) throws Exception {
        if (used) note(meals().getFirst(), LocalDate.now(clock), "1 manzana");
        long planId=state.path("planId").asLong();
        long revision=state.path("planVersion").asLong();
        var start=new java.util.concurrent.CountDownLatch(1);
        try(var executor=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            List<java.util.concurrent.Future<Integer>> tasks=new ArrayList<>();
            for(int i=0;i<2;i++) {
                String name="Concurrente"+i;
                tasks.add(executor.submit(() -> {
                    start.await();
                    return mvc.perform(post(BASE+"grupos").header("Authorization","Bearer "+token)
                        .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("name",name,"planVersion",revision))))
                        .andReturn().getResponse().getStatus();
                }));
            }
            start.countDown();
            List<Integer> statuses=new ArrayList<>();
            for(var task:tasks) statuses.add(task.get(30,java.util.concurrent.TimeUnit.SECONDS));
            assertThat(statuses).containsExactlyInAnyOrder(201,409);
        }
        state=request(get(BASE+"reglas"),null,200);
        assertThat(state.path("planVersion").asLong()).isGreaterThan(revision);
        assertThat(jdbc.queryForObject("select count(*) from plans where user_id=(select user_id from plans where id=?)",Integer.class,planId)).isEqualTo(used?2:1);
    }
    @Test void validationRejectsInvalidRuleAndHabitConfigurations() throws Exception {
        String uid=group("Proteínas").path("uid").asText();
        for(Map<String,Object> invalid:List.<Map<String,Object>>of(
            Map.of("alimento","test","tipo","NORMAL"),
            Map.of("alimento","test","tipo","NORMAL","groupUid",uid,"cantidadPorPorcion",1),
            Map.of("alimento","test","tipo","NORMAL","groupUid",uid,"porcionPorDefecto",0),
            Map.of("alimento","test","tipo","LIBRE","groupUid",uid),
            Map.of("alimento","test","tipo","OTRO"),
            Map.of("alimento","test","tipo","COMPUESTO","componentes",List.of(Map.of("groupUid",uid,"porciones",1),Map.of("groupUid",uid,"porciones",1)))))
            request(post(BASE+"alimentos"),body(invalid),400);
        for(Map<String,Object> invalid:List.<Map<String,Object>>of(
            Map.of("name","test","habitType","OTRO","period","DIA"),
            Map.of("name","test","habitType","CONTADOR","period","MES"),
            Map.of("name","test","habitType","CONTADOR","period","DIA","step",0),
            Map.of("name","test","habitType","CONTADOR","period","DIA","goal",-1)))
            request(post(BASE+"habitos"),body(invalid),400);
        for(String resource:List.of("grupos","alimentos","habitos")) {
            request(delete(BASE+resource+"/"+UUID.randomUUID()),null,400);
            request(delete(BASE+resource+"/"+UUID.randomUUID()).param("planVersion","invalid"),null,400);
        }
    }

    @Test void unusedGroupCanBeDeletedFromForkWithoutChangingHistory() throws Exception {
        addGroup("Borrable",Map.of()); String uid=group("Borrable").path("uid").asText();
        long old=state.path("planId").asLong(); note(meals().getFirst(),LocalDate.now(clock),"1 manzana");
        state=request(delete(BASE+"grupos/"+uid).param("planVersion",state.path("planVersion").asText()),null,200);
        assertThat(state.path("planId").asLong()).isNotEqualTo(old);
        assertThat(jdbc.queryForObject("select count(*) from plan_food_groups where plan_id=? and uid=?",Integer.class,old,UUID.fromString(uid))).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from plan_food_groups where plan_id=? and uid=?",Integer.class,state.path("planId").asLong(),UUID.fromString(uid))).isZero();
    }
    @Test void catalogRejectsForeignPlanRulesAndMissingStandardGroup() throws Exception {
        long own=state.path("planId").asLong();
        String ownerToken=token;
        token=account();
        request(put("/api/v1/my-plan"),uy.miga.PlanVersions.withCurrentVersion(mvc, token, Map.of("meals",List.of(Map.of("name","Ajena","displayOrder",1,"portions",List.of(Map.of("foodGroupAbbr","PRO","portions",1)))))),200);
        long foreign=request(get(BASE+"reglas"),null,200).path("planId").asLong(); token=ownerToken;
        UUID uid=UUID.randomUUID();
        jdbc.update("insert into food_rules(uid,plan_id,alcance,alimento,tipo) values (?,?,'PLAN','Ajeno','LIBRE')",uid,foreign);
        request(post(BASE+"catalogo/"+uid+"/ajustar"),body(Map.of()),404);
        UUID missing=UUID.randomUUID();
        jdbc.update("insert into food_rules(uid,alcance,alimento,tipo,standard_group_key) values (?,'GLOBAL','Sin grupo','NORMAL','clave_sintetica_ausente')",missing);
        assertThat(request(post(BASE+"catalogo/"+missing+"/ajustar"),body(Map.of()),400).path("code").asText()).isEqualTo("VALIDATION");
        assertThat(request(get(BASE+"reglas"),null,200).path("planId").asLong()).isEqualTo(own);
    }
    @Test void missingPlanReturnsStructured404() throws Exception {
        token=account();
        assertThat(request(get(BASE+"reglas"),null,404).path("code").asText()).isEqualTo("NOT_FOUND");
        request(get(BASE+"catalogo"),null,404);
        request(post(BASE+"grupos"),Map.of("planVersion",0,"name","Nuevo"),404);
        request(post(BASE+"alimentos"),Map.of("planVersion",0,"alimento","Nuevo","tipo","LIBRE"),404);
        request(post(BASE+"habitos"),Map.of("planVersion",0,"name","Nuevo","habitType","SI_NO","period","DIA"),404);
    }
    @Test
    void successiveMealSavesIncreaseRevisionAndRejectStaleMutation() throws Exception {
        long previous = state.path("planVersion").asLong();
        for (int portions : List.of(2, 3)) {
            request(put("/api/v1/my-plan"), uy.miga.PlanVersions.withCurrentVersion(mvc, token, Map.of("meals", List.of(
                Map.of("name", "Desayuno", "displayOrder", 1, "portions",
                    List.of(Map.of("foodGroupAbbr", "PRO", "portions", portions)))))), 200);
            state = request(get(BASE + "reglas"), null, 200);
            assertThat(state.path("planVersion").asLong()).isGreaterThan(previous);
            JsonNode error = request(post(BASE + "grupos"),
                Map.of("name", "Obsoleto", "planVersion", previous), 409);
            assertThat(error.path("code").asText()).isEqualTo("VERSION_CONFLICT");
            previous = state.path("planVersion").asLong();
        }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void todayRecordsFollowNewVersionButYesterdayStays(boolean saveMeals) throws Exception {
        addHabit("Agua", "CANTIDAD", "DIA", 2, 0.5);
        long oldHabit = habit("Agua").path("id").asLong();
        String habitUid = habit("Agua").path("uid").asText();
        long oldPlan = state.path("planId").asLong();
        long meal = meals().getFirst();
        LocalDate today = LocalDate.now(clock);
        state = request(post(BASE + "alimentos"), body(Map.of("alimento", "sintetico", "tipo", "NORMAL",
            "groupUid", group("Proteínas").path("uid").asText())), 201);
        note(meal, today.minusDays(1), "1 sintetico");
        note(meal, today, "2 sintetico");
        for (LocalDate date : List.of(today.minusDays(1), today)) {
            request(put("/api/v1/habitos/" + oldHabit + "/log").param("date", date.toString()), Map.of("value", 1), 201);
        }
        var yesterdayNotes = jdbc.queryForList("select * from meal_notes where plan_id=? and fecha=?", oldPlan, today.minusDays(1));
        var yesterdayItems = jdbc.queryForList("select * from food_entries where meal_id=? and date=?", meal, today.minusDays(1));
        if (saveMeals) {
            request(put("/api/v1/my-plan"), uy.miga.PlanVersions.withCurrentVersion(mvc, token, Map.of("meals", List.of(Map.of("name", "Desayuno", "displayOrder", 1,
                "portions", List.of(Map.of("foodGroupAbbr", "PRO", "portions", 2)))))), 200);
            state = request(get(BASE + "reglas"), null, 200);
        } else {
            state = request(put(BASE + "habitos/" + habitUid), body(Map.of("name", "Agua editada",
                "habitType", "CANTIDAD", "period", "DIA", "goal", 3, "step", 0.5)), 200);
        }
        assertThat(state.path("planId").asLong()).isNotEqualTo(oldPlan);
        JsonNode day = request(get("/api/v1/registro/" + today), null, 200);
        assertThat(day.path("meals").get(0).path("noteText").asText()).isEqualTo("2 sintetico");
        assertThat(day.path("meals").get(0).path("items").size()).isEqualTo(1);
        assertThat(day.path("summary").get(0).path("totalRecorded").asDouble()).isEqualTo(2);
        assertThat(jdbc.queryForList("select * from meal_notes where plan_id=? and fecha=?", oldPlan, today.minusDays(1))).isEqualTo(yesterdayNotes);
        assertThat(jdbc.queryForList("select * from food_entries where meal_id=? and date=?", meal, today.minusDays(1))).isEqualTo(yesterdayItems);
        assertThat(jdbc.queryForObject("select plan_habit_id from habit_logs where habit_uid=? and log_date=?", Long.class,
            UUID.fromString(habitUid), today)).isNotEqualTo(oldHabit);
        assertThat(jdbc.queryForObject("select plan_habit_id from habit_logs where habit_uid=? and log_date=?", Long.class,
            UUID.fromString(habitUid), today.minusDays(1))).isEqualTo(oldHabit);
    }

    @Test
    void lateUruguayEveningResolvesLatestLocalVersion() throws Exception {
        long oldPlan = state.path("planId").asLong();
        long oldMeal = meals().getFirst();
        LocalDate today = LocalDate.now(clock);
        note(oldMeal, today, "1 manzana");
        addGroup("Nueva versión local", Map.of());
        long current = state.path("planId").asLong();
        jdbc.update("update plans set created_at=? where id=?",
            today.atTime(23, 0).atOffset(java.time.ZoneOffset.UTC), oldPlan);
        jdbc.update("update plans set created_at=? where id=?",
            today.plusDays(1).atTime(1, 0).atOffset(java.time.ZoneOffset.UTC), current);
        jdbc.update("update plans set superseded_at=? where id=?",
            today.plusDays(1).atTime(1, 0).atOffset(java.time.ZoneOffset.UTC), oldPlan);
        JsonNode plan = request(get("/api/v1/my-plan"), null, 200);
        JsonNode day = request(get("/api/v1/registro/" + today), null, 200);
        assertThat(plan.path("createdAt").asText()).isEqualTo(today.toString());
        assertThat(day.path("meals").get(0).path("mealId").asLong())
            .isEqualTo(plan.path("meals").get(0).path("id").asLong()).isNotEqualTo(oldMeal);
        assertThat(day.path("meals").get(0).path("noteText").asText()).isEqualTo("1 manzana");
    }

    @Test
    void twoRuleEditsReinterpretTodayAndPreserveYesterday() throws Exception {
        LocalDate today = LocalDate.now(clock);
        long oldPlan = state.path("planId").asLong();
        long meal = meals().getFirst();
        state = request(post(BASE + "alimentos"), body(Map.of("alimento", "sintetico", "tipo", "NORMAL",
            "groupUid", group("Proteínas").path("uid").asText(), "cantidadPorPorcion", 1, "unidad", "u")), 201);
        String ruleUid = state.path("alimentos").get(0).path("uid").asText();
        String groupUid = group("Proteínas").path("uid").asText();
        JsonNode saved = note(meal, today, "4 sintetico u");
        note(meal, today.minusDays(1), "2 sintetico u");
        long groupId = group("Proteínas").path("id").asLong();
        request(post("/api/v1/registro/" + today + "/comidas/" + meal + "/respuestas"),
            Map.of("foodGroupId", groupId, "consumed", true), 201);
        var yesterdayNotes = jdbc.queryForList("select * from meal_notes where plan_id=? and fecha=?", oldPlan, today.minusDays(1));
        var yesterdayEntries = jdbc.queryForList("select * from food_entries where meal_id=? and date=?", meal, today.minusDays(1));
        for (int divisor : List.of(2, 4)) {
            state = request(put(BASE + "alimentos/" + ruleUid), body(Map.of("alimento", "sintetico", "tipo", "NORMAL",
                "groupUid", groupUid, "cantidadPorPorcion", divisor, "unidad", "u")), 200);
            long plan = state.path("planId").asLong();
            JsonNode day = request(get("/api/v1/registro/" + today), null, 200);
            JsonNode currentMeal = day.path("meals").get(0);
            assertThat(currentMeal.path("noteId").asLong()).isEqualTo(saved.path("noteId").asLong());
            assertThat(currentMeal.path("noteText").asText()).isEqualTo("4 sintetico u");
            assertThat(currentMeal.path("noteVersion").asLong()).isGreaterThan(saved.path("version").asLong());
            assertThat(jdbc.queryForObject("select porciones from food_entries where meal_note_id=?", Double.class,
                saved.path("noteId").asLong())).isEqualTo(4.0 / divisor);
            assertThat(jdbc.queryForObject("select count(*) from meal_notes n join meals m on m.id=n.meal_id where n.id=? and (n.plan_id<>? or m.plan_id<>?)",
                Integer.class, saved.path("noteId").asLong(), plan, plan)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from food_entries e join meals m on m.id=e.meal_id left join plan_food_groups g on g.id=e.food_group_id where e.user_id=(select user_id from plans where id=?) and e.date=? and (m.plan_id<>? or g.plan_id<>?)",
                Integer.class, plan, today, plan, plan)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from food_entries where meal_id=? and date=? and origen='RESPUESTA'",
                Integer.class, currentMeal.path("mealId").asLong(), today)).isEqualTo(1);
        }
        assertThat(jdbc.queryForList("select * from meal_notes where plan_id=? and fecha=?", oldPlan, today.minusDays(1))).isEqualTo(yesterdayNotes);
        assertThat(jdbc.queryForList("select * from food_entries where meal_id=? and date=?", meal, today.minusDays(1))).isEqualTo(yesterdayEntries);
        request(put("/api/v1/registro/" + today.plusDays(1) + "/comidas/" + meal + "/nota"),
            Map.of("text", "1 sintetico"), 409);
        request(put("/api/v1/registro/" + today + "/comidas/" + meals().getFirst() + "/nota"),
            Map.of("text", "1 sintetico", "version", saved.path("version").asLong()), 409);
    }

    @Test
    void nullSynonymsAndNormalizedDuplicateFoodContract() throws Exception {
        long planId = state.path("planId").asLong();
        jdbc.update("insert into food_rules(plan_id,user_id,alcance,alimento,sinonimos,tipo) select id,user_id,'USUARIO','Árbol',NULL,'LIBRE' from plans where id=?", planId);
        state = request(get(BASE + "reglas"), null, 200);
        assertThat(state.path("alimentos").get(0).path("sinonimos").isArray()).isTrue();
        assertThat(state.path("alimentos").get(0).path("sinonimos").size()).isZero();
        JsonNode error = request(post(BASE + "alimentos"), body(Map.of("alimento", "  ARBOL  ", "tipo", "LIBRE")), 409);
        assertThat(error.path("code").asText()).isEqualTo("DUPLICATE");
        assertThat(error.path("error").asText()).isEqualTo("Ya tenés un alimento con ese nombre. Editalo en lugar de crear otro.");
        UUID uid = UUID.randomUUID();
        jdbc.update("insert into food_rules(uid,alcance,alimento,sinonimos,tipo) values (?,'GLOBAL','Catalogo nulo',NULL,'LIBRE')", uid);
        JsonNode catalog = request(get(BASE + "catalogo").param("q", "Catalogo nulo"), null, 200);
        assertThat(catalog.get(0).path("sinonimos").isArray()).isTrue();
        assertThat(catalog.get(0).path("sinonimos").size()).isZero();
    }

    @Test
    void zeroPortionsDoNotPreventDeletingGroup() throws Exception {
        long groupId = group("Proteínas").path("id").asLong();
        String uid = group("Proteínas").path("uid").asText();
        jdbc.update("update meal_portions set portions=0 where food_group_id=?", groupId);
        state = request(delete(BASE + "grupos/" + uid).param("planVersion", state.path("planVersion").asText()), null, 200);
        assertThat(jdbc.queryForObject("select count(*) from meal_portions where food_group_id=?", Integer.class, groupId)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from plan_food_groups where id=?", Integer.class, groupId)).isZero();
    }

    @Test
    void newTodayNoteRejectsMealFromOldVersionAfterFork() throws Exception {
        long staleMeal = meals().getFirst();
        note(staleMeal, LocalDate.now(clock).minusDays(1), "1 manzana");
        addGroup("Dispara copia", Map.of());

        JsonNode error = request(put("/api/v1/registro/" + LocalDate.now(clock) + "/comidas/" + staleMeal + "/nota"),
            Map.of("text", "1 manzana"), 409);

        assertThat(error.path("code").asText()).isEqualTo("PLAN_CHANGED");
        note(staleMeal, LocalDate.now(clock).minusDays(1), "2 manzanas");
    }

    @Test
    void deletingGroupReinterpretsTodayAndPreservesYesterday() throws Exception {
        addGroup("Grupo global", Map.of("clave", "review2_global"));
        String uid = group("Grupo global").path("uid").asText();
        long oldGroup = group("Grupo global").path("id").asLong();
        jdbc.update("insert into food_rules(uid,alcance,alimento,tipo,standard_group_key,cantidad_por_porcion,unidad,porcion_por_defecto) values (?,'GLOBAL','prueba global review','NORMAL','review2_global',1,'u',1)", UUID.randomUUID());
        long oldPlan = state.path("planId").asLong();
        long meal = meals().getFirst();
        note(meal, LocalDate.now(clock).minusDays(1), "1 prueba global review u");
        var yesterday = jdbc.queryForList("select * from food_entries where meal_id=? and date=?", meal, LocalDate.now(clock).minusDays(1));
        note(meal, LocalDate.now(clock), "2 prueba global review u");
        addGroup("Copia", Map.of());
        assertThat(state.path("planId").asLong()).isNotEqualTo(oldPlan);
        long movedGroup = group("Grupo global").path("id").asLong();
        assertThat(movedGroup).isNotEqualTo(oldGroup);

        state = request(delete(BASE + "grupos/" + uid).param("planVersion", state.path("planVersion").asText()), null, 200);

        assertThat(jdbc.queryForList("select * from food_entries where meal_id=? and date=?", meal, LocalDate.now(clock).minusDays(1)))
            .isEqualTo(yesterday);
        JsonNode day = request(get("/api/v1/registro/" + LocalDate.now(clock)), null, 200);
        assertThat(day.path("meals").get(0).path("noteText").asText()).isEqualTo("2 prueba global review u");
        assertThat(day.path("meals").get(0).path("items").size()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from plan_food_groups where id=?", Integer.class, oldGroup)).isEqualTo(1);
    }

    @Test
    void renamingFoodRejectsNormalizedDuplicateAndAllowsSameUid() throws Exception {
        state = request(post(BASE + "alimentos"), body(Map.of("alimento", "Árbol", "tipo", "LIBRE")), 201);
        String first = state.path("alimentos").get(0).path("uid").asText();
        state = request(post(BASE + "alimentos"), body(Map.of("alimento", "Otro", "tipo", "LIBRE")), 201);
        String second = state.path("alimentos").get(1).path("uid").asText();
        JsonNode error = request(put(BASE + "alimentos/" + second),
            body(Map.of("alimento", " ARBOL ", "tipo", "LIBRE")), 409);
        assertThat(error.path("code").asText()).isEqualTo("DUPLICATE");
        state = request(put(BASE + "alimentos/" + first), body(Map.of("alimento", "ARBOL", "tipo", "LIBRE")), 200);
    }

    @Test
    void normalCorrectionUsesQuantityPerPortionAndKeepsSynonyms() throws Exception {
        state = request(post(BASE + "alimentos"), body(Map.of("alimento", "yogur prueba", "sinonimos", List.of("yogurt"),
            "tipo", "NORMAL", "groupUid", group("Proteínas").path("uid").asText(),
            "cantidadPorPorcion", 1, "unidad", "u")), 201);
        long meal = meals().getFirst();
        JsonNode saved = note(meal, LocalDate.now(clock), "2 yogur prueba u");
        long entry = saved.path("entries").get(0).path("id").asLong();
        request(patch("/api/v1/registro/" + LocalDate.now(clock) + "/items/" + entry),
            Map.of("quantity", 2, "portions", 3, "saveAsRule", true), 200);
        state = request(get(BASE + "reglas"), null, 200);
        JsonNode rule = state.path("alimentos").get(0);
        assertThat(rule.path("cantidadPorPorcion").asDouble()).isEqualTo(0.667);
        assertThat(rule.path("porcionPorDefecto").asDouble()).isEqualTo(1.5);
        assertThat(rule.path("sinonimos").get(0).asText()).isEqualTo("yogurt");
        for (String text : List.of("2 yogur prueba u", "2 yogurt u", "2 yogur prueba")) {
            JsonNode reinterpreted = note(meal, LocalDate.now(clock), text);
            assertThat(reinterpreted.path("entries").get(0).path("portions").asDouble())
                .isCloseTo(3, org.assertj.core.data.Offset.offset(0.01));
        }
    }

}
