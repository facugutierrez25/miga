package uy.miga.status;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import uy.miga.MigaApplication;

@SpringBootTest(classes = MigaApplication.class, webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class StatusIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StatusController statusController;

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private FilterChainProxy springSecurityFilterChain;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .addFilters(springSecurityFilterChain)
                .build();
    }

    @Test
    void flywayCreatesUsersTable() {
        Integer tablas = jdbcTemplate.queryForObject(
            "select count(*) from information_schema.tables where table_name = 'users'",
            Integer.class);

        assertThat(tablas).isEqualTo(1);
    }

    @Test
    void statusRespondsWithDatabaseConnected() {
        var response = statusController.status();

        assertThat(response.app()).isEqualTo("miga-backend");
        assertThat(response.database()).isEqualTo("OK");
        assertThat(response.serverTime()).isNotNull();
    }

    @Test
    void actuatorHealthReturns200() throws Exception {
        mockMvc.perform(get("/actuator/health"))
               .andExpect(status().isOk());
    }

    @Test
    void actuatorHealthReadinessReturns200() throws Exception {
        mockMvc.perform(get("/actuator/health/readiness"))
               .andExpect(status().isOk());
    }

    @Test
    void actuatorHealthLivenessReturns200() throws Exception {
        mockMvc.perform(get("/actuator/health/liveness"))
               .andExpect(status().isOk());
    }
}
