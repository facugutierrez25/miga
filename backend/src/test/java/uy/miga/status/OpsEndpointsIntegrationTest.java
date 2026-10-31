package uy.miga.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.health.actuate.endpoint.HealthEndpointGroups;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import uy.miga.users.EmailOutboxWorker;
import uy.miga.users.MockEmailService;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK,
    properties = "app.ops.api-key=clave-operativa-de-prueba")
@ActiveProfiles("test")
class OpsEndpointsIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private FilterChainProxy springSecurityFilterChain;

    @Autowired
    private MockEmailService email;

    @Autowired
    private EmailOutboxWorker outbox;

    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    private HealthEndpointGroups healthGroups;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
            .addFilters(springSecurityFilterChain)
            .build();
    }

    @Test
    void readinessIncludesDatabase() {
        assertThat(healthGroups.get("readiness").isMember("db")).isTrue();
    }

    @Test
    void readinessIsUpWhenDatabaseIsUp() throws Exception {
        mockMvc.perform(get("/actuator/health/readiness"))
            .andExpect(status().isOk());
    }

    @Test
    void metricsRejectPatientToken() throws Exception {
        String token = patientToken();

        mockMvc.perform(get("/actuator/metrics").header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    void metricsRejectWrongOpsKey() throws Exception {
        mockMvc.perform(get("/actuator/metrics").header("X-Ops-Key", "otra-clave"))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void metricsAcceptOpsKey() throws Exception {
        mockMvc.perform(get("/actuator/metrics").header("X-Ops-Key", "clave-operativa-de-prueba"))
            .andExpect(status().isOk());
    }

    private String patientToken() throws Exception {
        String address = "ops-" + UUID.randomUUID() + "@miga.uy";
        Map<String, String> credentials = Map.of("email", address, "password", "Segura1234!");
        email.reset();
        mockMvc.perform(post("/api/v1/users").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(credentials)))
            .andExpect(status().isCreated());
        outbox.processJobs();
        mockMvc.perform(get("/api/v1/auth/verify").param("token", email.getTokenFor(address)))
            .andExpect(status().isOk());
        String body = mockMvc.perform(post("/api/v1/users/login").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(credentials)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).path("token").asText();
    }
}
