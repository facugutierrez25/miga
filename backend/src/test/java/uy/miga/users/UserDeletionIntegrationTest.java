package uy.miga.users;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
@Import(UserDeletionIntegrationTest.FailureConfig.class)
class UserDeletionIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    @Autowired MockEmailService mockEmailService;
    @Autowired EmailOutboxWorker outboxWorker;
    @Autowired JdbcTemplate jdbc;
    @Autowired FailureListener failure;
    MockMvc mvc;
    final ObjectMapper mapper = new ObjectMapper();
    static final String PASSWORD = "Segura1234!";
    static final List<String> TABLES = List.of("users", "plans", "meals", "meal_portions",
        "plan_food_groups", "food_rules", "meal_notes", "food_entries", "plan_habits",
        "habit_logs", "email_verification_tokens", "email_outbox");

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        failure.enabled = false;
    }

    record Account(long id, String email, String token) {}

    Account account() throws Exception {
        String email = "delete-" + UUID.randomUUID() + "@miga.uy";
        mvc.perform(post("/api/v1/users").contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
            .andExpect(status().isCreated());
        String verification = mockEmailService.tokenAfterProcessing(outboxWorker, email);
        mvc.perform(get("/api/v1/auth/verify").param("token", verification)).andExpect(status().isOk());
        String body = mvc.perform(post("/api/v1/users/login").contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long id = jdbc.queryForObject("select id from users where email=?", Long.class, email);
        // Dos versiones completas, incluyendo reglas sin plan y registros históricos.
        for (boolean current : List.of(false, true)) {
            long plan = jdbc.queryForObject("insert into plans(user_id,created_at,updated_at,is_current) values (?,now(),now(),?) returning id", Long.class, id, current);
            long group = jdbc.queryForObject("insert into plan_food_groups(plan_id,name,abbreviation,display_order) values (?,'Proteínas','PRO',1) returning id", Long.class, plan);
            long meal = jdbc.queryForObject("insert into meals(plan_id,name,display_order) values (?,'Desayuno',1) returning id", Long.class, plan);
            jdbc.update("insert into meal_portions(meal_id,food_group_id,portions) values (?,?,1)", meal, group);
            jdbc.update("insert into food_rules(alcance,plan_id,alimento,food_group_id) values ('PLAN',?,'Regla propia',?)", plan, group);
            long note = jdbc.queryForObject("insert into meal_notes(user_id,plan_id,meal_id,fecha,texto) values (?,?,?,current_date,'Nota') returning id", Long.class, id, plan, meal);
            jdbc.update("insert into food_entries(user_id,user_email,meal_id,date,food,quantity,unit,food_group_id,meal_note_id) values (?,?,?,current_date,'Alimento',1,'u',?,?)", id, email, meal, group, note);
            long habit = jdbc.queryForObject("insert into plan_habits(plan_id,name,habit_type) values (?,'Agua','CANTIDAD') returning id", Long.class, plan);
            jdbc.update("insert into habit_logs(user_id,plan_habit_id,habit_uid,log_date,value) select ?,id,uid,current_date,1 from plan_habits where id=?", id, habit);
        }
        jdbc.update("insert into food_rules(alcance,user_id,alimento,tipo) values ('USUARIO',?,'Personal sin plan','LIBRE')", id);
        jdbc.update("insert into email_verification_tokens(user_id,token,expires_at) values (?,?,now()+interval '1 day')", id, UUID.randomUUID().toString());
        assertThat(jdbc.queryForObject("select count(*) from email_outbox where user_id=?", Integer.class, id)).isPositive();
        return new Account(id, email, mapper.readTree(body).path("token").asText());
    }

    Map<String, List<Map<String, Object>>> snapshot() {
        var data = new LinkedHashMap<String, List<Map<String, Object>>>();
        for (String table : TABLES) {
            var rows = jdbc.queryForList("select * from " + table + " order by id");
            for (var row : rows) row.replaceAll((key, value) -> {
                if (value instanceof java.sql.Array array) {
                    try { return Arrays.deepToString((Object[]) array.getArray()); }
                    catch (java.sql.SQLException ex) { throw new IllegalStateException(ex); }
                }
                return value;
            });
            data.put(table, rows);
        }
        return data;
    }

    @Test void deletesAllVersionsAndPersonalDataOnly() throws Exception {
        Account removed = account();
        account();
        var before = snapshot();
        var planIds = jdbc.queryForList("select id from plans where user_id=?", Long.class, removed.id());
        var mealIds = jdbc.queryForList("select m.id from meals m join plans p on p.id=m.plan_id where p.user_id=?", Long.class, removed.id());
        var habitIds = jdbc.queryForList("select h.id from plan_habits h join plans p on p.id=h.plan_id where p.user_id=?", Long.class, removed.id());
        mvc.perform(delete("/api/v1/users/me").header("Authorization", "Bearer " + removed.token())
            .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("password", PASSWORD))))
            .andExpect(status().isNoContent());
        var after = snapshot();
        for (String table : TABLES) {
            var expected = before.get(table).stream().filter(row -> {
                if (table.equals("users")) return !Objects.equals(row.get("id"), removed.id());
                if (Objects.equals(row.get("user_id"), removed.id())) return false;
                if (row.containsKey("plan_id") && planIds.contains(row.get("plan_id"))) return false;
                if (row.containsKey("meal_id") && mealIds.contains(row.get("meal_id"))) return false;
                return !row.containsKey("plan_habit_id") || !habitIds.contains(row.get("plan_habit_id"));
            }).toList();
            assertThat(after.get(table)).as(table).isEqualTo(expected);
        }
        assertThat(after.get("food_rules").stream().filter(r -> "GLOBAL".equals(r.get("alcance"))).count()).isPositive();
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + removed.token()))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/users/login").contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(Map.of("email", removed.email(), "password", PASSWORD))))
            .andExpect(status().isUnauthorized());
    }

    @Test void oldTokenRemainsInvalidAfterRegisteringSameEmail() throws Exception {
        Account removed = account();
        mvc.perform(delete("/api/v1/users/me").header("Authorization", "Bearer " + removed.token())
            .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("password", PASSWORD))))
            .andExpect(status().isNoContent());
        mockEmailService.reset();
        mvc.perform(post("/api/v1/users").contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(Map.of("email", removed.email(), "password", PASSWORD))))
            .andExpect(status().isCreated());
        long newId = jdbc.queryForObject("select id from users where email=?", Long.class, removed.email());
        assertThat(newId).isNotEqualTo(removed.id());
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + removed.token()))
            .andExpect(status().isUnauthorized());

        String verification = mockEmailService.tokenAfterProcessing(outboxWorker, removed.email());
        mvc.perform(get("/api/v1/auth/verify").param("token", verification)).andExpect(status().isOk());
        String body = mvc.perform(post("/api/v1/users/login").contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(Map.of("email", removed.email(), "password", PASSWORD))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String newToken = mapper.readTree(body).path("token").asText();
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + newToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.email").value(removed.email()));
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + removed.token()))
            .andExpect(status().isUnauthorized());
    }

    @Test void wrongPasswordDoesNotDeleteAnything() throws Exception {
        Account account = account();
        var before = snapshot();
        mvc.perform(delete("/api/v1/users/me").header("Authorization", "Bearer " + account.token())
            .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"incorrecta\"}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("Contraseña incorrecta. No se eliminó tu cuenta."));
        assertThat(snapshot()).isEqualTo(before);
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + account.token())).andExpect(status().isOk());
    }

    @Test void listenerFailureRollsBackAllDeletions() throws Exception {
        Account account = account();
        var before = snapshot();
        failure.enabled = true;
        try {
            assertThatThrownBy(() -> mvc.perform(delete("/api/v1/users/me")
                .header("Authorization", "Bearer " + account.token()).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("password", PASSWORD)))))
                .hasRootCauseMessage("Fallo de prueba");
            assertThat(snapshot()).isEqualTo(before);
        } finally { failure.enabled = false; }
    }

    @Test void anonymousDeletionIsRejected() throws Exception {
        mvc.perform(delete("/api/v1/users/me").contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(Map.of("password", PASSWORD))))
            .andExpect(status().isUnauthorized());
    }

    @TestConfiguration static class FailureConfig {
        @Bean FailureListener failureListener() { return new FailureListener(); }
    }
    static class FailureListener {
        boolean enabled;
        @EventListener @Order(45)
        public void fail(UserDeletionRequested event) {
            if (enabled) throw new IllegalStateException("Fallo de prueba");
        }
    }
}
